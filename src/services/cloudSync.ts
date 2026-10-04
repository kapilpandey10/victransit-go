import { trySupabase } from './supabase'
import { readLocal } from './localStore'
import { TABLES, type BaseRecord } from './repo'

export interface SyncResult {
  total: number
  details: Record<string, number>
  errors: string[]
}

const SYNC_TABLES: Array<{ name: string; isGlobal?: boolean }> = [
  { name: TABLES.teacherAccess, isGlobal: true },
  { name: TABLES.rooms, isGlobal: true },
  { name: TABLES.topicStatuses, isGlobal: true },
  { name: TABLES.projects, isGlobal: false },
  { name: TABLES.mindmapNodes, isGlobal: false },
  { name: TABLES.learningStories, isGlobal: false },
  { name: TABLES.programAnalyses, isGlobal: false },
  { name: TABLES.weeklyWrapUps, isGlobal: false },
]

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function syncAllLocalDataToSupabase(): Promise<SyncResult> {
  const sb = trySupabase()
  if (!sb) {
    throw new Error('Supabase is not connected. Please connect Supabase first.')
  }

  const { data: sessionData } = await sb.auth.getSession()
  const activeUserId = sessionData.session?.user?.id

  const result: SyncResult = {
    total: 0,
    details: {},
    errors: [],
  }

  for (const item of SYNC_TABLES) {
    const table = item.name
    const isGlobal = Boolean(item.isGlobal)
    const localRows = readLocal<BaseRecord[]>(`table:${table}`, [])

    if (!localRows || localRows.length === 0) {
      result.details[table] = 0
      continue
    }

    let synced = 0
    for (const r of localRows) {
      try {
        const payload: Record<string, unknown> = { ...r }

        // Sanitize user_id
        if (typeof payload.user_id === 'string' && !UUID_REGEX.test(payload.user_id)) {
          if (activeUserId && UUID_REGEX.test(activeUserId)) {
            payload.user_id = activeUserId
          } else if (isGlobal) {
            delete payload.user_id
          } else {
            // Cannot insert user-scoped row without a valid UUID user
            continue
          }
        }

        // Sanitize id: If not valid UUID or text primary key
        if (
          table !== TABLES.mindmapNodes &&
          typeof payload.id === 'string' &&
          !UUID_REGEX.test(payload.id)
        ) {
          delete payload.id // Let Supabase gen_random_uuid()
        }

        const { error } = await sb.from(table).upsert(payload as never)
        if (error) {
          result.errors.push(`${table}: ${error.message}`)
        } else {
          synced++
        }
      } catch (err) {
        result.errors.push(`${table}: ${(err as Error).message}`)
      }
    }

    result.details[table] = synced
    result.total += synced
  }

  return result
}
