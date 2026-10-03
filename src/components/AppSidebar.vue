<script setup lang="ts">
import { useRoute } from 'vue-router'
import { NAV_ITEMS } from '@/router'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
const auth = useAuthStore()
const route = useRoute()

const isActive = (path: string) =>
  path === '/' ? route.path === '/' : route.path.startsWith(path)
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex items-center gap-3 px-5 py-5">
      <div
        class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-700 text-xl text-white shadow-soft"
      >
        🌱
      </div>
      <div class="min-w-0">
        <p class="truncate font-display text-sm font-extrabold">Inquiry Planner</p>
        <p class="truncate text-[11px] text-slate-500 dark:text-slate-400">
          {{ auth.displayName }}
        </p>
      </div>
    </div>

    <nav class="flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
      <RouterLink
        v-for="item in NAV_ITEMS"
        :key="item.path"
        :to="item.path"
        class="flex min-h-touch items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition"
        :class="
          isActive(item.path)
            ? 'bg-brand-50 text-brand-800 dark:bg-brand-950/60 dark:text-brand-200'
            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
        "
        @click="ui.toggleSidebar(false)"
      >
        <span class="text-lg">{{ item.icon }}</span>
        <span class="truncate">{{ item.title }}</span>
      </RouterLink>
    </nav>

    <div class="space-y-2 border-t border-slate-200/70 p-3 dark:border-slate-800">
      <button class="btn-secondary w-full" @click="ui.toggleChat(true)">
        ✨ Ask the AI assistant
      </button>
      <RouterLink
        to="/settings"
        class="btn-ghost w-full"
        @click="ui.toggleSidebar(false)"
      >
        ⚙️ Settings
      </RouterLink>
    </div>
  </div>
</template>