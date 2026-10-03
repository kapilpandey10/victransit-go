<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { PROMPTS } from '@/data/prompts'
import { EYLF_OUTCOMES } from '@/data/eylf'
import { useAiTask } from '@/composables/useAiTask'
import { useContentStore } from '@/stores/content'
import { useUiStore } from '@/stores/ui'
import type { EylfOutcomeId } from '@/types'

const ai = useAiTask()
const content = useContentStore()
const ui = useUiStore()

interface GenResult {
  summary: string
  strengths: string[]
  gaps: string[]
  recommendations: string[]
  coverage: Record<string, number>
  eylfOutcomeIds: number[]
}

const title = ref('')
const sourceText = ref('')
const result = ref<GenResult | null>(null)
const savedId = ref<string | null>(null)

const analyses = computed(() => content.analyses)

const coverageList = computed(() => {
  const cov = result.value?.coverage ?? {}
  return EYLF_OUTCOMES.map(o => ({
    outcome: o,
    level: Number(cov[String(o.id)] ?? 0),
  }))
})

function coverageBar(level: number) {
  return {
    width: `${Math.max(0, Math.min(5, level)) * 20}%`,
    class:
      level >= 4
        ? 'bg-emerald-500'
        : level >= 3
          ? 'bg-brand-500'
          : level >= 2
            ? 'bg-amber-500'
            : 'bg-rose-400',
  }
}

async function analyse() {
  if (!sourceText.value.trim()) return
  const data = await ai.run<GenResult>(
    PROMPTS.programAnalysis({ programText: sourceText.value }),
  )
  if (data) {
    result.value = data
    ui.showToast('Analysis complete', 'success')
  }
}

async function save() {
  if (!result.value || !sourceText.value.trim()) return
  const eylfIds = (result.value.eylfOutcomeIds ?? []).filter(
    id => id >= 1 && id <= 5,
  ) as EylfOutcomeId[]
  const saved = await content.saveAnalysis(
    {
      title: title.value || 'Program analysis',
      source_text: sourceText.value,
      summary: result.value.summary,
      strengths: result.value.strengths,
      gaps: result.value.gaps,
      recommendations: result.value.recommendations,
      coverage: result.value.coverage,
      eylf_outcome_ids: eylfIds,
    },
    savedId.value ?? undefined,
  )
  savedId.value = saved.id
  title.value = saved.title
  ui.showToast('Analysis saved', 'success')
  await content.loadAnalyses()
}

function loadSaved(id: string) {
  const found = content.analyses.find(a => a.id === id)
  if (!found) return
  savedId.value = found.id
  title.value = found.title
  sourceText.value = found.source_text
  result.value = {
    summary: found.summary ?? '',
    strengths: found.strengths ?? [],
    gaps: found.gaps ?? [],
    recommendations: found.recommendations ?? [],
    coverage: (found.coverage as Record<string, number>) ?? {},
    eylfOutcomeIds: found.eylf_outcome_ids,
  }
}

function startNew() {
  savedId.value = null
  title.value = ''
  sourceText.value = ''
  result.value = null
}

async function remove(id: string) {
  if (!window.confirm('Delete this analysis?')) return
  await content.deleteAnalysis(id)
  if (savedId.value === id) startNew()
}

onMounted(() => content.loadAnalyses())
</script>

<template>
  <div class="space-y-5">
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Paste program documentation for a strengths-based critical reflection.
      </p>
      <button class="btn-secondary" @click="startNew">＋ New analysis</button>
    </div>

    <div class="grid gap-5 lg:grid-cols-4">
      <aside class="card h-fit lg:col-span-1">
        <p class="text-xs font-bold text-slate-500">Saved analyses</p>
        <ul class="mt-2 space-y-1">
          <li v-for="a in analyses" :key="a.id">
            <button
              class="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              @click="loadSaved(a.id)"
            >
              <span class="truncate">{{ a.title }}</span>
              <span class="text-rose-400" @click.stop="remove(a.id)">✕</span>
            </button>
          </li>
        </ul>
        <p v-if="!analyses.length" class="mt-2 text-xs text-slate-400">None saved yet.</p>
      </aside>

      <section class="space-y-4 lg:col-span-3">
        <div class="card space-y-4">
          <div>
            <label class="field-label" for="pb-title">Title</label>
            <input id="pb-title" v-model="title" class="input" placeholder="Week 6 program reflection" />
          </div>
          <div>
            <label class="field-label" for="pb-source">Program documentation *</label>
            <p class="mb-2 text-xs text-slate-500 dark:text-slate-400">
              Paste the weekly program, goals, observations summary or planned
              experiences. Longer text gives a better analysis.
            </p>
            <textarea id="pb-source" v-model="sourceText" class="textarea" rows="9" />
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              class="btn-primary"
              :disabled="ai.loading.value || !sourceText.trim()"
              @click="analyse"
            >
              {{ ai.loading.value ? 'Analysing…' : '🔍 Analyse with AI' }}
            </button>
            <button class="btn-secondary" :disabled="!result" @click="save">💾 Save</button>
          </div>
          <p v-if="ai.error.value" class="text-sm text-rose-700">{{ ai.error.value }}</p>
        </div>

        <div v-if="result" class="space-y-4">
          <div class="card">
            <h3 class="font-display text-sm font-extrabold">Summary</h3>
            <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {{ result.summary }}
            </p>
          </div>

          <div class="card">
            <h3 class="mb-3 font-display text-sm font-extrabold">EYLF coverage</h3>
            <ul class="space-y-2">
              <li v-for="row in coverageList" :key="row.outcome.id" class="text-xs">
                <div class="mb-1 flex items-center justify-between gap-2">
                  <span class="font-bold">
                    {{ row.outcome.emoji }} O{{ row.outcome.id }} {{ row.outcome.shortTitle }}
                  </span>
                  <span class="text-slate-400">{{ row.level }}/5</span>
                </div>
                <div class="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div class="h-full rounded-full" :class="coverageBar(row.level).class" :style="{ width: coverageBar(row.level).width }" />
                </div>
              </li>
            </ul>
          </div>

          <div class="grid gap-4 sm:grid-cols-3">
            <div class="card">
              <h3 class="mb-2 font-display text-sm font-extrabold">Strengths</h3>
              <ul class="list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
                <li v-for="(item, i) in result.strengths" :key="i">{{ item }}</li>
              </ul>
            </div>
            <div class="card">
              <h3 class="mb-2 font-display text-sm font-extrabold">Gaps</h3>
              <ul class="list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
                <li v-for="(item, i) in result.gaps" :key="i">{{ item }}</li>
              </ul>
            </div>
            <div class="card">
              <h3 class="mb-2 font-display text-sm font-extrabold">Next steps</h3>
              <ul class="list-disc space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-300">
                <li v-for="(item, i) in result.recommendations" :key="i">{{ item }}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
