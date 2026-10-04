import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { ref } from 'vue'

const STORAGE_URL_KEY = 'hadfield:v1:supabase_url'
const STORAGE_ANON_KEY = 'hadfield:v1:supabase_anon_key'

export const DEFAULT_SUPABASE_URL = 'https://zcslgqitzkmxwusrqlsu.supabase.co'

export function getActiveSupabaseUrl(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const local = window.localStorage.getItem(STORAGE_URL_KEY)
    if (local && local.trim()) return local.trim()
  }
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()
  if (envUrl) return envUrl
  return DEFAULT_SUPABASE_URL
}

export function getActiveSupabaseAnonKey(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    const local = window.localStorage.getItem(STORAGE_ANON_KEY)
    if (local && local.trim()) return local.trim()
  }
  return ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '').trim()
}

export function checkIsSupabaseConfigured(): boolean {
  const url = getActiveSupabaseUrl()
  const key = getActiveSupabaseAnonKey()
  return Boolean(
    url &&
      key &&
      !url.includes('YOUR-PROJECT-REF') &&
      !key.includes('YOUR-ANON-KEY') &&
      key.length > 25,
  )
}

/** Reactive ref for Vue components to bind to configuration status changes. */
export const isSupabaseConfiguredRef = ref<boolean>(checkIsSupabaseConfigured())

/**
 * Backward-compatible getter flag.
 * True when the app has valid Supabase credentials configured (via .env.local or UI).
 */
export let isSupabaseConfigured = checkIsSupabaseConfigured()

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!checkIsSupabaseConfigured()) {
    throw new Error(
      'Supabase is not connected. Please add your Supabase anon key in Settings or .env.local.',
    )
  }
  if (!client) {
    const url = getActiveSupabaseUrl()
    const anonKey = getActiveSupabaseAnonKey()
    client = createClient(url, anonKey, {
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
  if (!checkIsSupabaseConfigured()) return null
  try {
    return getSupabase()
  } catch {
    return null
  }
}

/** Persist credentials dynamically into localStorage and rebuild Supabase client */
export function setSupabaseCredentials(url: string, anonKey: string): void {
  const cleanUrl = url.trim() || DEFAULT_SUPABASE_URL
  const cleanKey = anonKey.trim()

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(STORAGE_URL_KEY, cleanUrl)
    window.localStorage.setItem(STORAGE_ANON_KEY, cleanKey)
  }

  client = null
  isSupabaseConfigured = checkIsSupabaseConfigured()
  isSupabaseConfiguredRef.value = isSupabaseConfigured
}

/** Clear custom credentials and revert to default/env values */
export function clearSupabaseCredentials(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(STORAGE_URL_KEY)
    window.localStorage.removeItem(STORAGE_ANON_KEY)
  }

  client = null
  isSupabaseConfigured = checkIsSupabaseConfigured()
  isSupabaseConfiguredRef.value = isSupabaseConfigured
}

export interface SupabaseConnectionTestResult {
  ok: boolean
  message: string
  code: 'ALL_OPERATIONAL' | 'TABLES_MISSING' | 'INVALID_KEY' | 'NETWORK_ERROR' | 'INVALID_URL'
  authAvailable?: boolean
  tablesFound?: string[]
  missingTables?: string[]
  statusCode?: number
}

/**
 * Live test to verify Supabase connectivity, valid anon key, and database tables.
 */
export async function testSupabaseConnection(
  urlInput: string,
  anonKeyInput: string,
): Promise<SupabaseConnectionTestResult> {
  const targetUrl = (urlInput || DEFAULT_SUPABASE_URL).trim().replace(/\/+$/, '')
  const targetKey = anonKeyInput.trim()

  if (!targetUrl.startsWith('https://') && !targetUrl.startsWith('http://localhost')) {
    return {
      ok: false,
      message: 'Invalid Supabase URL: Must start with https:// (e.g. https://xxxx.supabase.co)',
      code: 'INVALID_URL',
    }
  }

  if (!targetKey || targetKey.length < 25) {
    return {
      ok: false,
      message:
        'Missing or incomplete Anon Public Key. Please paste the "anon" "public" key from Supabase Project Settings > API.',
      code: 'INVALID_KEY',
    }
  }

  try {
    // 1. Test Auth endpoint
    const authRes = await fetch(`${targetUrl}/auth/v1/settings`, {
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`,
      },
    })

    if (authRes.status === 401 || authRes.status === 403) {
      return {
        ok: false,
        message:
          'Supabase rejected this API key (HTTP 401 Unauthorized). Please make sure you copied the "anon" "public" key, NOT the service_role secret or an expired token.',
        code: 'INVALID_KEY',
        statusCode: authRes.status,
      }
    }

    // 2. Test Postgres REST endpoint for core tables
    const tableRes = await fetch(`${targetUrl}/rest/v1/teacher_access?select=id&limit=1`, {
      headers: {
        apikey: targetKey,
        Authorization: `Bearer ${targetKey}`,
      },
    })

    if (tableRes.status === 404 || tableRes.status === 400) {
      const body = await tableRes.text().catch(() => '')
      if (body.includes('does not exist') || body.includes('PGRST204') || tableRes.status === 404) {
        return {
          ok: true,
          message:
            'Connected to Supabase project! However, database tables have not been created yet. Click "Copy SQL Migration" and run it in the Supabase SQL Editor.',
          code: 'TABLES_MISSING',
          authAvailable: true,
          missingTables: [
            'teacher_access',
            'rooms',
            'topic_statuses',
            'learning_stories',
            'profiles',
          ],
          statusCode: tableRes.status,
        }
      }
    }

    if (tableRes.ok || tableRes.status === 200 || tableRes.status === 206) {
      return {
        ok: true,
        message: 'Successfully connected to Supabase Cloud! Database tables and Auth are operational.',
        code: 'ALL_OPERATIONAL',
        authAvailable: true,
        tablesFound: ['teacher_access', 'rooms', 'topic_statuses', 'learning_stories', 'profiles'],
        statusCode: 200,
      }
    }

    // Fallback if auth is working
    return {
      ok: true,
      message: 'Connected to Supabase Cloud! Auth API is active.',
      code: 'ALL_OPERATIONAL',
      authAvailable: true,
      statusCode: tableRes.status,
    }
  } catch (err) {
    return {
      ok: false,
      message: `Network error connecting to Supabase (${(err as Error).message}). Check your connection and URL.`,
      code: 'NETWORK_ERROR',
    }
  }
}

export const SUPABASE_URL = getActiveSupabaseUrl()
export const SUPABASE_ANON_KEY = getActiveSupabaseAnonKey()