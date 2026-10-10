/**
 * Cliente de la app hacia el backend de Transfertronix.
 * El backend habla con Reap o Kwal; las llaves nunca viven en la app.
 */

import {getBackendUrl} from '../config';
import {supabase} from './supabase';
import {getLanguage} from './i18n';
import type {
  Checkout,
  ExternalCheckout,
  Merchant,
  Money,
  PaymentProviderName,
  PaymentSetup,
  ProductSearchResult,
  Quote,
  ShippingAddress,
} from '../types/commerce';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown, base = '/api/commerce'): Promise<T> {
  const {
    data: {session},
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión de nuevo');

  const response = await fetch(`${getBackendUrl()}${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
      'Accept-Language': getLanguage(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error?.code || 'REQUEST_FAILED',
      data?.error?.message || `Error ${response.status}`,
    );
  }
  return data as T;
}

export const getProvider = () =>
  request<{name: PaymentProviderName; approvalMode: 'hosted_page' | 'vault'}>('GET', '/provider');

export const getMerchants = (country?: string) =>
  request<{items: Merchant[]; categories: {name: string; merchantCount: number}[]}>(
    'GET',
    `/merchants${country ? `?country=${encodeURIComponent(country)}` : ''}`,
  );

// Métodos de pago (tarjeta en Reap o bóveda en Kwal)
export const getPaymentSetup = () => request<PaymentSetup>('GET', '/payment-setup');
export const startPaymentSetup = () =>
  request<{actionUrl?: string; id?: string}>('POST', '/payment-setup');

export interface SearchProductsInput {
  query: string;
  country?: string;
  currency?: string;
  maxPrice?: number;
  limit?: number;
}

export const searchProducts = (input: SearchProductsInput) =>
  request<ProductSearchResult>('POST', '/products/search', input);

export const createQuote = (input: {
  productId?: string;
  variantId?: string;
  quantity?: number;
  externalCheckout?: ExternalCheckout;
  shippingAddress?: ShippingAddress;
  price?: Money;
}) => request<Quote>('POST', '/quotes', input);

export const getQuote = (id: string) => request<Quote>('GET', `/quotes/${id}`);

export const createCheckout = (input: {
  quoteId: string;
  maxAmount?: number;
  maxCurrency?: string;
  ref?: string;
}) =>
  request<Checkout>('POST', '/checkouts', input);

export const getCheckout = (id: string) => request<Checkout>('GET', `/checkouts/${id}`);

// Reapli (agente) corre en el backend
export const askAgent = (input: {message: string; history: unknown[]; context: unknown}) =>
  request<{text: string; functionCall?: {name: string; args: Record<string, any>}}>('POST', '/message', input, '/api/agent');
