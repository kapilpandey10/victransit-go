<script setup lang="ts">
import { computed, ref } from 'vue'
import { EYLF_OUTCOMES } from '@/data/eylf'
import type { EylfOutcomeId } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: EylfOutcomeId[]
    /** Show the expandable sub-outcome list. */
    detailed?: boolean
    label?: string
  }>(),
  { detailed: true, label: 'EYLF outcomes' },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: EylfOutcomeId[]): void
  (e: 'change', value: EylfOutcomeId[]): void
}>()

const expanded = ref<number | null>(null)

const selected = computed(() => new Set(props.modelValue))

function toggle(id: EylfOutcomeId) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  commit([...next].sort((a, b) => a - b) as EylfOutcomeId[])
}

function commit(value: EylfOutcomeId[]) {
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between">
      <span class="field-label !mb-0">{{ label }}</span>
      <span class="text-xs text-slate-400">{{ modelValue.length }} selected</span>
    </div>

    <div class="grid gap-2">
      <div
        v-for="outcome in EYLF_OUTCOMES"
        :key="outcome.id"
        class="rounded-xl border transition"
        :class="
          selected.has(outcome.id)
            ? 'border-brand-400 bg-brand-50 dark:bg-brand-950/40'
            : 'border-slate-200 dark:border-slate-700'
        "
      >
        <div class="flex items-start gap-3 p-3">
          <input
            :id="`eylf-${outcome.id}`"
            type="checkbox"
            class="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
            :checked="selected.has(outcome.id)"
            @change="toggle(outcome.id)"
          />
          <label :for="`eylf-${outcome.id}`" class="min-w-0 flex-1 cursor-pointer">
            <span class="flex items-center gap-2 text-sm font-bold">
              <span>{{ outcome.emoji }}</span>
              <span>Outcome {{ outcome.id }} · {{ outcome.shortTitle }}</span>
            </span>
            <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {{ outcome.title }}
            </span>
          </label>
          <button
            v-if="detailed"
            class="btn-ghost !min-h-0 !px-2 !py-1 text-xs"
            @click="expanded = expanded === outcome.id ? null : outcome.id"
          >
            {{ expanded === outcome.id ? 'Hide' : 'Sub-outcomes' }}
          </button>
        </div>

        <div
          v-if="detailed && expanded === outcome.id"
          class="border-t border-slate-200 px-3 py-2 dark:border-slate-700"
        >
          <ul class="space-y-2">
            <li
              v-for="sub in outcome.subOutcomes"
              :key="sub.id"
              class="text-xs text-slate-600 dark:text-slate-300"
            >
              <span class="font-bold text-slate-800 dark:text-slate-100">
                {{ sub.id }}
              </span>
              <span>{{ sub.text }}</span>
              <ul class="mt-1 list-disc space-y-0.5 pl-4 text-slate-500 dark:text-slate-400">
                <li v-for="(prompt, i) in sub.lookFor" :key="i">{{ prompt }}</li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>