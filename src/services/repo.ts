import { getSupabase, trySupabase } from './supabase'
import { localId, readLocal, writeLocal } from './localStore'

/**
 * Thin repository abstraction.
 *
 * When Supabase is configured the calls hit Postgres (with RLS enforcing that
 * educators only see their own rows). When it is not configured, the same API
 * is served from localStorage so the whole app remains explorable in demo mode.
 *
 * In demo mode `user_id` is the literal string 'local-educator'.
 */

export const DEMO_USER_ID = 'local-educator'

export interface BaseRecord {
  id: string
  user_id: string
  created_at: string
  updated_at: string
}

type Row = Record<string, unknown>

function nowIso() {
  return new Date().toISOString()
}

function localKey(table: string) {
  return `table:${table}`
}

function localAll<T>(table: string): T[] {
  return readLocal<T[]>(localKey(table), [])
}

function localSave<T>(table: string, rows: T[]) {
  writeLocal(localKey(table), rows)
}

/** Read a dynamic column off a generic row. */
function col(row: unknown, key: string): unknown {
  return (row as Row)[key]
}

export interface QueryOptions {
  /** Column to order by. Defaults to created_at. */
  orderBy?: string
  ascending?: boolean
  limit?: number
  /** Simple equality filters. */
  where?: Row
}

export function createRepo<T extends BaseRecord>(table: string) {
  return {
    async list(userId: string, options: QueryOptions = {}): Promise<T[]> {
      const sb = trySupabase()
      if (sb) {
        let q = sb.from(table).select('*').eq('user_id', userId)
        if (options.where) {
          for (const [k, v] of Object.entries(options.where)) q = q.eq(k, v)
        }
        q = q.order(options.orderBy ?? 'created_at', {
          ascending: options.ascending ?? false,
        })
        if (options.limit) q = q.limit(options.limit)
        const { data, error } = await q
        if (error) throw new Error(`${table}: ${error.message}`)
        return (data ?? []) as T[]
      }

      let rows = localAll<T>(table).filter(r => r.user_id === userId)
      if (options.where) {
        const where = options.where
        rows = rows.filter(r =>
          Object.entries(where).every(([k, v]) => col(r, k) === v),
        )
      }
      const key = options.orderBy ?? 'created_at'
      rows.sort((a, b) => {
        const av = String(col(a, key) ?? '')
        const bv = String(col(b, key) ?? '')
        return options.ascending ? av.localeCompare(bv) : bv.localeCompare(av)
      })
      return options.limit ? rows.slice(0, options.limit) : rows
    },

    async get(userId: string, id: string): Promise<T | null> {
      const sb = trySupabase()
      if (sb) {
        const { data, error } = await sb
          .from(table)
          .select('*')
          .eq('id', id)
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw new Error(`${table}: ${error.message}`)
        return (data as T) ?? null
      }
      return localAll<T>(table).find(r => r.id === id && r.user_id === userId) ?? null
    },

    async create(
      userId: string,
      payload: Partial<T>,
      providedId?: string,
    ): Promise<T> {
      const sb = trySupabase()
      if (sb) {
        const insertRow: Record<string, unknown> = {
          ...(payload as Record<string, unknown>),
          user_id: userId,
        }
        if (providedId) insertRow.id = providedId
        const { data, error } = await sb
          .from(table)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(insertRow as never)
          .select('*')
          .single()
        if (error) throw new Error(`${table}: ${error.message}`)
        return data as T
      }

      const row = {
        ...payload,
        id: providedId ?? localId(),
        user_id: userId,
        created_at: nowIso(),
        updated_at: nowIso(),
      } as unknown as T
      const rows = localAll<T>(table)
      rows.push(row)
      localSave(table, rows)
      return row
    },

    async update(userId: string, id: string, patch: Partial<T>): Promise<T> {
      const sb = trySupabase()
      if (sb) {
        const { data, error } = await sb
          .from(table)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ ...(patch as Record<string, unknown>), updated_at: nowIso() } as never)
          .eq('id', id)
          .eq('user_id', userId)
          .select('*')
          .single()
        if (error) throw new Error(`${table}: ${error.message}`)
        return data as T
      }

      const rows = localAll<T>(table)
      const idx = rows.findIndex(r => r.id === id && r.user_id === userId)
      if (idx === -1) throw new Error(`${table}: record ${id} not found`)
      const next = { ...rows[idx], ...patch, updated_at: nowIso() } as T
      rows[idx] = next
      localSave(table, rows)
      return next
    },

    async remove(userId: string, id: string): Promise<void> {
      const sb = trySupabase()
      if (sb) {
        const { error } = await sb
          .from(table)
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
        if (error) throw new Error(`${table}: ${error.message}`)
        return
      }
      localSave(
        table,
        localAll<T>(table).filter(r => !(r.id === id && r.user_id === userId)),
      )
    },

    /**
     * Bulk replace of all rows belonging to a parent record.
     * Used by the mind-map autosave (delete-then-insert of the node set).
     */
    async replaceForParent(
      userId: string,
      parentColumn: string,
      parentId: string,
      rows: Partial<T>[],
    ): Promise<T[]> {
      const sb = trySupabase()
      if (sb) {
        const del = await sb
          .from(table)
          .delete()
          .eq('user_id', userId)
          .eq(parentColumn, parentId)
        if (del.error) throw new Error(`${table}: ${del.error.message}`)
        if (!rows.length) return []
        const insertRows = rows.map(r => ({
          ...(r as Record<string, unknown>),
          user_id: userId,
          [parentColumn]: parentId,
        }))
        const { data, error } = await sb
          .from(table)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .insert(insertRows as never)
          .select('*')
        if (error) throw new Error(`${table}: ${error.message}`)
        return (data ?? []) as T[]
      }

      const keep = localAll<T>(table).filter(
        r => !(r.user_id === userId && col(r, parentColumn) === parentId),
      )
      const created = rows.map(
        r =>
          ({
            ...r,
            id: (r.id as string) ?? localId(),
            user_id: userId,
            [parentColumn]: parentId,
            created_at: nowIso(),
            updated_at: nowIso(),
          }) as unknown as T,
      )
      localSave(table, [...keep, ...created])
      return created
    },

    /** Escape hatch for advanced queries. */
    client: () => getSupabase(),
  }
}

export type Repo<T extends BaseRecord> = ReturnType<typeof createRepo<T>>
export type RepoInstance<T extends BaseRecord> = Repo<T>

// ---------------------------------------------------------------------------
// Table names must match the SQL migration in supabase/migrations.
// ---------------------------------------------------------------------------
export const TABLES = {
  profiles: 'profiles',
  projects: 'projects',
  mindmapNodes: 'mindmap_nodes',
  learningStories: 'learning_stories',
  activities: 'activities',
  newsletters: 'newsletters',
  programAnalyses: 'program_book_analyses',
} as const