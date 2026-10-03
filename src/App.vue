<script setup lang="ts">
import AppShell from '@/components/AppShell.vue'
import ToastHost from '@/components/ToastHost.vue'
import ChatDock from '@/components/ChatDock.vue'
</script>

<template>
  <AppShell>
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
  <ChatDock />
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