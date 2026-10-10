-- ============================================
-- TABLE: purchase_requests
-- ============================================
-- Una solicitud de compra: alguien pide algo, el agente cotiza
-- y quien paga aprueba el cargo (Reap: página hospedada; Kwal: bóveda USDC).
--
-- Estados:
--   pending           -> creada, sin cotización
--   quoted            -> hay quote_id vigente
--   awaiting_approval -> checkout creado, esperando aprobación del pagador
--   completed         -> orden colocada con el comercio (order_id)
--   failed | expired | cancelled

CREATE TABLE IF NOT EXISTS purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name TEXT, -- Snapshot por si se borra el contacto

  item_description TEXT NOT NULL,
  max_amount DECIMAL(20, 2),
  max_currency TEXT, -- Moneda del tope; el backend no cobra si no coincide con la cotización
  currency TEXT NOT NULL DEFAULT 'MXN',

  -- Selección del agente
  product_id TEXT,
  variant_id TEXT,
  product_snapshot JSONB,

  -- Proveedor de pagos (reap | kwal)
  provider TEXT,
  quote_id TEXT,
  quote_expires_at TIMESTAMP WITH TIME ZONE,
  quoted_amount DECIMAL(20, 2),
  checkout_id TEXT, -- Reap checkout id o Kwal payment id
  order_id TEXT,
  final_amount DECIMAL(20, 2),

  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_purchase_status CHECK (
    status IN ('pending', 'quoted', 'awaiting_approval', 'completed', 'failed', 'expired', 'cancelled')
  ),
  CONSTRAINT valid_provider CHECK (provider IS NULL OR provider IN ('reap', 'kwal')),
  CONSTRAINT positive_max_amount CHECK (max_amount IS NULL OR max_amount > 0)
);

CREATE INDEX idx_purchase_requests_user_status ON purchase_requests(user_id, status);
CREATE INDEX idx_purchase_requests_contact ON purchase_requests(contact_id);
CREATE INDEX idx_purchase_requests_created_at ON purchase_requests(created_at DESC);

ALTER TABLE purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own purchase requests"
ON purchase_requests FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_purchase_requests_timestamp
BEFORE UPDATE ON purchase_requests
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
