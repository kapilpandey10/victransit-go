<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAdminStore } from '@/stores/admin'

const props = defineProps<{
  topicKey?: string
}>()

const admin = useAdminStore()
const route = useRoute()
const dismissed = ref(false)

onMounted(() => {
  if (!admin.initialised) {
    void admin.init()
  }
})

const topic = computed(() => {
  if (props.topicKey) {
    return admin.getTopic(props.topicKey)
  }
  return admin.getTopic(route.path)
})

const isUnderDev = computed(() => topic.value?.status === 'under_development')
const isBeta = computed(() => topic.value?.status === 'beta')
const isVisible = computed(() => (isUnderDev.value || isBeta.value) && !dismissed.value)
</script>

<template>
  <transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <aside
      v-if="isVisible"
      role="status"
      aria-live="polite"
      class="relative mb-6 overflow-hidden rounded-2xl border p-4 sm:p-5 shadow-sm transition"
      :class="
        isUnderDev
          ? 'border-amber-300/80 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 text-amber-950 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-200'
          : 'border-violet-300/80 bg-gradient-to-r from-violet-500/10 via-violet-400/5 to-violet-500/10 text-violet-950 dark:border-violet-700/60 dark:bg-violet-950/30 dark:text-violet-200'
      "
    >
      <div class="flex items-start justify-between gap-3">
        <div class="flex items-start gap-3">
          <div
            class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl shadow-soft"
            :class="
              isUnderDev
                ? 'bg-amber-500 text-white dark:bg-amber-600'
                : 'bg-violet-600 text-white dark:bg-violet-700'
            "
          >
            <span v-if="isUnderDev">🚧</span>
            <span v-else>🧪</span>
          </div>

          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-display text-sm font-extrabold tracking-wide uppercase">
                <template v-if="isUnderDev">
                  {{ topic?.title || 'This Module' }} is Under Development
                </template>
                <template v-else>
                  {{ topic?.title || 'This Module' }} is in Beta Testing
                </template>
              </h3>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                :class="
                  isUnderDev
                    ? 'bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                    : 'bg-violet-200 text-violet-900 dark:bg-violet-900/60 dark:text-violet-200'
                "
              >
                {{ isUnderDev ? 'Work in Progress' : 'Pilot Trial' }}
              </span>
            </div>

            <p class="text-xs leading-relaxed opacity-90 sm:text-sm">
              {{
                topic?.leadership_notes ||
                'Educational leadership is currently refining this tool to align with updated curriculum guidelines.'
              }}
            </p>

            <div class="flex flex-wrap items-center gap-3 pt-1 text-xs">
              <RouterLink
                to="/admin"
                class="inline-flex items-center gap-1 font-bold underline hover:opacity-80 transition"
              >
                <span>🛡️ Educational Leadership Admin Controls</span>
                <span aria-hidden="true">&rarr;</span>
              </RouterLink>
            </div>
          </div>
        </div>

        <button
          type="button"
          class="shrink-0 rounded-lg p-1 text-xs opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition"
          title="Dismiss notification for this session"
          @click="dismissed = true"
        >
          ✕
        </button>
      </div>
    </aside>
  </transition>
</template>
