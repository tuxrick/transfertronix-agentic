-- ============================================
-- Script 1: Crear tabla de perfiles de usuario
-- ============================================
-- Ejecuta este script en Supabase Dashboard → SQL Editor

-- 1. Crear tabla de perfiles
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de seguridad

-- Los usuarios pueden ver todos los perfiles (opcional, depende de tu app)
CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

-- Los usuarios solo pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Los usuarios solo pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Los usuarios solo pueden eliminar su propio perfil
CREATE POLICY "Users can delete own profile"
  ON public.profiles
  FOR DELETE
  USING (auth.uid() = id);

-- 4. Crear índices para mejor performance
CREATE INDEX IF NOT EXISTS profiles_email_idx ON public.profiles(email);
CREATE INDEX IF NOT EXISTS profiles_created_at_idx ON public.profiles(created_at DESC);

-- 5. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger para actualizar updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Función para crear perfil automáticamente cuando se registra un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Trigger para ejecutar la función cuando se crea un usuario
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- Script completado
-- ============================================
-- Ahora cada vez que un usuario se registre,
-- automáticamente se creará su perfil en la tabla profiles.

-- ============================================
-- Script 2: Crear tabla de sesiones (opcional)
-- ============================================
-- Esta tabla es OPCIONAL - solo si quieres trackear las sesiones

-- 1. Crear tabla de log de sesiones
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  device_info TEXT,
  ip_address INET,
  user_agent TEXT,
  logged_in_at TIMESTAMPTZ DEFAULT NOW(),
  logged_out_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true
);

-- 2. Habilitar RLS
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

-- 3. Políticas: Los usuarios solo pueden ver sus propias sesiones
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4. Índices
CREATE INDEX IF NOT EXISTS user_sessions_user_id_idx ON public.user_sessions(user_id);
CREATE INDEX IF NOT EXISTS user_sessions_logged_in_at_idx ON public.user_sessions(logged_in_at DESC);
CREATE INDEX IF NOT EXISTS user_sessions_is_active_idx ON public.user_sessions(is_active) WHERE is_active = true;

-- 5. Función para obtener sesiones activas del usuario
CREATE OR REPLACE FUNCTION public.get_active_sessions(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  device_info TEXT,
  logged_in_at TIMESTAMPTZ,
  ip_address TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.id,
    us.device_info,
    us.logged_in_at,
    HOST(us.ip_address) as ip_address
  FROM public.user_sessions us
  WHERE us.user_id = user_uuid
    AND us.is_active = true
  ORDER BY us.logged_in_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- Script 3: Funciones útiles
-- ============================================

-- 1. Función para obtener el perfil del usuario actual
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS TABLE (
  id UUID,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.full_name,
    p.avatar_url,
    p.phone,
    p.bio,
    p.created_at,
    p.updated_at
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Función para actualizar el perfil del usuario
CREATE OR REPLACE FUNCTION public.update_my_profile(
  new_full_name TEXT DEFAULT NULL,
  new_avatar_url TEXT DEFAULT NULL,
  new_phone TEXT DEFAULT NULL,
  new_bio TEXT DEFAULT NULL
)
RETURNS public.profiles AS $$
DECLARE
  updated_profile public.profiles;
BEGIN
  UPDATE public.profiles
  SET
    full_name = COALESCE(new_full_name, full_name),
    avatar_url = COALESCE(new_avatar_url, avatar_url),
    phone = COALESCE(new_phone, phone),
    bio = COALESCE(new_bio, bio),
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO updated_profile;
  
  RETURN updated_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Función para contar usuarios totales (solo admin)
CREATE OR REPLACE FUNCTION public.count_total_users()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM public.profiles);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Función para eliminar cuenta (soft delete)
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS VOID AS $$
BEGIN
  -- Marcar sesiones como inactivas
  UPDATE public.user_sessions
  SET is_active = false, logged_out_at = NOW()
  WHERE user_id = auth.uid();
  
  -- Eliminar perfil (esto también eliminará el usuario de auth.users por CASCADE)
  DELETE FROM public.profiles WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
