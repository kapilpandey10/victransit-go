import { isSupabaseConfigured } from './supabase'

/**
 * Tiny localStorage-backed store used when Supabase is not configured, and as
 * an offline cache for drafts. This keeps the whole app explorable in "demo
 * mode" without a backend.
 */

const NS = 'hadfield:v1:'

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(NS + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(NS + key, JSON.stringify(value))
  } catch {
    // Quota or private-mode failure — safe to ignore.
  }
}

export function removeLocal(key: string): void {
  try {
    localStorage.removeItem(NS + key)
  } catch {
    /* ignore */
  }
}

export function listLocalKeys(prefix = ''): string[] {
  const out: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(NS + prefix)) out.push(key.slice(NS.length))
    }
  } catch {
    /* ignore */
  }
  return out
}

/** Local id that mimics a uuid closely enough for client-side keys. */
export function localId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export const demoMode = !isSupabaseConfigured

export const DRAFT_KEYS = {
  learningStory: 'draft:learning-story',
  newsletter: 'draft:newsletter',
  programAnalysis: 'draft:program-analysis',
  learningOutcomes: 'draft:learning-outcomes',
  mindmap: (projectId: string) => `draft:mindmap:${projectId}`,
  chat: 'chat:session',
} as const