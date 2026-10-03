<script setup lang="ts">
import { ref } from 'vue'
import { EYLF_OUTCOMES, EYLF_PRACTICES, EYLF_PRINCIPLES } from '@/data/eylf'
import { theoriesForOutcome } from '@/data/theories'

const expanded = ref<number | null>(1)
</script>

<template>
  <div class="space-y-5">
    <div class="card">
      <h2 class="font-display text-lg font-extrabold">Belonging, Being & Becoming</h2>
      <p class="mt-1 text-sm text-slate-600 dark:text-slate-300">
        The Early Years Learning Framework for Australia (V2.0) — the national guide
        for children’s learning from birth to five. Keep this page open while you
        plan; every tool in the app links back to these outcomes.
      </p>
    </div>

    <div class="grid gap-3">
      <article
        v-for="outcome in EYLF_OUTCOMES"
        :key="outcome.id"
        class="card"
      >
        <button class="flex w-full items-start gap-3 text-left" @click="expanded = expanded === outcome.id ? null : outcome.id">
          <span class="text-2xl">{{ outcome.emoji }}</span>
          <span class="min-w-0 flex-1">
            <span class="block font-display text-base font-extrabold">
              Outcome {{ outcome.id }} · {{ outcome.title }}
            </span>
            <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
              {{ outcome.summary }}
            </span>
          </span>
          <span class="text-xs text-slate-400">{{ expanded === outcome.id ? '▴' : '▾' }}</span>
        </button>

        <div v-if="expanded === outcome.id" class="mt-3 space-y-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <div
            v-for="sub in outcome.subOutcomes"
            :key="sub.id"
            class="rounded-xl bg-slate-50 p-3 dark:bg-slate-800"
          >
            <p class="text-sm font-bold">{{ sub.id }} · {{ sub.text }}</p>
            <p class="mt-1 text-[11px] font-bold text-slate-400">LOOK FOR</p>
            <ul class="list-disc space-y-0.5 pl-4 text-xs text-slate-600 dark:text-slate-300">
              <li v-for="(prompt, i) in sub.lookFor" :key="i">{{ prompt }}</li>
            </ul>
          </div>

          <p class="text-xs text-slate-500 dark:text-slate-400">
            <span class="font-bold">Related theorists:</span>
            {{ theoriesForOutcome(outcome.id).map(t => t.name).join(' · ') }}
          </p>
        </div>
      </article>
    </div>

    <div class="grid gap-5 lg:grid-cols-2">
      <div class="card">
        <h3 class="mb-2 font-display text-sm font-extrabold">Principles</h3>
        <ul class="space-y-2">
          <li
            v-for="(item, i) in EYLF_PRINCIPLES"
            :key="i"
            class="text-xs text-slate-600 dark:text-slate-300"
          >
            <span class="font-bold">{{ i + 1 }}. {{ item.title }}</span> — {{ item.description }}
          </li>
        </ul>
      </div>
      <div class="card">
        <h3 class="mb-2 font-display text-sm font-extrabold">Practices</h3>
        <ul class="space-y-2">
          <li
            v-for="(item, i) in EYLF_PRACTICES"
            :key="i"
            class="text-xs text-slate-600 dark:text-slate-300"
          >
            <span class="font-bold">{{ i + 1 }}. {{ item.title }}</span> — {{ item.description }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>