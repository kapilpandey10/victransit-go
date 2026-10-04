import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'
import { useAdminStore } from './admin'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useAuthStore', () => {
  it('identifies Kapil Pandey as Master Director admin', async () => {
    const admin = useAdminStore()
    await admin.init()

    const auth = useAuthStore()
    await auth.init()

    auth.setDemoSession('info@pandeykapil.com.np')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isAdmin).toBe(true)
    expect(auth.isAuthorized).toBe(true)
    expect(auth.userRole).toBe('System Administrator')
    expect(auth.centreName).toBe('Platform Administrator')
    expect(auth.hasClassroomAccess).toBe(false)
  })

  it('identifies standard educator as not admin and assigns their centre group', async () => {
    const admin = useAdminStore()
    await admin.init()

    await admin.addTeacher({
      email: 'educator.jane@hadfield.edu.au',
      name: 'Jane',
      role: 'Educator',
      room: 'Dandelions',
      centre_name: 'Hadfield Early Learning Centre',
      password: 'EducatorPassword1!',
    })

    const auth = useAuthStore()
    await auth.init()

    auth.setDemoSession('educator.jane@hadfield.edu.au')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isAdmin).toBe(false)
    expect(auth.isAuthorized).toBe(true)
    expect(auth.centreName).toBe('Hadfield Early Learning Centre')
  })

  it('rejects public self-signup completely', async () => {
    const auth = useAuthStore()
    await auth.init()

    await expect(auth.signUp('stranger@gmail.com', 'password123', 'Stranger')).rejects.toThrow(
      'Self-signup is disabled',
    )
  })

  it('rejects sign in from an unauthorized email', async () => {
    const admin = useAdminStore()
    await admin.init()

    const auth = useAuthStore()
    await auth.init()

    await expect(auth.signIn('random.stranger@gmail.com', 'password123')).rejects.toThrow(
      'Access Denied',
    )
  })

  it('verifies Master-assigned password on login', async () => {
    const admin = useAdminStore()
    await admin.init()

    await admin.addTeacher({
      email: 'sarah@hadfield.edu.au',
      name: 'Sarah',
      role: 'Educator',
      room: 'Blossoms',
      centre_name: 'Hadfield Early Learning Centre',
      password: 'SecureEducator123!',
    })

    const auth = useAuthStore()
    await auth.init()

    // Wrong password for Sarah
    await expect(auth.signIn('sarah@hadfield.edu.au', 'WrongPassword!')).rejects.toThrow(
      'Incorrect password',
    )

    // Correct password for Sarah
    await auth.signIn('sarah@hadfield.edu.au', 'SecureEducator123!')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.displayName).toBe('Sarah')
  })

  it('signs out and clears user state', async () => {
    const auth = useAuthStore()
    await auth.init()

    auth.setDemoSession('info@pandeykapil.com.np')
    expect(auth.isAuthenticated).toBe(true)

    await auth.signOut()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
  })

  it('keeps educator logged in within the 7-day active window', async () => {
    const admin = useAdminStore()
    await admin.init()
    await admin.addTeacher({
      email: 'anna@hadfield.edu.au',
      name: 'Anna',
      role: 'Educator',
      room: 'Wattles',
      centre_name: 'Hadfield Early Learning Centre',
      password: 'Password123!',
    })

    const auth = useAuthStore()
    await auth.init()
    await auth.signIn('anna@hadfield.edu.au', 'Password123!')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.sessionDaysRemaining).toBeGreaterThanOrEqual(6)

    // Simulate opening the app on Day 3 (3 days elapsed):
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
    localStorage.setItem('hadfield:v1:last_active_at', String(threeDaysAgo))

    // Re-initialize auth store:
    const authNext = useAuthStore()
    await authNext.init()
    expect(authNext.isAuthenticated).toBe(true)
    expect(authNext.displayName).toBe('Anna')
  })

  it('logs educator out automatically if inactive for more than 7 days', async () => {
    const admin = useAdminStore()
    await admin.init()
    await admin.addTeacher({
      email: 'ben@hadfield.edu.au',
      name: 'Ben',
      role: 'Educator',
      room: 'Rosellas',
      centre_name: 'Hadfield Early Learning Centre',
      password: 'Password123!',
    })

    const auth = useAuthStore()
    await auth.init()
    await auth.signIn('ben@hadfield.edu.au', 'Password123!')
    expect(auth.isAuthenticated).toBe(true)

    // Simulate 8 days of total inactivity:
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000
    localStorage.setItem('hadfield:v1:last_active_at', String(eightDaysAgo))

    // Re-initialize auth store — should expire session:
    const authAfterEightDays = useAuthStore()
    await authAfterEightDays.init()
    expect(authAfterEightDays.isAuthenticated).toBe(false)
    expect(authAfterEightDays.user).toBeNull()
  })
})
