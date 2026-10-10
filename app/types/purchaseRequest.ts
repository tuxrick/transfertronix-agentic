/**
 * Purchase requests: someone asks for something, the agent quotes it
 * and the payer approves the charge on Reap's hosted page.
 */

export type PurchaseRequestStatus =
  | 'pending'
  | 'quoted'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

export interface PurchaseRequest {
  id: string;
  user_id: string;
  contact_id?: string;
  contact_name?: string;
  item_description: string;
  max_amount?: number;
  max_currency?: string;
  currency: string;
  product_id?: string;
  variant_id?: string;
  product_snapshot?: Record<string, any>;
  quote_id?: string;
  quote_expires_at?: string;
  quoted_amount?: number;
  provider?: 'reap' | 'kwal';
  checkout_id?: string;
  order_id?: string;
  final_amount?: number;
  status: PurchaseRequestStatus;
  error_message?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CreatePurchaseRequestInput {
  contact_id?: string;
  contact_name?: string;
  item_description: string;
  max_amount?: number;
  max_currency?: string;
  currency?: string;
}
