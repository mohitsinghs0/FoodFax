import { createClient } from '@supabase/supabase-js';

// Read from Vite environment variables with robust fallback to provided configuration
const supabaseUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
  'https://aftmqdmiwvpbpsdmsfbu.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || 
  'sb_publishable_O-f6YGUbj6hqHYBlwEhE5g_QVrnke9m';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

/**
 * Validates connectivity to the Supabase backend.
 */
export async function testSupabaseConnection(): Promise<boolean> {
  try {
    const { error } = await supabase.from('shops').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      console.warn('[Supabase] Health check note:', error.message);
      return false;
    }
    console.log('[Supabase] Successfully connected to', supabaseUrl);
    return true;
  } catch (err) {
    console.warn('[Supabase] Connection exception:', err);
    return false;
  }
}

// Automatically test connection in non-production or initialization
if (typeof window !== 'undefined') {
  testSupabaseConnection().catch(() => {});
}
