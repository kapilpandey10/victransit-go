<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const admin = useAdminStore()
const ui = useUiStore()
const router = useRouter()
const route = useRoute()

const email = ref('')
const password = ref('')
const loading = ref(false)
const fullName = ref('')
const mode = ref<'password' | 'signup' | 'otp'>('password')
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  await admin.init()
  if (route.query.email) {
    email.value = String(route.query.email)
  }
})

const redirectTarget = computed(() => (route.query.redirect as string) || '/dashboard')

async function handleLogin() {
  errorMessage.value = null
  const normEmail = email.value.trim().toLowerCase()
  if (!normEmail) {
    errorMessage.value = 'Please enter your email address.'
    return
  }

  loading.value = true
  try {
    if (mode.value === 'password') {
      await auth.signIn(normEmail, password.value)
      ui.showToast(`Welcome back, ${auth.displayName}!`, 'success')
      await router.push(redirectTarget.value)
    } else if (mode.value === 'signup') {
      if (!password.value || password.value.length < 6) {
        throw new Error('Password must be at least 6 characters long.')
      }
      await auth.signUp(normEmail, password.value, fullName.value.trim())
      ui.showToast('Account created and verified! Welcome to Hadfield ELC.', 'success')
      await router.push(redirectTarget.value)
    } else {
      await auth.signInWithOtp(normEmail)
      ui.showToast('Magic login link sent to your email!', 'success')
    }
  } catch (err) {
    errorMessage.value = (err as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-slate-900/95 text-slate-100">
    <div class="card max-w-md w-full p-6 sm:p-8 bg-slate-900 border-slate-800 shadow-lift space-y-6">
      <!-- Centre Brand Header -->
      <div class="text-center space-y-2">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-brand-600 text-3xl shadow-soft">
          🌱
        </div>
        <h1 class="font-display text-2xl font-black tracking-tight text-white">
          Hadfield Early Learning Centre
        </h1>
        <p class="text-xs uppercase font-extrabold tracking-wider text-brand-400">
          Inquiry Planner & Educational Portal
        </p>
      </div>

      <!-- Cloud Auth Notice -->
      <div class="rounded-xl border border-brand-500/30 bg-brand-500/10 p-3.5 text-xs text-brand-200 space-y-1.5">
        <div class="flex items-center gap-2 font-bold text-white">
          <span>🔐</span>
          <span>Supabase Cloud Authentication Active</span>
        </div>
        <p class="leading-relaxed text-slate-300">
          Authorized logins only.
          <span class="text-amber-300 font-semibold">kapilpandey@hadfield.edu.au</span> logs in as Centre Director (Admin).
          All other staff log in as Educators.
        </p>
      </div>

      <!-- Error Alert -->
      <div
        v-if="errorMessage"
        class="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200 flex items-start gap-2.5"
      >
        <span class="text-base shrink-0">⚠️</span>
        <div class="space-y-1">
          <p class="font-bold">Authentication Notice</p>
          <p class="leading-relaxed">{{ errorMessage }}</p>
        </div>
      </div>

      <!-- Auth Mode Selector (Sign In vs First Time Sign Up) -->
      <div class="grid grid-cols-2 p-1 rounded-xl bg-slate-800 border border-slate-700 text-xs font-bold">
        <button
          type="button"
          class="py-2 rounded-lg transition"
          :class="mode === 'password' || mode === 'otp' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'"
          @click="mode = 'password'"
        >
          Sign In
        </button>
        <button
          type="button"
          class="py-2 rounded-lg transition"
          :class="mode === 'signup' ? 'bg-brand-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'"
          @click="mode = 'signup'"
        >
          First Time? Sign Up
        </button>
      </div>

      <!-- Login Form -->
      <form class="space-y-4" @submit.prevent="handleLogin">
        <!-- Full Name (for Sign Up only) -->
        <div v-if="mode === 'signup'" class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Educator Full Name
          </label>
          <input
            v-model="fullName"
            type="text"
            required
            placeholder="e.g. Lakshmi"
            class="input w-full bg-slate-800/80 border-slate-700 text-white placeholder-slate-500"
          />
        </div>

        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Authorized Email Address
          </label>
          <input
            v-model="email"
            type="email"
            required
            autocomplete="email"
            placeholder="e.g. educator@hadfield.edu.au"
            class="input w-full bg-slate-800/80 border-slate-700 text-white placeholder-slate-500"
          />
        </div>

        <div v-if="mode !== 'otp'" class="space-y-1">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {{ mode === 'signup' ? 'Choose Password (min 6 chars)' : 'Password' }}
            </label>
            <button
              v-if="mode === 'password'"
              type="button"
              class="text-xs text-brand-400 hover:underline"
              @click="mode = 'otp'"
            >
              Use magic link
            </button>
          </div>
          <input
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            placeholder="••••••••"
            class="input w-full bg-slate-800/80 border-slate-700 text-white placeholder-slate-500"
          />
        </div>

        <div v-else class="text-right">
          <button
            type="button"
            class="text-xs text-brand-400 hover:underline"
            @click="mode = 'password'"
          >
            Use password instead
          </button>
        </div>

        <button
          type="submit"
          class="btn-primary w-full py-3 font-bold text-sm shadow-soft flex items-center justify-center gap-2"
          :disabled="loading"
        >
          <span>
            {{
              mode === 'password'
                ? 'Sign In to Portal'
                : mode === 'signup'
                  ? 'Create Educator Account'
                  : 'Send Magic Link'
            }}
          </span>
          <span v-if="loading">⏳</span>
          <span v-else>&rarr;</span>
        </button>
      </form>

      <!-- Security Guidance Footer -->
      <div class="border-t border-slate-800 pt-4 text-center">
        <p class="text-[11px] text-slate-400">
          Need access? Contact Centre Director Kapil Pandey to add your email to the educator roster.
        </p>
      </div>
    </div>
  </div>
</template>
