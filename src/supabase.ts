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
 * a Supabase Service Role Key. Prevents accidental privilege escalation or secret leakage.
 * Returns true if clean, or false if a service_role key was detected and neutralized.
 */
export function assertNoServiceRoleKey(key?: string): boolean {
  const checkKey = (candidate: string): boolean => {
    if (!candidate || typeof candidate !== 'string') return true;
    const lower = candidate.toLowerCase();
    if (lower.includes('service_role') || lower.includes('servicerole')) {
      console.error(
        '[FoodFax Security] ⚠️ CRITICAL SECURITY WARNING: Supabase service_role key detected in frontend client. ' +
        'Frontend bundles must strictly only use the public anon key. The key has been neutralized.'
      );
      return false;
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
            console.error(
              '[FoodFax Security] ⚠️ CRITICAL SECURITY WARNING: JWT with role "service_role" detected in frontend client. ' +
              'Service role tokens must NEVER be exposed in client code. The key has been neutralized.'
            );
            return false;
          }
        }
      } catch {
        // Ignored non-JWT format
      }
    }
    return true;
  };

  let isClean = true;
  if (key && !checkKey(key)) {
    isClean = false;
  }
  if (supabaseAnonKey && !checkKey(supabaseAnonKey)) {
    isClean = false;
  }
  if (env?.VITE_SUPABASE_SERVICE_ROLE_KEY || env?.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      '[FoodFax Security] ⚠️ CRITICAL: VITE_SUPABASE_SERVICE_ROLE_KEY is present in client environment variables. ' +
      'Remove this secret immediately from your frontend .env files and hosting provider.'
    );
    isClean = false;
  }

  return isClean;
}

// Enforce security hygiene without throwing uncaught fatal module errors
const isKeySafe = assertNoServiceRoleKey(supabaseAnonKey);
const sanitizedAnonKey = isKeySafe ? supabaseAnonKey : '';

// Detect if app is deployed remotely but still pointing to local Mac Mini docker IP
const isLocalhostHost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname === '0.0.0.0');
const isLocalhostBackend = Boolean(supabaseUrl && (supabaseUrl.includes('127.0.0.1') || supabaseUrl.includes('localhost')));
const isBackendReachable = !isLocalhostBackend || isLocalhostHost || typeof window === 'undefined';

export const isSupabaseConfigured = Boolean(
  isKeySafe &&
  isBackendReachable &&
  supabaseUrl &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('your-project') &&
  !supabaseUrl.includes('mock-foodfax') &&
  sanitizedAnonKey &&
  sanitizedAnonKey !== 'your-anon-or-publishable-key' &&
  sanitizedAnonKey !== 'mock-anon-key-placeholder'
);

if (!isSupabaseConfigured) {
  if (isLocalhostBackend && !isLocalhostHost && typeof window !== 'undefined') {
    console.warn(
      `[Supabase] ⚠️ Localhost URL (${supabaseUrl}) detected on remote deployment (${window.location.hostname}).\n` +
      `Browsers block HTTP localhost calls from remote HTTPS. Running safely in demo/mock mode.\n` +
      `To connect to live data, set production VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your hosting dashboard.`
    );
  } else {
    console.info(
      '[Supabase] ℹ️ Running in demo / mock data mode.\n' +
      'To connect to the local Supabase stack, set VITE_SUPABASE_URL=http://127.0.0.1:8000 and VITE_SUPABASE_ANON_KEY in .env'
    );
  }
} else {
  console.info('[Supabase] ✅ Configured → ', supabaseUrl);
}

// Fallback URL is only used when Supabase is not configured — real traffic always goes to activeUrl
const activeUrl = isSupabaseConfigured ? supabaseUrl : 'http://127.0.0.1:8000';
const activeAnonKey = isSupabaseConfigured ? sanitizedAnonKey : 'mock-anon-key-placeholder';

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
