/**
 * Reapli client
 *
 * Reapli (Gemini) runs on the backend: the API key never ships inside the app.
 * Here we only send the message, a minimal context and the recent history.
 */

import type {Contact} from '../types/contact';
import type {PurchaseRequest} from '../types/purchaseRequest';
import type {PaymentProviderName} from '../types/commerce';
import {askAgent} from './commerceApi';
import {translate, type Language} from './i18n';

export interface ShippingCatalog {
  country: string;
  categories: string[];
}

export interface AIContext {
  contacts: Contact[];
  openRequests: PurchaseRequest[];
  hasPaymentMethod: boolean;
  provider?: PaymentProviderName;
  shippingCatalog: ShippingCatalog[];
  language: Language;
}

export interface ChatTurn {
  role: 'user' | 'model';
  text: string;
}

export interface FunctionCall {
  name: string;
  args: Record<string, any>;
}

export interface AIResponse {
  text: string;
  functionCall?: FunctionCall;
}

/** Only what Reapli needs to decide: no addresses, phones or emails leave the device for the LLM. */
function minimalContext(context: AIContext) {
  return {
    contacts: context.contacts.map(c => ({
      name: c.name,
      nickname: c.nickname,
      city: c.city,
      country: c.country,
      spend_limit: c.spend_limit,
      currency: c.currency,
    })),
    openRequests: context.openRequests.map(r => ({
      contact_name: r.contact_name,
      item_description: r.item_description,
      status: r.status,
    })),
    hasPaymentMethod: context.hasPaymentMethod,
    provider: context.provider,
    shippingCatalog: context.shippingCatalog,
    language: context.language,
  };
}

export async function processMessageWithAI(
  userMessage: string,
  context: AIContext,
  history: ChatTurn[] = [],
): Promise<AIResponse> {
  try {
    return await askAgent({message: userMessage, history, context: minimalContext(context)});
  } catch (error: any) {
    console.error('Error processing message with Reapli:', error?.message);
    return {text: translate(context.language, 'chat.connectionError')};
  }
}
