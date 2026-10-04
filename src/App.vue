<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from '@/components/AppShell.vue'
import ToastHost from '@/components/ToastHost.vue'
import ChatDock from '@/components/ChatDock.vue'

const route = useRoute()
const isPublicRoute = computed(() => route.meta?.public === true)
</script>

<template>
  <AppShell v-if="!isPublicRoute">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
  <div v-else class="min-h-screen bg-slate-900 text-slate-100">
    <RouterView />
  </div>
  <ChatDock v-if="!isPublicRoute" />
  <ToastHost />
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>