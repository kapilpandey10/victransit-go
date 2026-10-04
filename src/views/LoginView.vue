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
const mode = ref<'password' | 'otp'>('password')
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
  if (!email.value.trim()) {
    errorMessage.value = 'Please enter your email address.'
    return
  }

  loading.value = true
  try {
    if (mode.value === 'password') {
      await auth.signIn(email.value.trim(), password.value)
      ui.showToast(`Welcome back, ${auth.displayName}!`, 'success')
      await router.push(redirectTarget.value)
    } else {
      await auth.signInWithOtp(email.value.trim())
      ui.showToast('Magic login link sent to your email!', 'success')
    }
  } catch (err) {
    errorMessage.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function quickLoginAs(userEmail: string) {
  loading.value = true
  errorMessage.value = null
  try {
    await auth.signIn(userEmail)
    ui.showToast(`Logged in as ${auth.displayName} (${auth.userRole})`, 'success')
    await router.push(redirectTarget.value)
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

      <!-- Whitelist Notice -->
      <div class="rounded-xl border border-brand-500/30 bg-brand-500/10 p-3 text-xs text-brand-200 flex items-start gap-2">
        <span class="text-base">🔐</span>
        <p class="leading-relaxed">
          Access is strictly authorized for Hadfield ELC educators. Log in using the email provided by your Centre Director.
        </p>
      </div>

      <!-- Error Alert -->
      <div
        v-if="errorMessage"
        class="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-200 flex items-start gap-2"
      >
        <span class="text-base">⚠️</span>
        <div class="space-y-1">
          <p class="font-bold">Authentication Notice</p>
          <p class="leading-relaxed">{{ errorMessage }}</p>
        </div>
      </div>

      <!-- Login Form -->
      <form class="space-y-4" @submit.prevent="handleLogin">
        <div class="space-y-1">
          <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Educator Email
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

        <div v-if="mode === 'password'" class="space-y-1">
          <div class="flex items-center justify-between">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <button
              type="button"
              class="text-xs text-brand-400 hover:underline"
              @click="mode = 'otp'"
            >
              Use magic link instead
            </button>
          </div>
          <input
            v-model="password"
            type="password"
            :required="!auth.demoMode"
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
          <span>{{ mode === 'password' ? 'Sign In to Inquiry Planner' : 'Send Magic Link' }}</span>
          <span v-if="loading">⏳</span>
          <span v-else>&rarr;</span>
        </button>
      </form>

      <!-- Quick Switcher for Demo / Local Mode -->
      <div class="border-t border-slate-800 pt-4 space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Quick Login Demo Accounts:
          </p>
          <span class="rounded bg-brand-900/60 text-brand-300 text-[10px] font-mono px-1.5 py-0.5">
            1-Click Switch
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            class="p-2.5 rounded-xl border border-brand-500/40 bg-brand-500/10 hover:bg-brand-500/20 text-left transition"
            @click="quickLoginAs('kapilpandey@hadfield.edu.au')"
          >
            <div class="flex items-center gap-1.5 font-bold text-brand-300">
              <span>🛡️</span>
              <span>Kapil Pandey</span>
            </div>
            <p class="text-[10px] text-slate-400">Centre Director (Admin)</p>
          </button>

          <button
            type="button"
            class="p-2.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-left transition"
            @click="quickLoginAs('jean@hadfield.edu.au')"
          >
            <div class="flex items-center gap-1.5 font-bold text-slate-200">
              <span>👩‍🏫</span>
              <span>Jean</span>
            </div>
            <p class="text-[10px] text-slate-400">Educational Leader</p>
          </button>

          <button
            type="button"
            class="p-2.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-left transition"
            @click="quickLoginAs('lakshmi@hadfield.edu.au')"
          >
            <div class="flex items-center gap-1.5 font-bold text-slate-200">
              <span>👩‍🏫</span>
              <span>Lakshmi</span>
            </div>
            <p class="text-[10px] text-slate-400">ECT (Dandelions Room)</p>
          </button>

          <button
            type="button"
            class="p-2.5 rounded-xl border border-slate-800 bg-slate-800/60 hover:bg-slate-800 text-left transition"
            @click="quickLoginAs('kelly.goodsir@hadfield.edu.au')"
          >
            <div class="flex items-center gap-1.5 font-bold text-slate-200">
              <span>👩‍🏫</span>
              <span>Kelly Goodsir</span>
            </div>
            <p class="text-[10px] text-slate-400">Room Leader (Butter Beans)</p>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
