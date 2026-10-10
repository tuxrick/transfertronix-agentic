-- ============================================
-- TABLE: chat_messages
-- ============================================
-- Historial del chat con el agente, por usuario.

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender TEXT NOT NULL,
  text TEXT NOT NULL,
  purchase_request_id UUID REFERENCES purchase_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_sender CHECK (sender IN ('user', 'ai'))
);

CREATE INDEX idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own chat messages"
ON chat_messages FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
