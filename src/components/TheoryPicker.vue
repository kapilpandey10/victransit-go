<script setup lang="ts">
import { computed, ref } from 'vue'
import { EYLF_OUTCOMES } from '@/data/eylf'
import { THEORIES } from '@/data/theories'
import type { EylfOutcomeId } from '@/types'

const props = withDefaults(
  defineProps<{
    modelValue: string[]
    /** When provided, theories matching these outcomes are highlighted first. */
    outcomeIds?: EylfOutcomeId[]
    label?: string
  }>(),
  { label: 'Learning theories', outcomeIds: () => [] },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string[]): void
  (e: 'change', value: string[]): void
}>()

const query = ref('')
const expanded = ref<string | null>(null)

const selected = computed(() => new Set(props.modelValue))

const ordered = computed(() => {
  const withScore = THEORIES.map(t => {
    const overlap = props.outcomeIds.filter(id => t.eylfLinks.includes(id)).length
    return { theory: t, overlap }
  })
  withScore.sort((a, b) => b.overlap - a.overlap)
  return withScore.map(x => x.theory)
})

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return ordered.value
  return ordered.value.filter(
    t =>
      t.name.toLowerCase().includes(q) ||
      t.tradition.toLowerCase().includes(q) ||
      t.keyConcepts.some(c => c.term.toLowerCase().includes(q)),
  )
})

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  const value = [...next]
  emit('update:modelValue', value)
  emit('change', value)
}

function outcomeTitles(ids: EylfOutcomeId[]) {
  return ids
    .map(id => EYLF_OUTCOMES.find(o => o.id === id))
    .filter(Boolean)
    .map(o => `O${o!.id} ${o!.shortTitle}`)
    .join(' · ')
}
</script>

<template>
  <div>
    <div class="mb-2 flex items-center justify-between gap-3">
      <span class="field-label !mb-0">{{ label }}</span>
      <input
        v-model="query"
        type="search"
        placeholder="Search theories…"
        class="input !min-h-0 max-w-[12rem] !py-1.5 text-sm"
      />
    </div>

    <div class="grid gap-2">
      <div
        v-for="theory in filtered"
        :key="theory.id"
        class="rounded-xl border transition"
        :class="
          selected.has(theory.id)
            ? 'border-brand-400 bg-brand-50 dark:bg-brand-950/40'
            : 'border-slate-200 dark:border-slate-700'
        "
      >
        <div class="flex items-start gap-3 p-3">
          <input
            :id="`theory-${theory.id}`"
            type="checkbox"
            class="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
            :checked="selected.has(theory.id)"
            @change="toggle(theory.id)"
          />
          <label :for="`theory-${theory.id}`" class="min-w-0 flex-1 cursor-pointer">
            <span class="block text-sm font-bold">{{ theory.name }}</span>
            <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {{ theory.tradition }} · {{ theory.years }}
            </span>
            <span class="mt-1 block text-[11px] font-semibold text-brand-700 dark:text-brand-300">
              {{ outcomeTitles(theory.eylfLinks) }}
            </span>
          </label>
          <button
            class="btn-ghost !min-h-0 !px-2 !py-1 text-xs"
            @click="expanded = expanded === theory.id ? null : theory.id"
          >
            {{ expanded === theory.id ? 'Hide' : 'Details' }}
          </button>
        </div>

        <div
          v-if="expanded === theory.id"
          class="space-y-2 border-t border-slate-200 px-3 py-2 text-xs dark:border-slate-700"
        >
          <p class="text-slate-600 dark:text-slate-300">{{ theory.summary }}</p>
          <ul class="space-y-1">
            <li v-for="concept in theory.keyConcepts" :key="concept.term">
              <span class="font-bold">{{ concept.term }}</span> — {{ concept.definition }}
            </li>
          </ul>
          <div>
            <p class="font-bold text-slate-700 dark:text-slate-200">In practice</p>
            <ul class="list-disc space-y-0.5 pl-4 text-slate-600 dark:text-slate-300">
              <li v-for="(item, i) in theory.inPractice" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>