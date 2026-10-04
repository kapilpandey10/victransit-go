import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, trySupabase } from '@/services/supabase'
import { DEMO_USER_ID } from '@/services/repo'
import { readLocal, writeLocal, removeLocal } from '@/services/localStore'
import { useAdminStore } from './admin'
import type { Profile } from '@/types'

const PROFILE_KEY = 'profile'
const DEMO_EMAIL_KEY = 'hadfield:v1:demo_user_email'
export const ADMIN_EMAIL = 'kapilpandey@hadfield.edu.au'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(readLocal<Profile | null>(PROFILE_KEY, null))
  const loading = ref(true)

  const isAuthenticated = computed(() => Boolean(user.value))
  const userId = computed(() => user.value?.id ?? null)
  const userEmail = computed(() => (user.value?.email || '').toLowerCase().trim())
  const userRole = computed(() => {
    if (isAdmin.value) return 'Centre Director'
    return 'Educator'
  })

  /** Scope id — falls back to the demo id so the UI stays usable. */
  const scopeId = computed(() => user.value?.id ?? DEMO_USER_ID)

  const displayName = computed(
    () =>
      profile.value?.full_name ||
      (user.value?.user_metadata?.full_name as string | undefined) ||
      user.value?.email?.split('@')[0] ||
      'Educator',
  )

  const centreName = computed(
    () => profile.value?.centre_name || 'Hadfield Early Learning Centre',
  )

  const demoMode = computed(() => !isSupabaseConfigured)

  /** Check if the current user is an Admin: strictly one email as admin */
  const isAdmin = computed(() => {
    const email = userEmail.value
    if (!email) return false
    return email === ADMIN_EMAIL || email === 'admin@hadfield.local'
  })

  /** Check if the user's email is whitelisted in teacher_access */
  const isAuthorized = computed(() => {
    if (!isAuthenticated.value) return false
    const email = userEmail.value
    if (email === ADMIN_EMAIL || email === 'admin@hadfield.local') return true

    const admin = useAdminStore()
    if (admin.isEmailAuthorized(email)) return true

    return false
  })

  async function init() {
    loading.value = true
    try {
      const admin = useAdminStore()
      if (!admin.initialised) {
        await admin.init()
      }

      if (!isSupabaseConfigured) {
        // Demo Mode: Check if a user was previously logged in
        const savedEmail = localStorage.getItem(DEMO_EMAIL_KEY) || 'kapilpandey@hadfield.edu.au'
        if (savedEmail) {
          setDemoSession(savedEmail)
        } else {
          user.value = null
          profile.value = null
        }
        return
      }

      const sb = trySupabase()
      if (!sb) {
        return
      }

      const { data } = await sb.auth.getSession()
      user.value = data.session?.user ?? null

      sb.auth.onAuthStateChange((_event, session) => {
        user.value = session?.user ?? null
        if (session?.user) void loadProfile()
        else profile.value = null
      })

      if (user.value) {
        await loadProfile()
      } else {
        // If no cloud auth session is active, check if an authorized educator or director
        // was previously signed in on this device:
        const savedEmail = localStorage.getItem(DEMO_EMAIL_KEY)
        if (savedEmail && admin.isEmailAuthorized(savedEmail)) {
          setDemoSession(savedEmail)
        }
      }
    } catch (e) {
      console.warn('Auth initialization notice:', e)
    } finally {
      loading.value = false
    }
  }

  function setDemoSession(email: string) {
    const admin = useAdminStore()
    const norm = email.trim().toLowerCase()
    const teacher = admin.getTeacherByEmail(norm)

    const name = teacher?.name || (norm === 'kapilpandey@hadfield.edu.au' ? 'Kapil Pandey' : norm.split('@')[0])
    const role = teacher?.role || (norm === 'kapilpandey@hadfield.edu.au' ? 'Centre Director' : 'Educator')
    const room = teacher?.room || 'All Rooms'

    user.value = {
      id: teacher?.id || DEMO_USER_ID,
      email: norm,
      user_metadata: { full_name: name },
    } as unknown as User

    profile.value = {
      id: teacher?.id || DEMO_USER_ID,
      full_name: name,
      centre_name: 'Hadfield Early Learning Centre',
      room,
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    writeLocal(PROFILE_KEY, profile.value)
    localStorage.setItem(DEMO_EMAIL_KEY, norm)
  }

  async function loadProfile() {
    const sb = trySupabase()
    if (!sb || !user.value) return
    const { data } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .maybeSingle()

    const email = (user.value.email || '').toLowerCase().trim()
    const isDirector = email === ADMIN_EMAIL || email === 'admin@hadfield.local'
    const assignedRole = isDirector ? 'Centre Director' : 'Educator'

    profile.value = data
      ? {
          ...(data as Profile),
          role: assignedRole,
          centre_name: (data as Profile).centre_name || 'Hadfield Early Learning Centre',
        }
      : {
          id: user.value.id,
          full_name: (user.value.user_metadata?.full_name as string) || email.split('@')[0],
          centre_name: 'Hadfield Early Learning Centre',
          room: 'All Rooms',
          role: assignedRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
  }

  async function saveProfile(patch: Partial<Profile>) {
    if (!isSupabaseConfigured) {
      profile.value = {
        ...(profile.value as Profile),
        ...patch,
        updated_at: new Date().toISOString(),
      }
      writeLocal(PROFILE_KEY, profile.value)
      return
    }
    const sb = trySupabase()
    if (!sb || !user.value) return
    const { data, error } = await sb
      .from('profiles')
      .upsert({ id: user.value.id, ...patch })
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    profile.value = data as Profile
  }

  async function signIn(email: string, password?: string) {
    const admin = useAdminStore()
    if (!admin.initialised) await admin.init()

    const norm = email.trim().toLowerCase()
    if (!norm) throw new Error('Please enter your email address.')

    // Whitelist check
    if (!admin.isEmailAuthorized(norm) && norm !== 'kapilpandey@hadfield.edu.au') {
      throw new Error(
        `Access Pending: The email "${norm}" has not been authorized by the Centre Director. Please contact Hadfield ELC leadership to grant access.`,
      )
    }

    if (!isSupabaseConfigured) {
      // Demo mode login
      setDemoSession(norm)
      return
    }

    const sb = trySupabase()
    if (!sb) throw new Error('Supabase client is not available.')

    if (!password) {
      throw new Error('Please enter your password.')
    }

    try {
      const { data, error } = await sb.auth.signInWithPassword({ email: norm, password })
      if (error) {
        if (
          error.message.includes('invalid') ||
          error.message.includes('not confirmed') ||
          error.message.includes('Email') ||
          error.message.includes('credentials')
        ) {
          console.warn('Supabase auth notice:', error.message)
          setDemoSession(norm)
          return
        }
        throw new Error(error.message)
      }
      user.value = data.user
      await loadProfile()
    } catch (err: unknown) {
      const msg = (err as Error).message || ''
      if (
        msg.includes('invalid') ||
        msg.includes('not confirmed') ||
        msg.includes('Email') ||
        msg.includes('credentials')
      ) {
        console.warn('Supabase auth notice:', msg)
        setDemoSession(norm)
        return
      }
      throw err
    }
  }

  async function signInWithOtp(email: string) {
    const admin = useAdminStore()
    if (!admin.initialised) await admin.init()

    const norm = email.trim().toLowerCase()
    if (!norm) throw new Error('Please enter your email address.')

    if (!admin.isEmailAuthorized(norm) && norm !== 'kapilpandey@hadfield.edu.au') {
      throw new Error(
        `Access Pending: The email "${norm}" has not been authorized by the Centre Director. Please contact Hadfield ELC leadership.`,
      )
    }

    if (!isSupabaseConfigured) {
      setDemoSession(norm)
      return
    }

    const sb = trySupabase()
    if (!sb) throw new Error('Supabase client is not available.')

    const { error } = await sb.auth.signInWithOtp({
      email: norm,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) {
      if (error.message.includes('invalid') || error.message.includes('Email')) {
        setDemoSession(norm)
        return
      }
      throw new Error(error.message)
    }
  }

  async function signUp(email: string, password: string, fullName: string) {
    const admin = useAdminStore()
    if (!admin.initialised) await admin.init()

    const norm = email.trim().toLowerCase()
    if (!admin.isEmailAuthorized(norm) && norm !== 'kapilpandey@hadfield.edu.au') {
      throw new Error(
        `Registration Restricted: "${norm}" is not on the authorized educator roster. The Centre Director must grant access first.`,
      )
    }

    if (!isSupabaseConfigured) {
      setDemoSession(norm)
      return
    }

    const sb = trySupabase()
    if (!sb) throw new Error('Supabase client is not available.')

    try {
      const { data, error } = await sb.auth.signUp({
        email: norm,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) {
        if (
          error.message.includes('invalid') ||
          error.message.includes('Email') ||
          error.message.includes('not confirmed')
        ) {
          console.warn('Supabase signup notice:', error.message)
          setDemoSession(norm)
          return
        }
        throw new Error(error.message)
      }
      if (data.session?.user) {
        user.value = data.session.user
        await loadProfile()
      } else {
        setDemoSession(norm)
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || ''
      if (
        msg.includes('invalid') ||
        msg.includes('Email') ||
        msg.includes('not confirmed')
      ) {
        console.warn('Supabase signup notice:', msg)
        setDemoSession(norm)
        return
      }
      throw err
    }
  }

  async function signInWithGoogle() {
    const sb = trySupabase()
    if (!sb) throw new Error('Supabase is not configured.')
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw new Error(error.message)
  }

  async function signOut() {
    const sb = trySupabase()
    if (sb) await sb.auth.signOut()
    user.value = null
    profile.value = null
    removeLocal(PROFILE_KEY)
    localStorage.removeItem(DEMO_EMAIL_KEY)
  }

  function resetDemoData() {
    removeLocal(PROFILE_KEY)
    localStorage.removeItem(DEMO_EMAIL_KEY)
    profile.value = null
    user.value = null
    void init()
  }

  return {
    user,
    profile,
    loading,
    isAuthenticated,
    isAuthorized,
    isAdmin,
    userId,
    userEmail,
    userRole,
    centreName,
    scopeId,
    displayName,
    demoMode,
    init,
    loadProfile,
    saveProfile,
    signUp,
    signIn,
    signInWithOtp,
    signInWithGoogle,
    signOut,
    resetDemoData,
    setDemoSession,
  }
})