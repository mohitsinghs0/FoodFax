import { createClient } from '@supabase/supabase-js';

// Credentials must be supplied via .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY).
// Never hardcode credentials in source files — rotate your keys if they were ever committed.
const env: any = (typeof import.meta !== 'undefined' && import.meta.env) 
  ? import.meta.env 
  : (typeof process !== 'undefined' && process.env ? process.env : {});

const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
const supabaseAnonKey = (
  env.VITE_SUPABASE_ANON_KEY ||
  env.SUPABASE_ANON_KEY ||
  env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  ''
).trim();
// NOTE: Service Role Key must NEVER be present or read in client-side code.
// Client interacts exclusively via authenticated user JWT and anon key.

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('mock-foodfax') &&
  supabaseAnonKey &&
  supabaseAnonKey !== 'your-anon-or-publishable-key' &&
  supabaseAnonKey !== 'mock-anon-key-placeholder'
);

if (!isSupabaseConfigured) {
  console.info(
    '[Supabase] ℹ️ Running in demo / mock data mode.\n' +
    'To connect to the local Supabase stack, set VITE_SUPABASE_URL=http://127.0.0.1:8000 and VITE_SUPABASE_ANON_KEY in .env'
  );
} else {
  console.info('[Supabase] ✅ Configured → ', supabaseUrl);
}

// Fallback URL is only used when Supabase is not configured — real traffic always goes to activeUrl
const activeUrl = isSupabaseConfigured ? supabaseUrl : 'http://127.0.0.1:8000';
const activeAnonKey = isSupabaseConfigured ? supabaseAnonKey : 'mock-anon-key-placeholder';

// For local self-hosted Supabase, derive the WebSocket endpoint from the HTTP URL.
// Supabase-js v2 automatically appends /realtime/v1 to the base URL, so no override needed.
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
  global: {
    headers: {
      // Ensure the anon key is sent on every REST and realtime request
      apikey: activeAnonKey,
    },
  },
});

// Hardened Security: supabaseAdmin is strictly null in client build to prevent bundle credential leaks
export const supabaseAdmin: any = null;

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
