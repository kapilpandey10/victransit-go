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

export const useRoomsStore = defineStore('rooms', () => {
  const auth = useAuthStore()
  const rooms = ref<RoomRecord[]>([])
  const loading = ref(false)
  const initialised = ref(false)

  const scope = () => auth.scopeId

  const activeRooms = computed(() =>
    rooms.value
      .filter(r => r.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  )

  const roomNames = computed(() => {
    const names = activeRooms.value.map(r => r.name)
    return names.length > 0 ? names : Array.from(DEFAULT_ROOM_NAMES)
  })

  async function loadRooms() {
    loading.value = true
    try {
      const list = await roomsRepo.list(scope(), { orderBy: 'sort_order', ascending: true })
      if (list.length === 0) {
        // Seed default rooms
        const seeded: RoomRecord[] = []
        for (let i = 0; i < DEFAULT_ROOM_NAMES.length; i++) {
          const name = DEFAULT_ROOM_NAMES[i]
          const created = await roomsRepo.create(scope(), {
            name,
            description: `${name} room learning community`,
            sort_order: i,
            is_active: true,
          })
          seeded.push(created)
        }
        rooms.value = seeded
      } else {
        rooms.value = list
      }
      initialised.value = true
    } finally {
      loading.value = false
    }
  }

  async function addRoom(name: string, description = '') {
    const trimmed = name.trim()
    if (!trimmed) throw new Error('Room name is required.')

    const exists = rooms.value.some(
      r => r.name.toLowerCase() === trimmed.toLowerCase() && r.is_active !== false,
    )
    if (exists) throw new Error(`A room named "${trimmed}" already exists.`)

    const nextOrder = rooms.value.length
    const created = await roomsRepo.create(scope(), {
      name: trimmed,
      description: description.trim(),
      sort_order: nextOrder,
      is_active: true,
    })
    rooms.value = [...rooms.value, created]
    return created
  }

  async function updateRoom(id: string, patch: Partial<RoomRecord>) {
    if (patch.name) {
      patch.name = patch.name.trim()
      const conflict = rooms.value.some(
        r => r.id !== id && r.name.toLowerCase() === patch.name!.toLowerCase() && r.is_active !== false,
      )
      if (conflict) throw new Error(`Another room is already named "${patch.name}".`)
    }
    const updated = await roomsRepo.update(scope(), id, patch)
    rooms.value = rooms.value.map(r => (r.id === id ? updated : r))
    return updated
  }

  async function deleteRoom(id: string) {
    await roomsRepo.remove(scope(), id)
    rooms.value = rooms.value.filter(r => r.id !== id)
  }

  function getRoomByName(name: string): RoomRecord | undefined {
    return rooms.value.find(r => r.name.toLowerCase() === name.trim().toLowerCase())
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
  }
})
