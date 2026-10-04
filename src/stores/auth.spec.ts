import { beforeEach, describe, expect, it } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useAuthStore } from './auth'
import { useAdminStore } from './admin'

beforeEach(() => {
  localStorage.clear()
  setActivePinia(createPinia())
})

describe('useAuthStore', () => {
  it('identifies Kapil Pandey as admin', async () => {
    const admin = useAdminStore()
    await admin.init()

    const auth = useAuthStore()
    await auth.init()

    auth.setDemoSession('kapilpandey@hadfield.edu.au')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isAdmin).toBe(true)
    expect(auth.isAuthorized).toBe(true)
    expect(auth.centreName).toBe('Hadfield Early Learning Centre')
  })

  it('identifies standard educator as not admin and assigns their centre group', async () => {
    const admin = useAdminStore()
    await admin.init()

    const auth = useAuthStore()
    await auth.init()

    auth.setDemoSession('lakshmi@hadfield.edu.au')
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

    const auth = useAuthStore()
    await auth.init()

    // Wrong password for Lakshmi
    await expect(auth.signIn('lakshmi@hadfield.edu.au', 'WrongPassword!')).rejects.toThrow(
      'Incorrect password',
    )

    // Correct password for Lakshmi
    await auth.signIn('lakshmi@hadfield.edu.au', 'Educator2026!')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.displayName).toBe('Lakshmi')
  })

  it('signs out and clears user state', async () => {
    const auth = useAuthStore()
    await auth.init()

    auth.setDemoSession('kapilpandey@hadfield.edu.au')
    expect(auth.isAuthenticated).toBe(true)

    await auth.signOut()
    expect(auth.isAuthenticated).toBe(false)
    expect(auth.user).toBeNull()
  })
})
