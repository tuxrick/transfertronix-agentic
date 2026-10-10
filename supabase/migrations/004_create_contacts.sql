-- ============================================
-- TABLE: contacts
-- ============================================
-- Personas para quienes el agente puede comprar (familia, empleados, amigos).
-- La dirección de envío alimenta el shippingAddress de las cotizaciones.

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL,
  nickname TEXT,
  email TEXT,
  phone TEXT, -- Formato E.164, ej: +5215512345678

  -- Shipping address
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country TEXT, -- ISO 3166-1 alpha-2, ej: MX

  -- Tope por compra que el agente puede gastar para este contacto
  spend_limit DECIMAL(20, 2),
  currency TEXT NOT NULL DEFAULT 'MXN',

  notes TEXT,
  favorite BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  CONSTRAINT valid_phone CHECK (phone IS NULL OR phone ~ '^\+[1-9]\d{6,14}$'),
  CONSTRAINT positive_spend_limit CHECK (spend_limit IS NULL OR spend_limit > 0)
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_nickname ON contacts(user_id, nickname);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own contacts"
ON contacts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_contacts_timestamp
BEFORE UPDATE ON contacts
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
