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
const showPassword = ref(false)
const loading = ref(false)
const useOtp = ref(false)
const showForgotModal = ref(false)
const forgotEmail = ref('')
const forgotLoading = ref(false)
const errorMessage = ref<string | null>(null)

onMounted(async () => {
  await admin.init(true)
  if (route.query.email) {
    email.value = String(route.query.email)
  }
})

const redirectTarget = computed(() => {
  const target = (route.query.redirect as string) || '/'
  if (target === '/login' || target === '/unauthorized') return '/'
  return target
})

async function handleLogin() {
  errorMessage.value = null
  const normEmail = email.value.trim().toLowerCase()
  if (!normEmail) {
    errorMessage.value = 'Please enter your email address.'
    return
  }

  loading.value = true
  try {
    if (!useOtp.value) {
      if (!password.value) {
        throw new Error('Please enter your password.')
      }
      await auth.signIn(normEmail, password.value)
      ui.showToast(`Welcome back, ${auth.displayName}!`, 'success')
      if (auth.isAdmin) {
        await router.push('/admin')
      } else {
        await router.push(redirectTarget.value)
      }
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

async function handleForgotPassword() {
  const norm = forgotEmail.value.trim().toLowerCase()
  if (!norm) {
    ui.showToast('Please enter your email address.', 'error')
    return
  }
  forgotLoading.value = true
  try {
    await auth.resetPasswordForEmail(norm)
    ui.showToast(`Password reset link sent to ${norm}! Check your email inbox.`, 'success')
    showForgotModal.value = false
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    forgotLoading.value = false
  }
}

function fillMasterAccount() {
  email.value = 'info@pandeykapil.com.np'
  useOtp.value = false
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

      <!-- Master Access Control Notice -->
      <div class="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 space-y-1.5">
        <div class="flex items-center gap-2 font-bold text-white">
          <span>🛡️</span>
          <span>Master-Controlled Access Only</span>
        </div>
        <p class="leading-relaxed text-slate-300">
          Public self-registration is disabled. Only Master Administrator Kapil Pandey (<span class="text-amber-300 font-semibold font-mono">info@pandeykapil.com.np</span>) can add educators to a Centre group.
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

      <!-- Master Quick Login Preset -->
      <div class="rounded-xl bg-slate-800/80 border border-slate-700/80 p-3 text-xs flex items-center justify-between">
        <div>
          <p class="font-bold text-slate-200">👑 Master Administrator</p>
          <p class="text-[11px] font-mono text-slate-400">info@pandeykapil.com.np</p>
        </div>
        <button
          type="button"
          class="btn-secondary text-[11px] py-1 px-2.5 font-bold"
          @click="fillMasterAccount"
        >
          Fill Master
        </button>
      </div>

      <!-- Login Form -->
      <form class="space-y-4" @submit.prevent="handleLogin">
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Email Address
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

        <div v-if="!useOtp" class="space-y-1">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <button
              type="button"
              class="text-xs text-brand-400 hover:underline"
              @click="showForgotModal = true; forgotEmail = email"
            >
              Forgot password?
            </button>
          </div>
          <div class="relative">
            <input
              v-model="password"
              :type="showPassword ? 'text' : 'password'"
              required
              autocomplete="current-password"
              placeholder="••••••••"
              class="input w-full pr-10 bg-slate-800/80 border-slate-700 text-white placeholder-slate-500"
            />
            <button
              type="button"
              class="absolute right-3 top-2.5 text-sm text-slate-400 hover:text-slate-200"
              @click="showPassword = !showPassword"
            >
              {{ showPassword ? '🙈' : '👁️' }}
            </button>
          </div>
        </div>

        <div class="flex items-center justify-between pt-1">
          <button
            type="button"
            class="text-xs text-brand-400 hover:underline"
            @click="useOtp = !useOtp"
          >
            {{ useOtp ? 'Use password instead' : 'Use magic login link instead' }}
          </button>
        </div>

        <button
          type="submit"
          class="btn-primary w-full py-3 font-bold text-sm shadow-soft flex items-center justify-center gap-2"
          :disabled="loading"
        >
          <span>{{ useOtp ? 'Send Magic Login Link' : 'Sign In to Portal' }}</span>
          <span v-if="loading">⏳</span>
          <span v-else>&rarr;</span>
        </button>
      </form>

      <!-- Security Guidance Footer -->
      <div class="border-t border-slate-800 pt-4 text-center">
        <p class="text-[11px] text-slate-400 leading-relaxed">
          Need educator access? Only Master Director Kapil Pandey (<span class="font-mono text-slate-300">info@pandeykapil.com.np</span>) can add educators to a Centre Group.
        </p>
      </div>
    </div>

    <!-- Supabase Forgot Password Modal -->
    <div
      v-if="showForgotModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"
      @click.self="showForgotModal = false"
    >
      <div class="card max-w-sm w-full p-6 space-y-4 bg-slate-900 border-slate-800 text-slate-100 shadow-lift">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="font-display font-bold text-base flex items-center gap-2">
            <span>🔑</span>
            <span>Reset Password via Supabase</span>
          </h3>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-200"
            @click="showForgotModal = false"
          >
            ✕
          </button>
        </div>
        <p class="text-xs text-slate-300 leading-relaxed">
          Enter your registered email address. Supabase Auth will send a secure password reset link directly to your inbox.
        </p>
        <form class="space-y-3" @submit.prevent="handleForgotPassword">
          <input
            v-model="forgotEmail"
            type="email"
            required
            placeholder="educator@hadfield.edu.au"
            class="input w-full bg-slate-800 border-slate-700 text-white"
          />
          <div class="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              class="btn-ghost text-xs"
              @click="showForgotModal = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-primary text-xs font-bold"
              :disabled="forgotLoading"
            >
              {{ forgotLoading ? 'Sending link…' : 'Send Reset Email' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
