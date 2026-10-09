/**
 * Purchase Requests
 *
 * Orquesta el flujo completo con Reap y persiste cada paso en Supabase:
 * solicitud -> cotización -> checkout (aprobación hospedada) -> orden.
 */

import {Linking} from 'react-native';
import {supabase} from './supabase';
import * as reap from './reapApi';
import {toShippingAddress} from './contacts';
import type {Contact} from '../types/contact';
import type {Product, Quote, Checkout} from '../types/reap';
import type {
  CreatePurchaseRequestInput,
  PurchaseRequest,
  PurchaseRequestStatus,
} from '../types/purchaseRequest';

const CHECKOUT_STATUS_MAP: Record<Checkout['status'], PurchaseRequestStatus> = {
  REQUIRES_ACTION: 'awaiting_approval',
  PROCESSING: 'awaiting_approval',
  COMPLETED: 'completed',
  FAILED: 'failed',
  EXPIRED: 'expired',
};

async function update(id: string, changes: Partial<PurchaseRequest>): Promise<PurchaseRequest> {
  const {data, error} = await supabase
    .from('purchase_requests')
    .update(changes)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createPurchaseRequest(
  input: CreatePurchaseRequestInput,
): Promise<PurchaseRequest> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const {data, error} = await supabase
    .from('purchase_requests')
    .insert([{...input, user_id: user.id, status: 'pending'}])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPurchaseRequests(
  status?: PurchaseRequestStatus | PurchaseRequestStatus[],
): Promise<PurchaseRequest[]> {
  let query = supabase
    .from('purchase_requests')
    .select('*')
    .order('created_at', {ascending: false});
  if (Array.isArray(status)) query = query.in('status', status);
  else if (status) query = query.eq('status', status);

  const {data, error} = await query;
  if (error) throw error;
  return data || [];
}

export const cancelPurchaseRequest = (id: string) => update(id, {status: 'cancelled'});

/**
 * Cotiza el producto elegido usando la dirección del contacto como destino.
 */
export async function quotePurchase(
  request: PurchaseRequest,
  product: Product,
  contact?: Contact,
): Promise<{request: PurchaseRequest; quote: Quote}> {
  const variantId = product.previewVariant?.id;
  if (!variantId) throw new Error('El producto no tiene una variante comprable');

  const quote = await reap.createQuote({
    items: [{variantId, quantity: 1}],
    shippingAddress: contact ? toShippingAddress(contact) : undefined,
  });

  const updated = await update(request.id, {
    product_id: product.id,
    variant_id: variantId,
    product_snapshot: {name: product.name, merchant: product.merchant.name, imageUrl: product.imageUrl},
    quote_id: quote.id,
    quote_expires_at: quote.expiresAt,
    quoted_amount: quote.amountBreakdown.finalAmount.amount,
    currency: quote.amountBreakdown.finalAmount.currency,
    status: 'quoted',
  });
  return {request: updated, quote};
}

/**
 * Crea el checkout y abre la página de aprobación de Reap.
 * El backend rechaza el cargo si el total vivo excede max_amount.
 */
export async function startCheckout(request: PurchaseRequest): Promise<PurchaseRequest> {
  if (!request.quote_id) throw new Error('La solicitud no tiene cotización');

  const enrollment = await reap.getActiveEnrollment();
  if (!enrollment) {
    throw new reap.ApiError(409, 'NO_PAYMENT_METHOD', 'Agrega un método de pago primero');
  }

  const checkout = await reap.createCheckout({
    quoteId: request.quote_id,
    enrollmentId: enrollment.id,
    maxAmount: request.max_amount ?? undefined,
    ref: request.id,
  });

  const updated = await update(request.id, {
    enrollment_id: enrollment.id,
    checkout_id: checkout.id,
    status: CHECKOUT_STATUS_MAP[checkout.status],
  });

  if (checkout.nextAction?.url) {
    await Linking.openURL(checkout.nextAction.url);
  }
  return checkout.status === 'COMPLETED' ? syncCheckout(updated) : updated;
}

/**
 * Lee el estado real del checkout en Reap (tras volver de la página de aprobación).
 */
export async function syncCheckout(request: PurchaseRequest): Promise<PurchaseRequest> {
  if (!request.checkout_id) return request;
  const checkout = await reap.getCheckout(request.checkout_id);
  const status = CHECKOUT_STATUS_MAP[checkout.status];

  return update(request.id, {
    status,
    order_id: checkout.orderId,
    final_amount: checkout.finalAmount?.amount,
    completed_at: status === 'completed' ? new Date().toISOString() : undefined,
  });
}

export async function getPurchaseRequestById(id: string): Promise<PurchaseRequest | null> {
  const {data, error} = await supabase.from('purchase_requests').select('*').eq('id', id).single();
  if (error) return null;
  return data;
}
