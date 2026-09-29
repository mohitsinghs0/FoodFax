import { createClient } from '@supabase/supabase-js';

// Credentials must be supplied via .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
// Never hardcode credentials in source files — rotate your keys if they were ever committed.
const env: any = (typeof import.meta !== 'undefined' && import.meta.env) 
  ? import.meta.env 
  : (typeof process !== 'undefined' && process.env ? process.env : {});

const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
const supabaseServiceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '').trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project') &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'your-anon-or-publishable-key'
);

if (!isSupabaseConfigured) {
  console.info(
    '[Supabase] ℹ️ Running in demo / mock data mode.\n' +
    'To connect live cloud Supabase database, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.'
  );
}

const activeUrl = isSupabaseConfigured ? supabaseUrl : 'https://mock-foodfax.supabase.co';
const activeAnonKey = isSupabaseConfigured ? supabaseAnonKey : 'mock-anon-key-placeholder';

export const supabase = createClient(activeUrl, activeAnonKey, {
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

export const supabaseAdmin = supabaseServiceRoleKey && supabaseUrl
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

/**
 * Validates connectivity to the Supabase backend.
 */
export async function testSupabaseConnection(): Promise<boolean> {
  if (!isSupabaseConfigured) {
    return false;
  }
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
