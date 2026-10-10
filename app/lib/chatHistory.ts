/**
 * Chat History
 *
 * Persiste la conversación con el agente en Supabase para verla al volver a la app.
 */

import {supabase} from './supabase';

export interface StoredMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  created_at: string;
}

const HISTORY_LIMIT = 60;

export async function loadChatHistory(): Promise<StoredMessage[]> {
  const {data, error} = await supabase
    .from('chat_messages')
    .select('id, sender, text, created_at')
    .order('created_at', {ascending: false})
    .limit(HISTORY_LIMIT);

  if (error) {
    console.error('Error loading chat history:', error);
    return [];
  }
  return (data || []).reverse();
}

export async function saveChatMessage(sender: 'user' | 'ai', text: string): Promise<void> {
  const {
    data: {user},
  } = await supabase.auth.getUser();
  if (!user) return;

  const {error} = await supabase.from('chat_messages').insert([{user_id: user.id, sender, text}]);
  if (error) console.error('Error saving chat message:', error);
}

export async function clearChatHistory(): Promise<void> {
  const {error} = await supabase.from('chat_messages').delete().not('id', 'is', null);
  if (error) throw error;
}
