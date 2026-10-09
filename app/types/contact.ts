/**
 * Types for Contacts
 */

export interface Contact {
  id: string;
  user_id: string;
  name: string;
  nickname?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  region?: string;
  postal_code?: string;
  country?: string;
  spend_limit?: number;
  currency: string;
  notes?: string;
  favorite: boolean;
  created_at: string;
  updated_at: string;
}

export type ContactInput = Partial<
  Omit<Contact, 'id' | 'user_id' | 'created_at' | 'updated_at'>
> & {name: string};
