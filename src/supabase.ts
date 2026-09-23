import { createClient } from '@supabase/supabase-js';

// Credentials must be supplied via .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
// Never hardcode credentials in source files — rotate your keys if they were ever committed.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] ⚠️  Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in your .env file.\n' +
    'Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

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

// Automatically test connection on app initialisation
if (typeof window !== 'undefined') {
  testSupabaseConnection().catch(() => {});
}
