<script setup lang="ts">
import { computed, ref } from 'vue'
import { EYLF_OUTCOMES } from '@/data/eylf'
import { REGGIO_PRINCIPLES, REGGIO_QUOTE, REGGIO_ROOM_AUDIT } from '@/data/reggio'
import { THEORIES, theoriesForOutcome } from '@/data/theories'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import type { EylfOutcomeId } from '@/types'

const chat = useChatStore()
const ui = useUiStore()

const query = ref('')
const outcomeFilter = ref<EylfOutcomeId | 0>(0)
const selectedTheory = ref<string | null>(THEORIES[0]?.id ?? null)
const activeBand = ref<'theories' | 'reggio'>('theories')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  return THEORIES.filter(t => {
    if (outcomeFilter.value && !t.eylfLinks.includes(outcomeFilter.value)) return false
    if (!q) return true
    return (
      t.name.toLowerCase().includes(q) ||
      t.tradition.toLowerCase().includes(q) ||
      t.keyConcepts.some(c => c.term.toLowerCase().includes(q)) ||
      t.inPractice.some(p => p.toLowerCase().includes(q))
    )
  })
})

const current = computed(
  () => THEORIES.find(t => t.id === selectedTheory.value) ?? THEORIES[0],
)

function outcomeChip(id: EylfOutcomeId) {
  const o = EYLF_OUTCOMES.find(x => x.id === id)
  return o ? `O${o.id} ${o.shortTitle}` : `O${id}`
}

function theoristsFor(outcome: EylfOutcomeId) {
  return theoriesForOutcome(outcome).map(t => t.name)
}

function askAiAboutTheory() {
  if (!current.value) return
  chat.setContext({
    label: `Theory: ${current.value.name}`,
    body: `Summary: ${current.value.summary}\nKey concepts: ${current.value.keyConcepts
      .map(c => `${c.term}: ${c.definition}`)
      .join('; ')}`,
  })
  ui.toggleChat(true)
}
</script>

<template>
  <div class="space-y-5">
    <nav class="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      <button
        v-for="band in [
          { id: 'theories', label: '📚 Theorists & literature' },
          { id: 'reggio', label: '🎨 Reggio Emilia lens' },
        ]"
        :key="band.id"
        class="flex-1 rounded-lg px-3 py-2 text-sm font-bold transition"
        :class="
          activeBand === band.id
            ? 'bg-white text-brand-800 shadow-soft dark:bg-slate-900 dark:text-brand-200'
            : 'text-slate-500'
        "
        @click="activeBand = band.id as typeof activeBand"
      >
        {{ band.label }}
      </button>
    </nav>

    <template v-if="activeBand === 'theories'">
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="query"
          type="search"
          placeholder="Search theories, concepts, practices…"
          class="input max-w-sm flex-1"
        />
        <select v-model.number="outcomeFilter" class="input max-w-[12rem]">
          <option :value="0">All EYLF outcomes</option>
          <option v-for="o in EYLF_OUTCOMES" :key="o.id" :value="o.id">
            O{{ o.id }} · {{ o.shortTitle }}
          </option>
        </select>
      </div>

      <div class="grid gap-5 lg:grid-cols-3">
        <div class="space-y-2 lg:col-span-1">
          <button
            v-for="t in filtered"
            :key="t.id"
            class="card w-full !p-3 text-left transition"
            :class="selectedTheory === t.id ? '!border-brand-400' : ''"
            @click="selectedTheory = t.id"
          >
            <p class="text-sm font-bold">{{ t.name }}</p>
            <p class="mt-0.5 text-[11px] text-slate-500">{{ t.tradition }}</p>
            <div class="mt-1 flex flex-wrap gap-1">
              <span
                v-for="id in t.eylfLinks"
                :key="id"
                class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
              >
                {{ outcomeChip(id) }}
              </span>
            </div>
          </button>
          <p v-if="!filtered.length" class="text-sm text-slate-400">No matches.</p>
        </div>

        <article v-if="current" class="card space-y-4 lg:col-span-2">
          <header>
            <p class="text-xs font-bold text-slate-400">
              {{ current.tradition }} · {{ current.years }}
            </p>
            <h2 class="mt-1 font-display text-xl font-extrabold">{{ current.name }}</h2>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">{{ current.summary }}</p>
          </header>

          <div>
            <h3 class="mb-2 font-display text-sm font-extrabold">Key concepts</h3>
            <ul class="space-y-2">
              <li
                v-for="c in current.keyConcepts"
                :key="c.term"
                class="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800"
              >
                <span class="font-bold">{{ c.term }}</span> — {{ c.definition }}
              </li>
            </ul>
          </div>

          <div>
            <h3 class="mb-2 font-display text-sm font-extrabold">In practice</h3>
            <ul class="list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
              <li v-for="(item, i) in current.inPractice" :key="i">{{ item }}</li>
            </ul>
          </div>

          <div>
            <h3 class="mb-2 font-display text-sm font-extrabold">References</h3>
            <ul class="list-disc space-y-1 pl-5 text-xs text-slate-500 dark:text-slate-400">
              <li v-for="(r, i) in current.references" :key="i">{{ r }}</li>
            </ul>
          </div>

          <button class="btn-secondary" @click="askAiAboutTheory">
            ✨ Ask AI how to apply this
          </button>
        </article>
      </div>
    </template>

    <template v-else>
      <blockquote
        class="rounded-3xl bg-gradient-to-br from-brand-700 to-brand-900 p-6 text-white shadow-lift"
      >
        <p class="whitespace-pre-line font-display text-lg font-bold leading-relaxed">
          {{ REGGIO_QUOTE.text }}
        </p>
        <p class="mt-3 text-xs text-brand-100">
          — {{ REGGIO_QUOTE.author }}, {{ REGGIO_QUOTE.source }}
        </p>
      </blockquote>

      <div class="grid gap-3 sm:grid-cols-2">
        <article
          v-for="principle in REGGIO_PRINCIPLES"
          :key="principle.id"
          class="card space-y-2"
        >
          <h3 class="font-display text-sm font-extrabold">{{ principle.title }}</h3>
          <p class="text-xs text-slate-600 dark:text-slate-300">{{ principle.description }}</p>
          <ul class="list-disc space-y-0.5 pl-4 text-xs text-slate-500 dark:text-slate-400">
            <li v-for="(item, i) in principle.inPractice" :key="i">{{ item }}</li>
          </ul>
        </article>
      </div>

      <div class="card">
        <h3 class="mb-2 font-display text-sm font-extrabold">
          🏠 Room audit — is your environment the third teacher?
        </h3>
        <ul class="space-y-1.5">
          <li
            v-for="(item, i) in REGGIO_ROOM_AUDIT"
            :key="i"
            class="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300"
          >
            <input type="checkbox" class="mt-0.5 h-4 w-4 rounded text-brand-700" />
            <span>{{ item }}</span>
          </li>
        </ul>
      </div>

      <div class="card">
        <h3 class="mb-2 font-display text-sm font-extrabold">Link theories to outcomes</h3>
        <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="o in EYLF_OUTCOMES"
            :key="o.id"
            class="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800"
          >
            <p class="font-bold">
              {{ o.emoji }} O{{ o.id }} {{ o.shortTitle }}
            </p>
            <ul class="mt-1 list-disc space-y-0.5 pl-4 text-slate-500 dark:text-slate-400">
              <li v-for="name in theoristsFor(o.id)" :key="name">{{ name }}</li>
            </ul>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
