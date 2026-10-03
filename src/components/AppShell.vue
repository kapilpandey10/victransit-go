<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppSidebar from './AppSidebar.vue'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const auth = useAuthStore()
const route = useRoute()

const MOBILE_NAV = [
  { path: '/', icon: '🏠', short: 'Home' },
  { path: '/projects', icon: '🧩', short: 'Projects' },
  { path: '/learning-stories', icon: '📖', short: 'Stories' },
  { path: '/learning-outcomes', icon: '🎯', short: 'Outcomes' },
  { path: '/theories', icon: '📚', short: 'Theories' },
]

const currentTitle = computed(
  () => (route.meta?.title as string | undefined) ?? 'Dashboard',
)

const isActive = (path: string) =>
  path === '/' ? route.path === '/' : route.path.startsWith(path)

watch(
  () => route.fullPath,
  () => ui.toggleSidebar(false),
)
</script>

<template>
  <div
    class="flex min-h-screen bg-sand-100 text-slate-800 dark:bg-slate-950 dark:text-slate-100"
  >
    <!-- Desktop sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200/70 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:flex"
    >
      <AppSidebar />
    </aside>

    <!-- Mobile drawer -->
    <Transition name="drawer">
      <div v-if="ui.sidebarOpen" class="fixed inset-0 z-50 lg:hidden">
        <div
          class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
          @click="ui.toggleSidebar(false)"
        />
        <aside
          class="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-lift dark:bg-slate-900"
        >
          <AppSidebar />
        </aside>
      </div>
    </Transition>

    <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
      <!-- Top bar -->
      <header
        class="sticky top-0 z-30 border-b border-slate-200/70 bg-sand-100/85 pt-safe backdrop-blur dark:border-slate-800 dark:bg-slate-950/85"
      >
        <div class="flex items-center gap-2 px-3 py-3 sm:px-5">
          <button
            class="btn-ghost !px-2 lg:hidden"
            aria-label="Open navigation"
            @click="ui.toggleSidebar(true)"
          >
            <span class="text-xl">☰</span>
          </button>

          <div class="min-w-0 flex-1">
            <h1 class="truncate font-display text-lg font-extrabold sm:text-xl">
              {{ currentTitle }}
            </h1>
            <p class="truncate text-xs text-slate-500 dark:text-slate-400">
              {{ auth.profile?.centre_name || 'Hadfield Early Learning Centre' }}
            </p>
          </div>

          <button
            v-if="ui.canInstall"
            class="btn-secondary hidden sm:inline-flex"
            @click="ui.promptInstall()"
          >
            ⤓ Install app
          </button>

          <button
            class="btn-ghost !px-2.5"
            :aria-label="ui.isDark ? 'Switch to light mode' : 'Switch to dark mode'"
            @click="ui.toggleTheme()"
          >
            <span class="text-lg">{{ ui.isDark ? '☀️' : '🌙' }}</span>
          </button>

          <button
            class="btn-primary !px-3"
            aria-label="Open AI assistant"
            @click="ui.toggleChat(true)"
          >
            <span class="text-lg">✨</span>
            <span class="hidden md:inline">Ask AI</span>
          </button>
        </div>

        <div
          v-if="auth.demoMode"
          class="flex items-center gap-2 border-t border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <span>🧪</span>
          <span class="min-w-0 flex-1 truncate">
            Demo mode — data stays in this browser. Add Supabase credentials to sync
            across devices and enable the AI.
          </span>
          <RouterLink to="/settings" class="underline">Set up</RouterLink>
        </div>
      </header>

      <main class="mx-auto w-full max-w-6xl flex-1 px-3 pb-28 pt-4 sm:px-5 lg:pb-10">
        <slot />
      </main>

      <footer class="hidden px-5 pb-6 text-center text-xs text-slate-400 lg:block">
        EYLF v2.0 · Reggio Emilia inspired · Built for Hadfield Early Learning Centre
      </footer>
    </div>

    <!-- Mobile bottom navigation -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
    >
      <div class="flex items-stretch justify-around">
        <RouterLink
          v-for="item in MOBILE_NAV"
          :key="item.path"
          :to="item.path"
          class="flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-bold"
          :class="
            isActive(item.path)
              ? 'text-brand-700 dark:text-brand-300'
              : 'text-slate-400 dark:text-slate-500'
          "
        >
          <span class="text-xl leading-none">{{ item.icon }}</span>
          <span class="truncate">{{ item.short }}</span>
        </RouterLink>
        <button
          class="flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-bold text-slate-400 dark:text-slate-500"
          @click="ui.toggleSidebar(true)"
        >
          <span class="text-xl leading-none">⋯</span>
          <span>More</span>
        </button>
      </div>
    </nav>
  </div>
</template>

<style scoped>
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity 0.2s ease;
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
</style>