import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRoomsStore, DEFAULT_ROOM_NAMES } from './rooms'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useRoomsStore', () => {
  it('seeds default rooms on first load', async () => {
    const store = useRoomsStore()
    await store.loadRooms()

    expect(store.rooms.length).toBe(DEFAULT_ROOM_NAMES.length)
    expect(store.roomNames).toContain('Dandelions')
    expect(store.roomNames).toContain('Blossoms')
  })

  it('adds a new custom room', async () => {
    const store = useRoomsStore()
    await store.loadRooms()

    const created = await store.addRoom('Sunflowers', '3-year old kindergarten room')
    expect(created.name).toBe('Sunflowers')
    expect(store.roomNames).toContain('Sunflowers')

    // Disallow duplicate names
    await expect(store.addRoom('Sunflowers')).rejects.toThrow('already exists')
  })

  it('updates an existing room', async () => {
    const store = useRoomsStore()
    await store.loadRooms()

    const first = store.rooms[0]
    await store.updateRoom(first.id, { name: 'Little Explorers' })

    expect(store.roomNames).toContain('Little Explorers')
    expect(store.roomNames).not.toContain(first.name)
  })

  it('deletes a room', async () => {
    const store = useRoomsStore()
    await store.loadRooms()

    const initialCount = store.rooms.length
    const target = store.rooms[0]
    await store.deleteRoom(target.id)

    expect(store.rooms.length).toBe(initialCount - 1)
    expect(store.roomNames).not.toContain(target.name)
  })

  it('deduplicates room names when duplicate records exist', async () => {
    const store = useRoomsStore()
    await store.loadRooms()

    // Add a duplicate room record with a different ID (e.g. cloud vs local duplicate)
    store.rooms = [
      ...store.rooms,
      {
        id: 'dup-cloud-blossoms',
        user_id: '',
        centre_name: 'Hadfield Early Learning Centre',
        name: 'Blossoms',
        description: 'Duplicate Blossoms',
        sort_order: 0,
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]

    const count = store.roomNames.filter(n => n.toLowerCase() === 'blossoms').length
    expect(count).toBe(1)
  })
})
