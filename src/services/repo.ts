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

export function getActiveCentreName(): string {
  const profile = readLocal<{ centre_name?: string } | null>('profile', null)
  return profile?.centre_name?.trim() || 'Hadfield Early Learning Centre'
}

export function createRepo<T extends BaseRecord>(table: string, opts: RepoOptions = {}) {
  const isGlobal = Boolean(opts.isGlobal)
  const isCentreShared = Boolean(opts.centreShared)
  const isShared = isGlobal || isCentreShared

  return {
    async list(userId: string, options: QueryOptions = {}): Promise<T[]> {
      const activeCentre = getActiveCentreName().toLowerCase().trim()
      const sb = trySupabase()
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)

      const getLocalRows = () => {
        let rows = isShared
          ? localAll<T>(table)
          : localAll<T>(table).filter(r => r.user_id === userId)

        if (isCentreShared) {
          rows = rows.filter(r => {
            const rowCentre = String(col(r, 'centre_name') || 'Hadfield Early Learning Centre').toLowerCase().trim()
            return rowCentre === activeCentre
          })
        }

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
      }

      if (sb && (isUuid || isGlobal)) {
        try {
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
          if (!error && data) {
            let result = data as T[]
            if (isCentreShared) {
              result = result.filter(r => {
                const rowCentre = String(col(r, 'centre_name') || 'Hadfield Early Learning Centre').toLowerCase().trim()
                return rowCentre === activeCentre
              })
            }
            // Merge with local rows so offline or local-only drafts are never dropped
            const localRows = getLocalRows()
            const map = new Map<string, T>()
            for (const r of result) map.set(r.id, r)
            for (const r of localRows) {
              if (table === 'rooms') {
                const rName = String(col(r, 'name') || '').toLowerCase().trim()
                const rCentre = String(col(r, 'centre_name') || '').toLowerCase().trim()
                const exists = result.some(
                  rem =>
                    String(col(rem, 'name') || '').toLowerCase().trim() === rName &&
                    String(col(rem, 'centre_name') || '').toLowerCase().trim() === rCentre,
                )
                if (exists) continue
              }
              if (!map.has(r.id)) map.set(r.id, r)
            }
            return Array.from(map.values())
          }
        } catch {
          // Fall through to local storage if cloud fails
        }
      }

      return getLocalRows()
    },

    async get(userId: string, id: string): Promise<T | null> {
      const activeCentre = getActiveCentreName().toLowerCase().trim()
      const sb = trySupabase()
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      if (sb && (isUuid || isGlobal)) {
        try {
          let q = sb.from(table).select('*').eq('id', id)
          if (!isShared) {
            q = q.eq('user_id', userId)
          }
          const { data, error } = await q.maybeSingle()
          if (!error && data) {
            if (isCentreShared) {
              const rowCentre = String(col(data, 'centre_name') || 'Hadfield Early Learning Centre').toLowerCase().trim()
              if (rowCentre !== activeCentre) return null
            }
            return data as T
          }
        } catch {
          // Fall through to local storage
        }
      }
      const found =
        localAll<T>(table).find(r => r.id === id && (isShared || r.user_id === userId)) ??
        null
      if (found && isCentreShared) {
        const rowCentre = String(col(found, 'centre_name') || 'Hadfield Early Learning Centre').toLowerCase().trim()
        if (rowCentre !== activeCentre) return null
      }
      return found
    },

    async create(
      userId: string,
      payload: Partial<T>,
      providedId?: string,
    ): Promise<T> {
      const sb = trySupabase()
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)
      const activeCentre = getActiveCentreName()

      // Local fallback closure that always guarantees data is safely preserved
      const saveLocally = () => {
        const row = {
          centre_name: (payload as Record<string, unknown>).centre_name || activeCentre,
          ...payload,
          id: providedId ?? localId(),
          user_id: userId,
          created_at: nowIso(),
          updated_at: nowIso(),
        } as unknown as T
        const rows = localAll<T>(table)
        const existingIdx = rows.findIndex(r => r.id === row.id)
        if (existingIdx >= 0) {
          rows[existingIdx] = row
        } else {
          rows.push(row)
        }
        localSave(table, rows)
        return row
      }

      if (sb && (isUuid || isGlobal)) {
        const insertRow: Record<string, unknown> = {
          ...(payload as Record<string, unknown>),
        }
        if (isCentreShared && !insertRow.centre_name) {
          insertRow.centre_name = activeCentre
        }
        if (providedId) insertRow.id = providedId
        if (isUuid) {
          insertRow.user_id = userId
        } else if (!isGlobal) {
          insertRow.user_id = userId
        }

        try {
          const { data, error } = await sb
            .from(table)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .insert(insertRow as never)
            .select('*')
            .single()
          if (error) throw error
          const created = data as T
          // Mirror to local cache
          const rows = localAll<T>(table)
          const idx = rows.findIndex(r => r.id === created.id)
          if (idx >= 0) rows[idx] = created
          else rows.push(created)
          localSave(table, rows)
          return created
        } catch (err: unknown) {
          const msg = (err as Error).message || ''
          if (msg.includes('centre_name')) {
            try {
              const fallbackRow = { ...insertRow }
              delete fallbackRow.centre_name
              const { data, error } = await sb
                .from(table)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .insert(fallbackRow as never)
                .select('*')
                .single()
              if (!error && data) {
                const created = { ...data, centre_name: activeCentre } as T
                const rows = localAll<T>(table)
                const idx = rows.findIndex(r => r.id === created.id)
                if (idx >= 0) rows[idx] = created
                else rows.push(created)
                localSave(table, rows)
                return created
              }
            } catch {
              // fallback locally below
            }
          }
          console.warn(`[repo:${table}] Cloud create failed, safely falling back to device storage`, err)
          return saveLocally()
        }
      }

      return saveLocally()
    },

    async update(userId: string, id: string, patch: Partial<T>): Promise<T> {
      const activeCentre = getActiveCentreName()
      const sb = trySupabase()
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)

      const updateLocally = () => {
        const rows = localAll<T>(table)
        const idx = rows.findIndex(r => r.id === id && (isShared || r.user_id === userId))
        if (idx === -1) {
          const fallbackRow = {
            id,
            centre_name: activeCentre,
            user_id: userId,
            created_at: nowIso(),
            ...patch,
            updated_at: nowIso(),
          } as unknown as T
          rows.push(fallbackRow)
          localSave(table, rows)
          return fallbackRow
        }
        const next = { ...rows[idx], ...patch, updated_at: nowIso() } as T
        rows[idx] = next
        localSave(table, rows)
        return next
      }

      if (sb && (isUuid || isGlobal)) {
        try {
          let q = sb
            .from(table)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .update({ ...(patch as Record<string, unknown>), updated_at: nowIso() } as never)
            .eq('id', id)

          if (!isShared) {
            q = q.eq('user_id', userId)
          }

          const { data, error } = await q.select('*').single()
          if (!error && data) {
            const updated = data as T
            const rows = localAll<T>(table)
            const idx = rows.findIndex(r => r.id === id)
            if (idx >= 0) rows[idx] = updated
            else rows.push(updated)
            localSave(table, rows)
            return updated
          }
        } catch (err) {
          console.warn(`[repo:${table}] Cloud update failed, safely updating locally`, err)
          return updateLocally()
        }
      }

      return updateLocally()
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
  centres: 'centres',
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