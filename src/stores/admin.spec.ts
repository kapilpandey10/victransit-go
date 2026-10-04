import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAdminStore } from './admin'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useAdminStore', () => {
  it('initialises with Master Director, centre groups, and topics', async () => {
    const admin = useAdminStore()
    await admin.init()

    expect(admin.teachers.length).toBeGreaterThanOrEqual(1)
    expect(admin.topicStatuses.length).toBeGreaterThanOrEqual(8)
    expect(admin.centreGroups).toContain('Hadfield Early Learning Centre')

    const kapil = admin.teachers.find(t => t.email === 'info@pandeykapil.com.np')
    expect(kapil).toBeDefined()
    expect(kapil?.role).toBe('System Administrator')
    expect(kapil?.centre_name).toBe('Platform Administration')
    expect(admin.systemStats.totalCentres).toBeGreaterThanOrEqual(1)

    const storiesTopic = admin.getTopic('learning-stories')
    expect(storiesTopic).toBeDefined()
    expect(storiesTopic?.status).toBe('active')
  })

  it('adds and updates teacher email access with centre group and password', async () => {
    const admin = useAdminStore()
    await admin.init()

    const newTeacher = await admin.addTeacher({
      email: 'anna@sunshineelc.edu.au',
      name: 'Anna Smith',
      role: 'Educator',
      room: 'Sunflowers',
      centre_name: 'Sunshine Early Learning Centre',
      password: 'SunshinePass2026!',
      status: 'active',
      notes: 'New educator for Sunshine centre branch',
    })

    expect(newTeacher.email).toBe('anna@sunshineelc.edu.au')
    expect(newTeacher.centre_name).toBe('Sunshine Early Learning Centre')
    expect(newTeacher.password).toBe('SunshinePass2026!')
    expect(admin.centreGroups).toContain('Sunshine Early Learning Centre')

    // Updating status and room
    await admin.updateTeacher(newTeacher.id, {
      room: 'Bluebells',
      password: 'UpdatedSecret2026!',
    })
    const updated = admin.teachers.find(t => t.id === newTeacher.id)
    expect(updated?.room).toBe('Bluebells')
    expect(updated?.password).toBe('UpdatedSecret2026!')

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
