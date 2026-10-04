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

export interface RepoOptions {
  /**
   * If true, records are shared across all authorized users in the centre
   * (e.g. rooms, staff access list, topic statuses) and queries are not scoped to user_id.
   */
  isGlobal?: boolean
  /**
   * If true, documentation files are shared across all educators in the same centre:
   * they can read, update, and compile them with AI, but only the author or Admin can delete.
   */
  centreShared?: boolean
}

export function createRepo<T extends BaseRecord>(table: string, opts: RepoOptions = {}) {
  const isGlobal = Boolean(opts.isGlobal)
  const isCentreShared = Boolean(opts.centreShared)
  const isShared = isGlobal || isCentreShared

  return {
    async list(userId: string, options: QueryOptions = {}): Promise<T[]> {
      const sb = trySupabase()
      if (sb) {
        let q = sb.from(table).select('*')
        if (!isShared) {
          q = q.eq('user_id', userId)
        }
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

      let rows = isShared
        ? localAll<T>(table)
        : localAll<T>(table).filter(r => r.user_id === userId)

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
        let q = sb.from(table).select('*').eq('id', id)
        if (!isShared) {
          q = q.eq('user_id', userId)
        }
        const { data, error } = await q.maybeSingle()
        if (error) throw new Error(`${table}: ${error.message}`)
        return (data as T) ?? null
      }
      return (
        localAll<T>(table).find(r => r.id === id && (isShared || r.user_id === userId)) ??
        null
      )
    },

    async create(
      userId: string,
      payload: Partial<T>,
      providedId?: string,
    ): Promise<T> {
      const sb = trySupabase()
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)

      if (sb) {
        const insertRow: Record<string, unknown> = {
          ...(payload as Record<string, unknown>),
        }
        if (providedId) insertRow.id = providedId
        if (isUuid) {
          insertRow.user_id = userId
        } else if (!isGlobal) {
          insertRow.user_id = userId
        }

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
        let q = sb
          .from(table)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .update({ ...(patch as Record<string, unknown>), updated_at: nowIso() } as never)
          .eq('id', id)

        if (!isShared) {
          q = q.eq('user_id', userId)
        }

        const { data, error } = await q.select('*').single()
        if (error) throw new Error(`${table}: ${error.message}`)
        return data as T
      }

      const rows = localAll<T>(table)
      const idx = rows.findIndex(r => r.id === id && (isShared || r.user_id === userId))
      if (idx === -1) throw new Error(`${table}: record ${id} not found`)
      const next = { ...rows[idx], ...patch, updated_at: nowIso() } as T
      rows[idx] = next
      localSave(table, rows)
      return next
    },

    async remove(userId: string, id: string, isAdmin = false): Promise<void> {
      // Collaboration check: If file is centre-shared, only original author or Centre Director can delete
      if (isCentreShared) {
        const item = await this.get(userId, id)
        if (item && item.user_id && item.user_id !== userId && !isAdmin) {
          throw new Error(
            "Cannot delete: Educators in the same centre can view and update each other's documentation, but only the original author or Centre Director can delete it.",
          )
        }
      }

      const sb = trySupabase()
      if (sb) {
        let q = sb.from(table).delete().eq('id', id)
        if (!isShared) {
          q = q.eq('user_id', userId)
        }
        const { error } = await q
        if (error) throw new Error(`${table}: ${error.message}`)
        return
      }
      localSave(
        table,
        localAll<T>(table).filter(r => !(r.id === id && (isShared || r.user_id === userId))),
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
  weeklyWrapUps: 'weekly_wrap_ups',
  teacherAccess: 'teacher_access',
  topicStatuses: 'topic_statuses',
  rooms: 'rooms',
} as const