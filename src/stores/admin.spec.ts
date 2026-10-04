import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdminStore } from './admin'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useAdminStore', () => {
  it('initialises with default teachers and topics', async () => {
    const admin = useAdminStore()
    await admin.init()

    expect(admin.teachers.length).toBeGreaterThanOrEqual(6)
    expect(admin.topicStatuses.length).toBeGreaterThanOrEqual(8)

    const kapil = admin.teachers.find(t => t.email === 'kapilpandey@hadfield.edu.au')
    expect(kapil).toBeDefined()
    expect(kapil?.role).toBe('Centre Director')

    const storiesTopic = admin.getTopic('learning-stories')
    expect(storiesTopic).toBeDefined()
    expect(storiesTopic?.status).toBe('active')
  })

  it('adds and updates teacher email access', async () => {
    const admin = useAdminStore()
    await admin.init()

    const newTeacher = await admin.addTeacher({
      email: 'new.teacher@hadfield.edu.au',
      name: 'New Educator',
      role: 'Educator',
      room: 'Chamomiles',
      status: 'invited',
      notes: 'Starting term 2',
    })

    expect(newTeacher.email).toBe('new.teacher@hadfield.edu.au')
    expect(admin.teachers.some(t => t.id === newTeacher.id)).toBe(true)

    // Updating status to active
    await admin.setTeacherStatus(newTeacher.id, 'active')
    const updated = admin.teachers.find(t => t.id === newTeacher.id)
    expect(updated?.status).toBe('active')
    expect(updated?.last_active_at).toBeDefined()

    // Deleting teacher
    await admin.deleteTeacher(newTeacher.id)
    expect(admin.teachers.some(t => t.id === newTeacher.id)).toBe(false)
  })

  it('toggles topic status to under development and updates notes', async () => {
    const admin = useAdminStore()
    await admin.init()

    expect(admin.isTopicUnderDevelopment('learning-stories')).toBe(false)

    await admin.setTopicStatus(
      'learning-stories',
      'under_development',
      'Reviewing 1/4 A3 photo wrapper layout with educators.',
    )

    expect(admin.isTopicUnderDevelopment('learning-stories')).toBe(true)
    const topic = admin.getTopic('learning-stories')
    expect(topic?.leadership_notes).toContain('Reviewing 1/4 A3')

    // Reset back to active
    await admin.setTopicStatus('learning-stories', 'active')
    expect(admin.isTopicUnderDevelopment('learning-stories')).toBe(false)
  })
})
