import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * True when the app has real Supabase credentials configured.
 * When false the app runs in "local-only" demo mode so the UI is fully
 * explorable without a backend (data is kept in localStorage).
 */
export const isSupabaseConfigured = Boolean(
  url && anonKey && !url.includes('YOUR-PROJECT-REF') && !anonKey.includes('YOUR-ANON-KEY'),
)

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured) {
    throw new Error(
      'Supabase is not configured. Copy .env.example to .env.local and add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    )
  }
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    })
  }
  return client
}

/** Non-throwing accessor — returns null when Supabase is not configured. */
export function trySupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null
  try {
    return getSupabase()
  } catch {
    return null
  }
}

export const SUPABASE_URL = url
export const SUPABASE_ANON_KEY = anonKey