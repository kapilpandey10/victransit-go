import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { User } from '@supabase/supabase-js'
import { isSupabaseConfigured, trySupabase } from '@/services/supabase'
import { DEMO_USER_ID } from '@/services/repo'
import { readLocal, writeLocal, removeLocal } from '@/services/localStore'
import type { Profile } from '@/types'

const PROFILE_KEY = 'profile'

const DEMO_USER = {
  id: DEMO_USER_ID,
  email: 'demo@hadfield.local',
  user_metadata: { full_name: 'Demo Educator' },
} as unknown as User

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(readLocal<Profile | null>(PROFILE_KEY, null))
  const loading = ref(true)

  const isAuthenticated = computed(() => Boolean(user.value))
  const userId = computed(() => user.value?.id ?? null)
  /** Data scope id — falls back to the demo id so the UI stays usable. */
  const scopeId = computed(() => user.value?.id ?? DEMO_USER_ID)
  const displayName = computed(
    () =>
      profile.value?.full_name ||
      (user.value?.user_metadata?.full_name as string | undefined) ||
      user.value?.email?.split('@')[0] ||
      'Educator',
  )
  const demoMode = computed(() => !isSupabaseConfigured)

  async function init() {
    loading.value = true
    if (!isSupabaseConfigured) {
      // Demo mode — sign in a synthetic local user so every screen works.
      user.value = DEMO_USER
      if (!profile.value) {
        profile.value = {
          id: DEMO_USER_ID,
          full_name: 'Demo Educator',
          centre_name: 'Hadfield Early Learning Centre',
          room: 'Kinder Room',
          role: 'Educator',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        writeLocal(PROFILE_KEY, profile.value)
      }
      loading.value = false
      return
    }

    const sb = trySupabase()
    if (!sb) {
      loading.value = false
      return
    }

    const { data } = await sb.auth.getSession()
    user.value = data.session?.user ?? null

    sb.auth.onAuthStateChange((_event, session) => {
      user.value = session?.user ?? null
      if (session?.user) void loadProfile()
      else profile.value = null
    })

    if (user.value) await loadProfile()
    loading.value = false
  }

  async function loadProfile() {
    const sb = trySupabase()
    if (!sb || !user.value) return
    const { data } = await sb
      .from('profiles')
      .select('*')
      .eq('id', user.value.id)
      .maybeSingle()
    profile.value = (data as Profile) ?? null
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

  async function signUp(email: string, password: string, fullName: string) {
    const sb = trySupabase()
    if (!sb) throw new Error('Supabase is not configured.')
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })
    if (error) throw new Error(error.message)
  }

  async function signIn(email: string, password: string) {
    const sb = trySupabase()
    if (!sb) throw new Error('Supabase is not configured.')
    const { error } = await sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
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
    if (isSupabaseConfigured) {
      user.value = null
      profile.value = null
    } else {
      // Demo mode has no real session to end.
      user.value = DEMO_USER
    }
  }

  function resetDemoData() {
    removeLocal(PROFILE_KEY)
    profile.value = null
    void init()
  }

  return {
    user,
    profile,
    loading,
    isAuthenticated,
    userId,
    scopeId,
    displayName,
    demoMode,
    init,
    loadProfile,
    saveProfile,
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resetDemoData,
  }
})