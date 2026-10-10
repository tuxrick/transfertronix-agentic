/**
 * Contrato normalizado del backend de comercio.
 * Es el mismo para Reap Agentic Payments y para Kwal (Payward).
 */

export type PaymentProviderName = 'reap' | 'kwal';

export interface Money {
  amount: number;
  currency: string;
}

export interface ExternalCheckout {
  merchantDomain: string;
  checkoutUrl: string;
}

export interface Product {
  id: string;
  name: string;
  merchant?: string;
  imageUrl?: string;
  price?: Money;
  variantId?: string;
  // 'catalog' = producto de prueba de la lista de comercios soportados
  source: 'search' | 'catalog';
  externalCheckout?: ExternalCheckout;
}

export interface ProductSearchResult {
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
  // true cuando el sandbox no pudo cotizar y el backend simuló la cotización
  demo?: boolean;
  subtotal?: Money;
  shipping?: Money;
  tax?: Money;
  discounts: {name: string; amount: Money}[];
  total: Money;
  expiresAt?: string;
  shippingOptions: {id: string; name: string; price?: Money; selected: boolean}[];
}

export type CheckoutStatus = 'REQUIRES_ACTION' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface Checkout {
  id: string;
  demo?: boolean;
  status: CheckoutStatus;
  approvalUrl?: string;
  approvalExpiresAt?: string;
  orderId?: string;
  total?: Money;
  reason?: string;
}

export interface PaymentMethod {
  id: string;
  status: string;
  label: string | null;
  actionUrl?: string;
}

export interface VaultInfo {
  state: string;
  address?: string;
  chain?: string;
  chainId?: number;
  available?: Money;
  explorerUrl?: string;
  tokenAddress?: string;
  usdcFaucetUrl?: string;
  gasFaucetUrl?: string;
}

export interface PaymentSetup {
  provider: PaymentProviderName;
  ready: boolean;
  methods: PaymentMethod[];
  vault?: VaultInfo;
}

export interface Merchant {
  category: string;
  market: string;
  domain: string;
  shipsTo: string[];
}
