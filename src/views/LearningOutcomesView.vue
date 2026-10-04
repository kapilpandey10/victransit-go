<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import EylfOutcomePicker from '@/components/EylfOutcomePicker.vue'
import TheoryPicker from '@/components/TheoryPicker.vue'
import UnderDevelopmentBanner from '@/components/UnderDevelopmentBanner.vue'
import { PROMPTS } from '@/data/prompts'
import { useAiTask } from '@/composables/useAiTask'
import { useChatStore } from '@/stores/chat'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import type { EylfOutcomeId } from '@/types'

const ai = useAiTask()
const projects = useProjectStore()
const ui = useUiStore()
const chat = useChatStore()

interface Result {
  primaryOutcomes: { id: number; subOutcomeIds: string[]; why: string }[]
  learningIntentions: string[]
  successCriteria: string[]
  theories: { id: string; note: string }[]
  reggioLens: string
  extensionIdeas: string[]
  environmentChanges: string[]
}

const form = reactive({
  activity: '',
  ageGroup: '3-5 years',
  projectId: '',
})

const result = ref<Result | null>(null)
const manualOutcomes = ref<EylfOutcomeId[]>([])
const manualTheories = ref<string[]>([])

const AGE_GROUPS = ['0-2 years', '2-3 years', '3-5 years', 'Mixed ages']

async function generate() {
  if (!form.activity.trim()) return
  const data = await ai.run<Result>(
    PROMPTS.learningOutcomes(form.activity, form.ageGroup),
  )
  if (data) {
    result.value = data
    manualOutcomes.value = data.primaryOutcomes
      .map(o => o.id as EylfOutcomeId)
      .filter(id => id >= 1 && id <= 5)
    manualTheories.value = data.theories.map(t => t.id)
    ui.showToast('Outcomes generated', 'success')
  }
}

async function saveAsActivity() {
  if (!form.activity.trim()) return
  await projects.createActivity({
    title: form.activity.slice(0, 60),
    description: form.activity,
    project_id: form.projectId || null,
    learning_intentions: (result.value?.learningIntentions ?? []).join('\n'),
    success_criteria: (result.value?.successCriteria ?? []).join('\n'),
    extension_ideas: (result.value?.extensionIdeas ?? []).join('\n'),
    eylf_outcome_ids: manualOutcomes.value,
    theory_ids: manualTheories.value,
    resources: '',
  })
  ui.showToast('Saved as an activity', 'success')
}

function askAi() {
  chat.setContext({
    label: 'Learning outcomes tool',
    body: `Activity: ${form.activity}\nAge group: ${form.ageGroup}\nOutcomes: ${manualOutcomes.value.join(', ')}`,
  })
  ui.toggleChat(true)
}

const resultGroups = computed(() => {
  const r = result.value
  if (!r) return []
  return [
    { title: 'Learning intentions', items: r.learningIntentions },
    { title: 'Success criteria', items: r.successCriteria },
    { title: 'Extension ideas', items: r.extensionIdeas },
    { title: 'Environment changes', items: r.environmentChanges },
  ]
})

onMounted(() => projects.loadProjects())
</script>

<template>
  <div class="space-y-5">
    <UnderDevelopmentBanner topic-key="learning-outcomes" />

    <div class="grid gap-5 lg:grid-cols-5">
    <section class="space-y-4 lg:col-span-3">
      <div class="card space-y-4">
        <div>
          <label class="field-label" for="lo-activity">Describe the experience *</label>
          <textarea
            id="lo-activity"
            v-model="form.activity"
            class="textarea"
            rows="4"
            placeholder="e.g. Children collect rainwater in containers and compare how full each one gets."
          />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="field-label" for="lo-age">Age group</label>
            <select id="lo-age" v-model="form.ageGroup" class="input">
              <option v-for="age in AGE_GROUPS" :key="age" :value="age">{{ age }}</option>
            </select>
          </div>
          <div>
            <label class="field-label" for="lo-project">Link to project</label>
            <select id="lo-project" v-model="form.projectId" class="input">
              <option value="">— None —</option>
              <option v-for="p in projects.projects" :key="p.id" :value="p.id">
                {{ p.title }}
              </option>
            </select>
          </div>
        </div>

        <div class="flex flex-wrap gap-2">
          <button
            class="btn-primary"
            :disabled="ai.loading.value || !form.activity.trim()"
            @click="generate"
          >
            {{ ai.loading.value ? 'Analysing…' : '✨ Suggest outcomes & theories' }}
          </button>
          <button
            class="btn-secondary"
            :disabled="!form.activity.trim()"
            @click="saveAsActivity"
          >
            💾 Save as activity
          </button>
          <button class="btn-ghost" @click="askAi">Ask the assistant</button>
        </div>

        <p v-if="ai.error.value" class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
          {{ ai.error.value }}
        </p>
      </div>

      <div v-if="result" class="card space-y-4">
        <h3 class="font-display text-base font-extrabold">Suggested outcomes</h3>
        <ul class="space-y-2">
          <li
            v-for="o in result.primaryOutcomes"
            :key="o.id"
            class="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700"
          >
            <p class="font-bold">Outcome {{ o.id }}</p>
            <p class="text-xs text-slate-500">
              Sub-outcomes: {{ o.subOutcomeIds.join(', ') }}
            </p>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-300">{{ o.why }}</p>
          </li>
        </ul>

        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="group in resultGroups" :key="group.title">
            <p class="text-xs font-bold text-slate-500">{{ group.title }}</p>
            <ul
              class="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600 dark:text-slate-300"
            >
              <li v-for="(item, i) in group.items" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>

        <p
          class="rounded-xl bg-brand-50 p-3 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-100"
        >
          <span class="font-bold">Reggio lens:</span> {{ result.reggioLens }}
        </p>
      </div>
    </section>

    <aside class="space-y-4 lg:col-span-2">
      <div class="card">
        <EylfOutcomePicker v-model="manualOutcomes" />
      </div>
      <div class="card">
        <TheoryPicker v-model="manualTheories" :outcome-ids="manualOutcomes" />
      </div>
    </aside>
  </div>
  </div>
</template>
