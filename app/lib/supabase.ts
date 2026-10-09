import 'react-native-url-polyfill/auto';
import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {config} from '../config';

// Debug: Verificar que las credenciales están correctas
console.log('🔧 Inicializando Supabase...');
console.log('📍 URL:', config.supabase.url);
console.log('🔑 Key existe:', !!config.supabase.anonKey);

export const supabase = createClient(config.supabase.url, config.supabase.anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

console.log('✅ Cliente de Supabase inicializado correctamente');

