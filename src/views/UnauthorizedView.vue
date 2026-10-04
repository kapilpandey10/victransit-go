<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'

const auth = useAuthStore()
const admin = useAdminStore()
const router = useRouter()

const isNotAdmin = computed(() => auth.isAuthenticated && !auth.isAdmin)
const checking = ref(false)

async function checkAccessNow() {
  const email = auth.userEmail
  if (!email) return
  checking.value = true
  try {
    const isAuthed = await admin.checkEmailAuthorization(email)
    if (isAuthed) {
      if (auth.isAdmin) {
        await router.push('/admin')
      } else {
        await router.push('/')
      }
    }
  } finally {
    checking.value = false
  }
}

onMounted(() => {
  if (auth.userEmail) {
    void checkAccessNow()
  }
})

async function handleSignOut() {
  await auth.signOut()
  await router.push('/login')
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4 bg-slate-900/95 text-slate-100">
    <div class="card max-w-md w-full p-6 sm:p-8 bg-slate-900 border-slate-800 shadow-lift space-y-6 text-center">
      <div class="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-amber-500/20 text-3xl text-amber-400 border border-amber-500/30">
        <span v-if="isNotAdmin">🛡️</span>
        <span v-else>🔐</span>
      </div>

      <div class="space-y-2">
        <h1 class="font-display text-2xl font-black tracking-tight text-white">
          {{ isNotAdmin ? 'Administrator Privileges Required' : 'Access Pending Authorization' }}
        </h1>
        <p class="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
          <template v-if="isNotAdmin">
            The Admin Dashboard is strictly reserved for system administrators. Your account (<span class="text-brand-300 font-mono">{{ auth.userEmail }}</span>) has educator access.
          </template>
          <template v-else>
            Your email address (<span class="text-brand-300 font-mono">{{ auth.userEmail || 'unknown' }}</span>) has not yet been authorized by centre administration.
          </template>
        </p>
      </div>

      <!-- Action Box -->
      <div class="rounded-2xl border border-slate-800 bg-slate-800/50 p-4 text-xs text-slate-300 text-left space-y-2">
        <p class="font-bold text-white flex items-center gap-1.5">
          <span>ℹ️</span>
          <span>How to request access:</span>
        </p>
        <p class="leading-relaxed">
          Contact your Centre Director or system administrator to grant login authorization for your room or role. If your account was added just now, click the button below to re-verify against the database.
        </p>
      </div>

      <!-- Button Controls -->
      <div class="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
        <button
          type="button"
          :disabled="checking"
          class="btn-primary w-full sm:w-auto text-xs font-bold"
          @click="checkAccessNow"
        >
          <span v-if="checking">Checking database...</span>
          <span v-else>🔄 Check Access Now</span>
        </button>

        <button
          type="button"
          class="btn-ghost w-full sm:w-auto text-xs text-slate-400 hover:text-white"
          @click="handleSignOut"
        >
          Sign Out / Switch Account
        </button>
      </div>
    </div>
  </div>
</template>
