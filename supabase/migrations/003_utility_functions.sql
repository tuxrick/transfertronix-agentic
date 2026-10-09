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

