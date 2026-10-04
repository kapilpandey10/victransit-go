import { beforeEach, describe, expect, it } from 'vitest'
import { createRepo } from './repo'
import { writeLocal } from './localStore'

interface Widget {
  id: string
  user_id: string
  created_at: string
  updated_at: string
  name: string
  centre_name?: string
  project_id: string | null
}

const TABLE = 'spec_widgets'
const repo = createRepo<Widget>(TABLE)

beforeEach(() => {
  localStorage.clear()
})

describe('local repository (demo mode)', () => {
  it('creates, lists, updates and deletes records', async () => {
    const created = await repo.create('user-a', { name: 'One' })
    expect(created.id).toBeTruthy()
    expect(created.user_id).toBe('user-a')

    await repo.create('user-a', { name: 'Two' })
    await repo.create('user-b', { name: 'Other' })

    const mine = await repo.list('user-a')
    expect(mine.map(r => r.name).sort()).toEqual(['One', 'Two'])

    const updated = await repo.update('user-a', created.id, { name: 'One!' })
    expect(updated.name).toBe('One!')

    const single = await repo.get('user-a', created.id)
    expect(single?.name).toBe('One!')

    await repo.remove('user-a', created.id)
    expect(await repo.get('user-a', created.id)).toBeNull()
  })

  it('replaces child rows for a parent (mind-map autosave)', async () => {
    await repo.create('user-a', { name: 'Old', project_id: 'p1' })
    await repo.create('user-a', { name: 'Keep', project_id: 'p2' })

    const rows = await repo.replaceForParent('user-a', 'project_id', 'p1', [
      { name: 'New 1' },
      { name: 'New 2' },
    ])
    expect(rows).toHaveLength(2)

    const p1 = await repo.list('user-a', { where: { project_id: 'p1' } })
    expect(p1.map(r => r.name).sort()).toEqual(['New 1', 'New 2'])

    const p2 = await repo.list('user-a', { where: { project_id: 'p2' } })
    expect(p2.map(r => r.name)).toEqual(['Keep'])
  })

  it('scopes rows to the owning user for normal repos', async () => {
    const created = await repo.create('user-a', { name: 'Secret' })
    expect(await repo.get('user-b', created.id)).toBeNull()
  })

  it('allows all users to read and list from global repos', async () => {
    const globalRepo = createRepo<Widget>('spec_global_widgets', { isGlobal: true })
    const created = await globalRepo.create('user-director', { name: 'Dandelions Room' })

    // Other user can see it
    const all = await globalRepo.list('user-educator')
    expect(all.some(r => r.name === 'Dandelions Room')).toBe(true)

    const single = await globalRepo.get('user-educator', created.id)
    expect(single?.name).toBe('Dandelions Room')
  })

  it('enforces Centre Group isolation and protected collaboration for centreShared repos', async () => {
    const sharedRepo = createRepo<Widget>('spec_shared_stories', { centreShared: true })

    // Set active centre to Hadfield ELC
    writeLocal('profile', { centre_name: 'Hadfield Early Learning Centre' })

    // Educator A at Hadfield creates a story
    const hadfieldDoc = await sharedRepo.create('educator-a', {
      name: 'Pancakes with Lakshmi',
      centre_name: 'Hadfield Early Learning Centre',
    })

    // Educator B at Hadfield can see it
    const hadfieldList = await sharedRepo.list('educator-b')
    expect(hadfieldList.some(d => d.id === hadfieldDoc.id)).toBe(true)
    const hadfieldFetch = await sharedRepo.get('educator-b', hadfieldDoc.id)
    expect(hadfieldFetch?.name).toBe('Pancakes with Lakshmi')

    // Educator B can update it (collaborative compiling)
    const updated = await sharedRepo.update('educator-b', hadfieldDoc.id, {
      name: 'Pancakes with Lakshmi (Edited by Jean)',
    })
    expect(updated.name).toBe('Pancakes with Lakshmi (Edited by Jean)')

    // Educator B CANNOT delete it (only original author or admin can delete)
    await expect(sharedRepo.remove('educator-b', hadfieldDoc.id, false)).rejects.toThrow(
      'Cannot delete: Educators in the same centre can view and update',
    )

    // Original author CAN delete it
    // Or Admin CAN delete it
    await expect(sharedRepo.remove('educator-b', hadfieldDoc.id, true)).resolves.toBeUndefined()

    // Now test isolation across different Centre Groups:
    const doc2 = await sharedRepo.create('educator-a', {
      name: 'Clay Sculpting',
      centre_name: 'Hadfield Early Learning Centre',
    })

    // Switch active user to an educator at Coburg Childrens Centre
    writeLocal('profile', { centre_name: 'Coburg Childrens Centre' })

    // Educator at Coburg CANNOT see Hadfield's document
    const coburgList = await sharedRepo.list('educator-coburg')
    expect(coburgList.some(d => d.id === doc2.id)).toBe(false)

    const coburgFetch = await sharedRepo.get('educator-coburg', doc2.id)
    expect(coburgFetch).toBeNull()
  })
})