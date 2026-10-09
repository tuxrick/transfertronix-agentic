/**
 * Cliente de la app hacia el backend de Transfertronix, que a su vez habla con Reap.
 * La API key de Reap nunca vive en la app: solo se manda el JWT de Supabase.
 */

import {getBackendUrl} from '../config';
import {supabase} from './supabase';
import type {
  Checkout,
  Enrollment,
  ProductSearchResult,
  Quote,
  ShippingAddress,
} from '../types/reap';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const {
    data: {session},
  } = await supabase.auth.getSession();
  if (!session) throw new ApiError(401, 'UNAUTHENTICATED', 'Inicia sesión de nuevo');

  const response = await fetch(`${getBackendUrl()}/api/agentic${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
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

// Enrollments (métodos de pago)
export const listEnrollments = () => request<{items: Enrollment[]}>('GET', '/enrollments');
export const createEnrollment = () => request<Enrollment>('POST', '/enrollments');
export const getEnrollment = (id: string) => request<Enrollment>('GET', `/enrollments/${id}`);

export async function getActiveEnrollment(): Promise<Enrollment | undefined> {
  const {items} = await listEnrollments();
  return items.find(e => e.status === 'ACTIVE');
}

// Productos
export interface SearchProductsInput {
  query: string;
  country?: string;
  currency?: string;
  maxPrice?: number;
  merchantName?: string;
  limit?: number;
}

export const searchProducts = (input: SearchProductsInput) =>
  request<ProductSearchResult>('POST', '/products/search', input);

// Cotizaciones
export const createQuote = (input: {
  items: {variantId: string; quantity: number}[];
  shippingAddress?: ShippingAddress;
  offerCode?: string;
}) => request<Quote>('POST', '/quotes', input);

export const getQuote = (id: string) => request<Quote>('GET', `/quotes/${id}`);

// Checkouts
export const createCheckout = (input: {
  quoteId: string;
  enrollmentId: string;
  maxAmount?: number;
  ref?: string;
}) => request<Checkout>('POST', '/checkouts', input);

export const getCheckout = (id: string) => request<Checkout>('GET', `/checkouts/${id}`);
