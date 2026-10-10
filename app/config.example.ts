/**
 * Configuración de la App - EJEMPLO
 * 
 * 1. Copia este archivo a config.ts
 * 2. Reemplaza los valores con tus propias keys
 * 3. NO subas config.ts a GitHub (ya está en .gitignore)
 */

export const config = {
  // Supabase
  supabase: {
    url: 'https://tu-proyecto.supabase.co',
    anonKey: 'tu_supabase_anon_key_aqui',
  },

  // Backend (proxy hacia Reap; prodUrl debe ser HTTPS para el returnUrl)
  backend: {
    devUrl: 'http://localhost:3000',
    prodUrl: 'https://tu-backend-url.vercel.app',
  },
};

// Helper para obtener URL del backend según el entorno
export const getBackendUrl = () => {
  return __DEV__ ? config.backend.devUrl : config.backend.prodUrl;
};

