/**
 * Reap Agentic Payments types (subset used by the app).
 * Docs: https://docs.reap.global/agentic-payments/overview
 */

export interface Money {
  amount: number;
  currency: string;
}

export interface NextAction {
  type: 'REDIRECT';
  url: string;
  expiresAt: string;
}

export type EnrollmentStatus = 'REQUIRES_ACTION' | 'ACTIVE' | 'REVOKED' | 'FAILED' | 'EXPIRED';

export interface Enrollment {
  id: string;
  status: EnrollmentStatus;
  source: string;
  nextAction?: NextAction | null;
  paymentMethod?: {
    network: string;
    last4: string;
    expiryMonth: number;
    expiryYear: number;
  };
}

export interface Product {
  id: string;
  name: string;
  merchant: {name: string};
  imageUrl?: string;
  priceRange: {min: Money; max: Money};
  available?: boolean;
  previewVariant?: {id: string; name?: string; price: Money; available?: boolean};
}

export interface ProductSearchResult {
  id: string;
  products: Product[];
  warnings: string[];
}

export interface ShippingAddress {
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  region?: string;
  postalCode?: string;
  country: string;
}

export interface Quote {
  id: string;
  shippingOptions: {id: string; name: string; selected: boolean; price: Money}[];
  amountBreakdown: {
    itemsSubtotal: Money;
    shipping?: Money;
    tax?: {amount: Money; includedInPrices: boolean};
    discounts: {name: string; amount: Money}[];
    additionalCharges: {name: string; amount: Money}[];
    finalAmount: Money;
  };
  expiresAt: string;
}

export type CheckoutStatus = 'REQUIRES_ACTION' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface Checkout {
  id: string;
  status: CheckoutStatus;
  amount?: Money;
  finalAmount?: Money;
  orderId?: string;
  nextAction?: NextAction | null;
}
