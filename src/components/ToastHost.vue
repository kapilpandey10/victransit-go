<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const toneClass = (tone: string) =>
  tone === 'success'
    ? 'bg-emerald-600'
    : tone === 'error'
      ? 'bg-rose-600'
      : 'bg-slate-800'
</script>

<template>
  <Transition name="toast">
    <div
      v-if="ui.toast"
      class="pointer-events-none fixed inset-x-0 top-3 z-[60] flex justify-center px-3 pt-safe"
    >
      <div
        class="pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-lift"
        :class="toneClass(ui.toast.tone)"
        role="status"
      >
        <span>{{ ui.toast.message }}</span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>