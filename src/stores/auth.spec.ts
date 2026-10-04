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
  })

  it('identifies standard educator as not admin', async () => {
    const admin = useAdminStore()
    await admin.init()

    const auth = useAuthStore()
    await auth.init()

    auth.setDemoSession('lakshmi@hadfield.edu.au')
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.isAdmin).toBe(false)
    expect(auth.isAuthorized).toBe(true)
  })

  it('rejects sign in from an unauthorized email', async () => {
    const admin = useAdminStore()
    await admin.init()

    const auth = useAuthStore()
    await auth.init()

    await expect(auth.signIn('random.stranger@gmail.com', 'password123')).rejects.toThrow(
      'not been authorized',
    )
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
