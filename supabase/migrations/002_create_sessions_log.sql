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

