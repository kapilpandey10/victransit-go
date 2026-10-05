import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createRepo, TABLES } from '@/services/repo'
import { useAuthStore } from './auth'
import type { RoomRecord } from '@/types'

const roomsRepo = createRepo<RoomRecord>(TABLES.rooms, { isGlobal: true })

export const DEFAULT_ROOM_NAMES = [
  'Blossoms',
  'Sweet Peas',
  'Chamomiles',
  'Dandelions',
  'Butter Beans',
  'Rosellas',
  'Wattles',
] as const

export const DEFAULT_ROOM_RECORDS: RoomRecord[] = DEFAULT_ROOM_NAMES.map((name, i) => ({
  id: `default-room-${i}`,
  user_id: '',
  centre_name: 'Hadfield Early Learning Centre',
  name,
  description: `${name} room learning community`,
  sort_order: i,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}))

export const useRoomsStore = defineStore('rooms', () => {
  const auth = useAuthStore()
  const rooms = ref<RoomRecord[]>([...DEFAULT_ROOM_RECORDS])
  const loading = ref(false)
  const initialised = ref(false)

  const scope = () => auth.scopeId

  const activeRooms = computed(() => {
    const list = rooms.value
      .filter(r => r.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

    const map = new Map<string, RoomRecord>()
    for (const r of list) {
      const c = (r.centre_name || 'Hadfield Early Learning Centre').toLowerCase().trim()
      const n = (r.name || '').toLowerCase().trim()
      const key = `${c}::${n}`
      if (!map.has(key)) {
        map.set(key, r)
      } else {
        const existing = map.get(key)!
        // If existing is default-room-* but r is a real record, prefer r
        if (existing.id.startsWith('default-room-') && !r.id.startsWith('default-room-')) {
          map.set(key, r)
        }
      }
    }
    return Array.from(map.values())
  })

  const roomNames = computed(() => {
    const activeCentre =
      auth.centreName && auth.centreName !== 'Platform Administrator'
        ? auth.centreName.toLowerCase().trim()
        : 'hadfield early learning centre'
    const centreRooms = activeRooms.value.filter(
      r => !r.centre_name || r.centre_name.toLowerCase().trim() === activeCentre,
    )
    const seen = new Set<string>()
    const names: string[] = []
    for (const r of centreRooms) {
      const trimmed = r.name?.trim()
      if (trimmed && !seen.has(trimmed.toLowerCase())) {
        seen.add(trimmed.toLowerCase())
        names.push(trimmed)
      }
    }
    return names.length > 0 ? names : Array.from(DEFAULT_ROOM_NAMES)
  })

  function getRoomsForCentre(centreName: string): RoomRecord[] {
    const norm = centreName.toLowerCase().trim()
    return activeRooms.value.filter(
      r => !r.centre_name || r.centre_name.toLowerCase().trim() === norm,
    )
  }

  function getRoomNamesForCentre(centreName: string): string[] {
    const list = getRoomsForCentre(centreName).map(r => r.name?.trim()).filter(Boolean)
    const seen = new Set<string>()
    const unique = list.filter(n => {
      const lower = n.toLowerCase()
      if (seen.has(lower)) return false
      seen.add(lower)
      return true
    })
    if (unique.length > 0) return unique
    if (centreName.toLowerCase().includes('hadfield')) return Array.from(DEFAULT_ROOM_NAMES)
    return []
  }

  async function loadRooms() {
    loading.value = true
    try {
      const list = await roomsRepo.list(scope(), { orderBy: 'sort_order', ascending: true })
      if (list.length === 0) {
        // Try remote seed if permitted
        try {
          const seeded: RoomRecord[] = []
          for (let i = 0; i < DEFAULT_ROOM_NAMES.length; i++) {
            const name = DEFAULT_ROOM_NAMES[i]
            const created = await roomsRepo.create(scope(), {
              centre_name: 'Hadfield Early Learning Centre',
              name,
              description: `${name} room learning community`,
              sort_order: i,
              is_active: true,
            })
            seeded.push(created)
          }
          if (seeded.length > 0) rooms.value = seeded
        } catch {
          // If RLS prevents anonymous seeding, retain built-in defaults
        }
      } else {
        // Deduplicate rows by centre + room name
        const map = new Map<string, RoomRecord>()
        for (const r of list) {
          const c = (r.centre_name || 'Hadfield Early Learning Centre').toLowerCase().trim()
          const n = (r.name || '').toLowerCase().trim()
          const key = `${c}::${n}`
          if (!map.has(key)) {
            map.set(key, r)
          } else {
            const existing = map.get(key)!
            if (existing.id.startsWith('default-room-') && !r.id.startsWith('default-room-')) {
              map.set(key, r)
            }
          }
        }
        rooms.value = Array.from(map.values())
      }
      initialised.value = true
    } catch {
      // Retain defaults if remote query fails
      initialised.value = true
    } finally {
      loading.value = false
    }
  }

  async function addRoom(
    name: string,
    centreOrDescription = 'Hadfield Early Learning Centre',
    optionalDescription = '',
  ) {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Room name is required.')

    let targetCentre = 'Hadfield Early Learning Centre'
    let targetDesc = ''

    if (optionalDescription) {
      targetCentre = centreOrDescription.trim() || 'Hadfield Early Learning Centre'
      targetDesc = optionalDescription.trim()
    } else if (
      centreOrDescription.toLowerCase().includes('centre') ||
      centreOrDescription.toLowerCase().includes('school') ||
      centreOrDescription.toLowerCase().includes('elc')
    ) {
      targetCentre = centreOrDescription.trim()
      targetDesc = ''
    } else {
      targetCentre =
        auth.centreName && auth.centreName !== 'Platform Administrator'
          ? auth.centreName.trim()
          : 'Hadfield Early Learning Centre'
      targetDesc = centreOrDescription.trim()
    }

    const exists = rooms.value.some(
      r =>
        (r.centre_name || 'Hadfield Early Learning Centre').toLowerCase().trim() ===
          targetCentre.toLowerCase().trim() &&
        r.name.toLowerCase() === trimmed.toLowerCase() &&
        r.is_active !== false,
    )
    if (exists) throw new Error(`A room named "${trimmed}" already exists in ${targetCentre}.`)

    const nextOrder = rooms.value.filter(
      r => (r.centre_name || 'Hadfield Early Learning Centre').toLowerCase() === targetCentre.toLowerCase(),
    ).length
    const created = await roomsRepo.create(scope(), {
      name: trimmed,
      centre_name: targetCentre,
      description: targetDesc,
      sort_order: nextOrder,
      is_active: true,
    })
    rooms.value = [...rooms.value, created]
    return created
  }

  async function updateRoom(id: string, patch: Partial<RoomRecord>) {
    if (patch.name) {
      patch.name = patch.name.trim()
      const target = rooms.value.find(r => r.id === id)
      const targetCentre = (patch.centre_name || target?.centre_name || 'Hadfield Early Learning Centre').toLowerCase().trim()
      const conflict = rooms.value.some(
        r =>
          r.id !== id &&
          (r.centre_name || 'Hadfield Early Learning Centre').toLowerCase().trim() === targetCentre &&
          r.name.toLowerCase() === patch.name!.toLowerCase() &&
          r.is_active !== false,
      )
      if (conflict) throw new Error(`Another room is already named "${patch.name}" in this centre.`)
    }
    const updated = await roomsRepo.update(scope(), id, patch)
    rooms.value = rooms.value.map(r => (r.id === id ? updated : r))
    return updated
  }

  async function deleteRoom(id: string) {
    await roomsRepo.remove(scope(), id)
    rooms.value = rooms.value.filter(r => r.id !== id)
  }

  function getRoomByName(name: string, centreName?: string): RoomRecord | undefined {
    const normName = name.trim().toLowerCase()
    if (centreName) {
      const normCentre = centreName.trim().toLowerCase()
      return rooms.value.find(
        r =>
          (r.centre_name || 'Hadfield Early Learning Centre').toLowerCase().trim() === normCentre &&
          r.name.toLowerCase() === normName,
      )
    }
    return rooms.value.find(r => r.name.toLowerCase() === normName)
  }

  return {
    rooms,
    activeRooms,
    roomNames,
    loading,
    initialised,
    loadRooms,
    addRoom,
    updateRoom,
    deleteRoom,
    getRoomByName,
    getRoomsForCentre,
    getRoomNamesForCentre,
  }
})
