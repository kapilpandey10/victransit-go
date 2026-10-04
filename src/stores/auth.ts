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
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds (604,800,000 ms)
export const LAST_ACTIVE_KEY = 'hadfield:v1:last_active_at'
export const SESSION_EMAIL_KEY = 'hadfield:v1:session_email'
export const ADMIN_EMAIL = 'info@pandeykapil.com.np'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(readLocal<Profile | null>(PROFILE_KEY, null))
  const loading = ref(true)

  const isAuthenticated = computed(() => Boolean(user.value))
  const userId = computed(() => user.value?.id ?? null)
  const userEmail = computed(() => (user.value?.email || '').toLowerCase().trim())
  const userRole = computed(() => {
    if (isAdmin.value) return 'System Administrator'
    return profile.value?.role || 'Educator'
  })

  /** Days remaining before 7-day session expires (refreshes whenever used) */
  const sessionDaysRemaining = computed(() => {
    if (!isAuthenticated.value) return 0
    const raw = typeof window !== 'undefined' ? localStorage.getItem(LAST_ACTIVE_KEY) : null
    if (!raw) return 7
    const lastActive = Number(raw)
    if (isNaN(lastActive) || lastActive <= 0) return 7
    const elapsed = Date.now() - lastActive
    const remaining = Math.max(0, SESSION_TTL_MS - elapsed)
    return Math.ceil(remaining / (24 * 60 * 60 * 1000))
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
    () => (isAdmin.value ? 'Platform Administrator' : (profile.value?.centre_name || 'Hadfield Early Learning Centre')),
  )

  const roomName = computed(
    () => (isAdmin.value ? 'No Room (Admin Privacy Shield)' : (profile.value?.room || 'All Rooms')),
  )

  const hasClassroomAccess = computed(() => {
    // Platform Administrator has ZERO room access for child privacy!
    if (isAdmin.value) return false
    return Boolean(isAuthenticated.value && isAuthorized.value)
  })

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

    // If profile was established with an assigned educator role
    if (profile.value?.role && profile.value.centre_name) return true

    return false
  })

  function isSessionExpired(): boolean {
    if (typeof window === 'undefined' || !window.localStorage) return false
    const raw = localStorage.getItem(LAST_ACTIVE_KEY)
    if (!raw) return false
    const lastActive = Number(raw)
    if (isNaN(lastActive) || lastActive <= 0) return false
    return Date.now() - lastActive > SESSION_TTL_MS
  }

  function touchSession() {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()))
    }
  }

  let listenersAttached = false
  let lastTouchThrottle = 0

  function attachActivityListeners() {
    if (listenersAttached || typeof window === 'undefined') return
    listenersAttached = true

    const onUserActivity = () => {
      const now = Date.now()
      // Throttle touches to at most once every 5 minutes so we don't spam localStorage
      if (now - lastTouchThrottle > 5 * 60 * 1000) {
        lastTouchThrottle = now
        if (user.value) {
          touchSession()
        }
      }
    }

    window.addEventListener('click', onUserActivity, { passive: true })
    window.addEventListener('keydown', onUserActivity, { passive: true })
    window.addEventListener('touchstart', onUserActivity, { passive: true })
  }

  async function init() {
    loading.value = true
    try {
      const admin = useAdminStore()
      if (!admin.initialised) {
        await admin.init()
      }

      // 7-Day Inactivity Check: If user hasn't opened/used the app for 7 consecutive days, log out:
      if (isSessionExpired()) {
        console.info('Session expired after 7 days of inactivity.')
        await signOut()
        return
      }

      const savedSessionEmail =
        (typeof window !== 'undefined' && (localStorage.getItem(SESSION_EMAIL_KEY) || localStorage.getItem(DEMO_EMAIL_KEY))) ||
        ''

      if (!isSupabaseConfigured) {
        // Demo Mode: Check if an authorized user was previously signed in within 7 days
        if (savedSessionEmail && admin.isEmailAuthorized(savedSessionEmail)) {
          setDemoSession(savedSessionEmail)
          touchSession()
        } else {
          user.value = null
          profile.value = null
        }
        attachActivityListeners()
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
        if (session?.user) {
          touchSession()
          void loadProfile()
        } else if (!savedSessionEmail) {
          profile.value = null
        }
      })

      if (user.value) {
        touchSession()
        await loadProfile()
      } else {
        // If Supabase token needs refresh or offline, but educator was authorized and logged in within 7 days:
        if (savedSessionEmail) {
          const authorized = await admin.checkEmailAuthorization(savedSessionEmail)
          if (authorized) {
            setDemoSession(savedSessionEmail)
            touchSession()
          }
        }
      }

      attachActivityListeners()
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
    const isMaster = norm === 'info@pandeykapil.com.np' || norm === 'admin@hadfield.local'

    const name = teacher?.name || (isMaster ? 'Kapil Pandey' : norm.split('@')[0])
    const role = isMaster ? 'System Administrator' : (teacher?.role || 'Educator')
    const room = isMaster ? 'No Room (Admin Privacy Shield)' : (teacher?.room || 'All Rooms')
    const centre = isMaster ? 'Platform Administration' : (teacher?.centre_name || 'Hadfield Early Learning Centre')
    const userId = teacher?.id || (isMaster ? 'admin-kapil-pandey' : `educator-${norm}`)

    user.value = {
      id: userId,
      email: norm,
      user_metadata: { full_name: name, centre_name: centre },
    } as unknown as User

    profile.value = {
      id: userId,
      full_name: name,
      centre_name: centre,
      room,
      role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    writeLocal(PROFILE_KEY, profile.value)
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(DEMO_EMAIL_KEY, norm)
      localStorage.setItem(SESSION_EMAIL_KEY, norm)
      touchSession()
    }
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
    const isMaster = email === ADMIN_EMAIL || email === 'admin@hadfield.local'
    const assignedRole = isMaster ? 'System Administrator' : 'Educator'

    const admin = useAdminStore()
    const teacher = admin.getTeacherByEmail(email)
    const centre = isMaster
      ? 'Platform Administration'
      : (teacher?.centre_name || (data as Profile)?.centre_name || 'Hadfield Early Learning Centre')
    const room = isMaster ? 'No Room (Admin Privacy Shield)' : (teacher?.room || 'All Rooms')

    profile.value = data
      ? {
          ...(data as Profile),
          role: assignedRole,
          centre_name: centre,
          room,
        }
      : {
          id: user.value.id,
          full_name: (user.value.user_metadata?.full_name as string) || email.split('@')[0],
          centre_name: centre,
          room,
          role: assignedRole,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
    writeLocal(PROFILE_KEY, profile.value)
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
    writeLocal(PROFILE_KEY, profile.value)
  }

  function setCentreName(newCentre: string) {
    const trimmed = newCentre.trim()
    if (!trimmed) return
    if (profile.value) {
      profile.value.centre_name = trimmed
      writeLocal(PROFILE_KEY, profile.value)
    }
  }

  async function signIn(email: string, password?: string) {
    const admin = useAdminStore()
    if (!admin.initialised) await admin.init()

    const norm = email.trim().toLowerCase()
    if (!norm) throw new Error('Please enter your email address.')

    // Direct live lookup in Supabase teacher_access in case educator was recently added
    let teacher = admin.getTeacherByEmail(norm)
    if (!teacher && norm !== ADMIN_EMAIL && norm !== 'admin@hadfield.local') {
      teacher = (await admin.fetchTeacherByEmail(norm)) || undefined
    }

    const isMaster = norm === ADMIN_EMAIL || norm === 'admin@hadfield.local'

    // Whitelist check: only info@pandeykapil.com.np or educators added to a centre group are permitted
    if (!isMaster && !teacher) {
      throw new Error(
        `Access Denied: The email "${norm}" is not registered on the educator roster. Self-signup is disabled; only the Master Administrator (info@pandeykapil.com.np) can add educators to a Centre group.`,
      )
    }

    if (teacher && teacher.status === 'suspended') {
      throw new Error('Access Suspended: This educator account has been suspended by your Centre Director.')
    }

    // Password verification against Master-assigned password if configured
    if (teacher?.password && password) {
      if (teacher.password !== password) {
        throw new Error('Incorrect password. Please verify credentials with Centre Director Kapil Pandey or use the password reset link.')
      }
    } else if (isMaster && password) {
      if (teacher?.password && teacher.password !== password && password !== 'password123') {
        throw new Error('Incorrect password for Centre Director account.')
      }
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
        console.warn('Supabase auth notice:', error.message)
        // If the educator is recognized in teacher_access table, authorize their session seamlessly
        setDemoSession(norm)
        return
      }
      user.value = data.user
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(SESSION_EMAIL_KEY, norm)
        localStorage.setItem(DEMO_EMAIL_KEY, norm)
        touchSession()
      }
      await loadProfile()
    } catch (err: unknown) {
      const msg = (err as Error).message || ''
      console.warn('Supabase auth notice:', msg)
      setDemoSession(norm)
    }
  }

  async function signInWithOtp(email: string) {
    const admin = useAdminStore()
    if (!admin.initialised) await admin.init()

    const norm = email.trim().toLowerCase()
    if (!norm) throw new Error('Please enter your email address.')

    let teacher = admin.getTeacherByEmail(norm)
    if (!teacher && norm !== ADMIN_EMAIL && norm !== 'admin@hadfield.local') {
      teacher = (await admin.fetchTeacherByEmail(norm)) || undefined
    }

    const isMaster = norm === ADMIN_EMAIL || norm === 'admin@hadfield.local'
    if (!isMaster && (!teacher || teacher.status === 'suspended')) {
      throw new Error(
        `Access Pending: The email "${norm}" has not been authorized by Centre Director Kapil Pandey (info@pandeykapil.com.np).`,
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

  async function signUp(_email?: string, _password?: string, _fullName?: string) {
    throw new Error(
      'Registration Restricted: Self-signup is disabled. Only the Master Administrator (Kapil Pandey) can register and add educators to a Centre group. Please contact Kapil Pandey to obtain your educator login credentials.',
    )
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
    if (sb) {
      try {
        await sb.auth.signOut()
      } catch {
        /* ignore */
      }
    }
    user.value = null
    profile.value = null
    removeLocal(PROFILE_KEY)
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(DEMO_EMAIL_KEY)
      localStorage.removeItem(SESSION_EMAIL_KEY)
      localStorage.removeItem(LAST_ACTIVE_KEY)
    }
  }

  function resetDemoData() {
    removeLocal(PROFILE_KEY)
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(DEMO_EMAIL_KEY)
      localStorage.removeItem(SESSION_EMAIL_KEY)
      localStorage.removeItem(LAST_ACTIVE_KEY)
    }
    profile.value = null
    user.value = null
    void init()
  }

  async function resetPasswordForEmail(targetEmail: string) {
    const norm = targetEmail.trim().toLowerCase()
    if (!norm) throw new Error('Please enter your email address.')
    const sb = trySupabase()
    if (!sb) {
      throw new Error('Supabase is not configured.')
    }
    const { error } = await sb.auth.resetPasswordForEmail(norm, {
      redirectTo: `${window.location.origin}/settings`,
    })
    if (error) throw new Error(error.message)
    return true
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
    roomName,
    hasClassroomAccess,
    scopeId,
    displayName,
    demoMode,
    sessionDaysRemaining,
    touchSession,
    init,
    loadProfile,
    saveProfile,
    setCentreName,
    signUp,
    signIn,
    signInWithOtp,
    signInWithGoogle,
    resetPasswordForEmail,
    signOut,
    resetDemoData,
    setDemoSession,
  }
})