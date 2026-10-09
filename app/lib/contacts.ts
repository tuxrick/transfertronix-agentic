/**
 * Contacts Management
 *
 * Personas para quienes el agente compra, con su dirección de envío y tope de gasto.
 */

import {supabase} from './supabase';
import type {Contact, ContactInput} from '../types/contact';
import type {ShippingAddress} from '../types/reap';

const E164_PATTERN = /^\+[1-9]\d{6,14}$/;

export async function getContacts(): Promise<Contact[]> {
  const {data, error} = await supabase
    .from('contacts')
    .select('*')
    .order('favorite', {ascending: false})
    .order('name', {ascending: true});

  if (error) {
    console.error('Error getting contacts:', error);
    throw new Error('No se pudieron obtener los contactos');
  }
  return data || [];
}

export async function getContactById(contactId: string): Promise<Contact | null> {
  const {data, error} = await supabase.from('contacts').select('*').eq('id', contactId).single();
  if (error) {
    console.error('Error getting contact:', error);
    return null;
  }
  return data;
}

function normalize(input: Partial<ContactInput>) {
  if (input.phone && !E164_PATTERN.test(input.phone.trim())) {
    throw new Error('El teléfono debe tener formato internacional, ej: +5215512345678');
  }
  const trimmed: Record<string, any> = {};
  Object.entries(input).forEach(([key, value]) => {
    trimmed[key] = typeof value === 'string' ? value.trim() || null : value;
  });
  if (typeof trimmed.nickname === 'string') trimmed.nickname = trimmed.nickname.toLowerCase();
  if (typeof trimmed.country === 'string') trimmed.country = trimmed.country.toUpperCase();
  return trimmed;
}

export async function createContact(input: ContactInput): Promise<Contact> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Usuario no autenticado');

  const {data, error} = await supabase
    .from('contacts')
    .insert([{...normalize(input), user_id: user.id}])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateContact(contactId: string, input: Partial<ContactInput>): Promise<Contact> {
  const {data, error} = await supabase
    .from('contacts')
    .update(normalize(input))
    .eq('id', contactId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteContact(contactId: string): Promise<void> {
  const {error} = await supabase.from('contacts').delete().eq('id', contactId);
  if (error) {
    console.error('Error deleting contact:', error);
    throw new Error('No se pudo eliminar el contacto');
  }
}

export async function toggleFavorite(contactId: string, favorite: boolean): Promise<void> {
  const {error} = await supabase.from('contacts').update({favorite}).eq('id', contactId);
  if (error) {
    console.error('Error toggling favorite:', error);
    throw new Error('No se pudo actualizar el favorito');
  }
}

/**
 * Busca un contacto por nombre o nickname (usado por el agente).
 */
export function findContact(contacts: Contact[], query: string): Contact | undefined {
  const search = query.trim().toLowerCase();
  return (
    contacts.find(c => c.nickname === search || c.name.toLowerCase() === search) ||
    contacts.find(c => c.name.toLowerCase().includes(search) || search.includes(c.name.toLowerCase()))
  );
}

export function hasShippingAddress(contact: Contact): boolean {
  return Boolean(contact.address_line1 && contact.city && contact.country && contact.phone);
}

/**
 * Convierte el contacto al shippingAddress que espera Reap.
 */
export function toShippingAddress(contact: Contact): ShippingAddress | undefined {
  if (!hasShippingAddress(contact)) return undefined;
  const [firstName, ...rest] = contact.name.trim().split(/\s+/);
  return {
    firstName,
    lastName: rest.join(' ') || firstName,
    phone: contact.phone!,
    addressLine1: contact.address_line1!,
    addressLine2: contact.address_line2 || undefined,
    city: contact.city!,
    region: contact.region || undefined,
    postalCode: contact.postal_code || undefined,
    country: contact.country!,
  };
}
