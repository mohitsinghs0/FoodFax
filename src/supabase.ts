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

/**
 * Asserts that the provided key or current client environment does not contain
 * a Supabase Service Role Key. Throws an explicit error to prevent accidental
 * privilege escalation or secret leakage into client bundles.
 */
export function assertNoServiceRoleKey(key?: string): void {
  const checkKey = (candidate: string) => {
    if (!candidate || typeof candidate !== 'string') return;
    const lower = candidate.toLowerCase();
    if (lower.includes('service_role') || lower.includes('servicerole')) {
      throw new Error(
        'CRITICAL SECURITY VIOLATION: Supabase service_role key detected in frontend client. ' +
        'Frontend bundles must strictly only use the public anon key.'
      );
    }
    // Inspect JWT payload if key is structured as a 3-part token
    const parts = candidate.split('.');
    if (parts.length === 3) {
      try {
        let base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';
        const decoded = typeof atob === 'function' 
          ? atob(base64) 
          : (typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64').toString('utf8') : '');
        if (decoded) {
          const payload = JSON.parse(decoded);
          if (payload?.role === 'service_role') {
            throw new Error(
              'CRITICAL SECURITY VIOLATION: JWT with role "service_role" detected in frontend client. ' +
              'Service role tokens must NEVER be exposed in client code.'
            );
          }
        }
      } catch (err: any) {
        if (err?.message?.includes('CRITICAL SECURITY VIOLATION')) {
          throw err;
        }
      }
    }
  };

  if (key) {
    checkKey(key);
  }
  if (supabaseAnonKey) {
    checkKey(supabaseAnonKey);
  }
  if (env?.VITE_SUPABASE_SERVICE_ROLE_KEY || env?.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'CRITICAL SECURITY VIOLATION: VITE_SUPABASE_SERVICE_ROLE_KEY is present in client environment variables. ' +
      'Remove this secret immediately from your frontend .env files.'
    );
  }
}

// Immediately enforce hygiene at module evaluation time
assertNoServiceRoleKey(supabaseAnonKey);

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
