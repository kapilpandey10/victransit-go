<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NAV_ITEMS } from '@/router'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const auth = useAuthStore()
const admin = useAdminStore()
const route = useRoute()
const router = useRouter()

onMounted(() => {
  if (!admin.initialised) {
    void admin.init()
  }
})

const isActive = (path: string) =>
  path === '/' ? route.path === '/' : route.path.startsWith(path)

function isUnderDev(path: string, name: string): boolean {
  return admin.isTopicUnderDevelopment(name) || admin.isTopicUnderDevelopment(path)
}

async function handleSignOut() {
  ui.toggleSidebar(false)
  await auth.signOut()
  await router.push('/login')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Top user identity -->
    <div class="flex items-center gap-3 px-5 py-5 border-b border-slate-200/60 dark:border-slate-800">
      <div
        class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-700 text-xl text-white shadow-soft"
      >
        🌱
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-display text-sm font-extrabold">Inquiry Planner</p>
        <div class="flex items-center gap-1.5">
          <p class="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {{ auth.displayName }}
          </p>
          <span
            v-if="auth.isAdmin"
            class="rounded bg-brand-100 text-brand-800 dark:bg-brand-900/60 dark:text-brand-300 px-1 py-0.2 text-[9px] font-bold"
          >
            Director
          </span>
        </div>
      </div>
    </div>

    <!-- Nav Links -->
    <nav class="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
      <!-- Admin Link — only displayed when user is Admin -->
      <RouterLink
        v-if="auth.isAdmin"
        to="/admin"
        class="flex min-h-touch items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-black transition mb-2"
        :class="
          isActive('/admin')
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-soft'
            : 'bg-brand-500/10 text-brand-900 dark:text-brand-200 hover:bg-brand-500/20'
        "
        @click="ui.toggleSidebar(false)"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-lg shrink-0">🛡️</span>
          <span class="truncate">Admin Dashboard</span>
        </div>
        <span class="rounded bg-brand-600 text-white px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider">
          Admin
        </span>
      </RouterLink>

      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.path"
        :to="item.path"
        class="flex min-h-touch items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-bold transition"
        :class="
          isActive(item.path)
            ? 'bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        "
        @click="ui.toggleSidebar(false)"
      >
        <div class="flex items-center gap-3 min-w-0">
          <span class="text-lg shrink-0">{{ item.icon }}</span>
          <span class="truncate">{{ item.title }}</span>
        </div>

        <!-- Under Development Badge -->
        <span
          v-if="isUnderDev(item.path, item.name)"
          class="shrink-0 rounded-full bg-amber-100 dark:bg-amber-950/70 border border-amber-300/80 dark:border-amber-700/80 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-200"
          title="Under Active Development"
        >
          🚧 WIP
        </span>
      </RouterLink>
    </nav>

    <!-- Footer buttons -->
    <div class="space-y-2 border-t border-slate-200/70 p-3 dark:border-slate-800">
      <button class="btn-secondary w-full" @click="ui.toggleChat(true)">
        ✨ Ask the AI assistant
      </button>
      <div class="grid grid-cols-2 gap-1.5">
        <RouterLink
          to="/settings"
          class="btn-ghost flex items-center justify-center gap-1.5 text-xs font-bold"
          :class="{ 'bg-slate-100 dark:bg-slate-800': route.path === '/settings' }"
          @click="ui.toggleSidebar(false)"
        >
          <span>⚙️</span>
          <span>Settings</span>
        </RouterLink>

        <button
          type="button"
          class="btn-ghost flex items-center justify-center gap-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
          title="Sign out of your account"
          @click="handleSignOut"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  </div>
</template>