<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import EylfOutcomePicker from '@/components/EylfOutcomePicker.vue'
import TheoryPicker from '@/components/TheoryPicker.vue'
import { PROMPTS } from '@/data/prompts'
import { useAiTask } from '@/composables/useAiTask'
import { useChatStore } from '@/stores/chat'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import type { EylfOutcomeId, LearningStory } from '@/types'

const ai = useAiTask()
const projects = useProjectStore()
const ui = useUiStore()
const chat = useChatStore()

interface GenResult {
  title: string
  narrative: string
  analysis: string
  educatorReflection: string
  nextSteps: string
  eylfOutcomeIds: number[]
  theoryIds: string[]
}

const mode = ref<'list' | 'write'>('list')
const editingId = ref<string | null>(null)

const draft = reactive({
  child_name: '',
  story_date: new Date().toISOString().slice(0, 10),
  setting: '',
  project_id: '',
  observation: '',
  title: '',
  narrative: '',
  analysis: '',
  educator_reflection: '',
  next_steps: '',
  eylf_outcome_ids: [] as EylfOutcomeId[],
  theory_ids: [] as string[],
})

const stories = computed(() => projects.stories)

function resetDraft() {
  Object.assign(draft, {
    child_name: '',
    story_date: new Date().toISOString().slice(0, 10),
    setting: '',
    project_id: projects.activeProject?.id ?? '',
    observation: '',
    title: '',
    narrative: '',
    analysis: '',
    educator_reflection: '',
    next_steps: '',
    eylf_outcome_ids: [],
    theory_ids: [],
  })
  editingId.value = null
}

function startNew() {
  resetDraft()
  mode.value = 'write'
}

async function generate() {
  if (!draft.observation.trim()) return
  const data = await ai.run<GenResult>(
    PROMPTS.learningStory({
      child: draft.child_name,
      observation: draft.observation,
    }),
  )
  if (data) {
    draft.title = data.title
    draft.narrative = data.narrative
    draft.analysis = data.analysis
    draft.educator_reflection = data.educatorReflection
    draft.next_steps = data.nextSteps
    draft.eylf_outcome_ids = (data.eylfOutcomeIds ?? []).filter(
      id => id >= 1 && id <= 5,
    ) as EylfOutcomeId[]
    draft.theory_ids = data.theoryIds ?? []
    ui.showToast('Story drafted — review and edit', 'success')
  }
}

async function save() {
  if (!draft.narrative.trim() && !draft.title.trim()) return
  const payload = {
    child_name: draft.child_name,
    title: draft.title || 'Untitled learning story',
    setting: draft.setting,
    narrative: draft.narrative,
    analysis: draft.analysis,
    educator_reflection: draft.educator_reflection,
    next_steps: draft.next_steps,
    eylf_outcome_ids: draft.eylf_outcome_ids,
    theory_ids: draft.theory_ids,
    story_date: draft.story_date,
    project_id: draft.project_id || null,
  }
  if (editingId.value) {
    await projects.updateStory(editingId.value, payload as never)
  } else {
    await projects.createStory(payload as never)
  }
  ui.showToast('Learning story saved', 'success')
  await projects.loadStories()
  mode.value = 'list'
}

function edit(story: LearningStory) {
  editingId.value = story.id
  Object.assign(draft, {
    child_name: story.child_name,
    story_date: story.story_date,
    setting: story.setting ?? '',
    project_id: story.project_id ?? '',
    observation: '',
    title: story.title,
    narrative: story.narrative,
    analysis: story.analysis ?? '',
    educator_reflection: story.educator_reflection ?? '',
    next_steps: story.next_steps ?? '',
    eylf_outcome_ids: story.eylf_outcome_ids,
    theory_ids: story.theory_ids,
  })
  mode.value = 'write'
}

async function remove(id: string) {
  if (!window.confirm('Delete this learning story?')) return
  await projects.deleteStory(id)
  ui.showToast('Story deleted', 'info')
}

function askAi() {
  chat.setContext({
    label: `Learning story: ${draft.child_name || 'child'}`,
    body: `Observation notes: ${draft.observation}\n\nDraft analysis: ${draft.analysis}`,
  })
  ui.toggleChat(true)
}

onMounted(() => {
  void projects.loadProjects()
  void projects.loadStories()
})
</script>

<template>
  <div class="space-y-5">
    <!-- List -->
    <template v-if="mode === 'list'">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ stories.length }} {{ stories.length === 1 ? 'story' : 'stories' }} documented.
        </p>
        <button class="btn-primary" @click="startNew">＋ New learning story</button>
      </div>

      <div v-if="stories.length" class="grid gap-3 sm:grid-cols-2">
        <article v-for="story in stories" :key="story.id" class="card flex flex-col gap-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate font-bold">{{ story.title }}</p>
              <p class="text-xs text-slate-400">
                {{ story.child_name || 'Unknown child' }} · {{ story.story_date }}
              </p>
            </div>
            <span
              v-for="id in story.eylf_outcome_ids.slice(0, 3)"
              :key="id"
              class="chip shrink-0 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
            >
              O{{ id }}
            </span>
          </div>
          <p class="line-clamp-3 text-xs text-slate-600 dark:text-slate-300">
            {{ story.narrative }}
          </p>
          <div class="mt-auto flex gap-2">
            <button class="btn-secondary flex-1 !py-2 text-xs" @click="edit(story)">
              ✏️ Edit
            </button>
            <button class="btn-ghost !px-3 !py-2 text-xs" @click="remove(story.id)">🗑</button>
          </div>
        </article>
      </div>
      <div v-else class="card text-center text-sm text-slate-500 dark:text-slate-400">
        No learning stories yet — write your first one.
      </div>
    </template>

    <!-- Writer -->
    <template v-else>
      <div class="flex items-center justify-between">
        <button class="btn-ghost" @click="mode = 'list'">← Back to list</button>
        <button class="btn-primary" @click="save">💾 Save story</button>
      </div>

      <div class="card space-y-4">
        <div class="grid gap-4 sm:grid-cols-3">
          <div>
            <label class="field-label" for="s-child">Child (first name)</label>
            <input id="s-child" v-model="draft.child_name" class="input" placeholder="Amira" />
          </div>
          <div>
            <label class="field-label" for="s-date">Date</label>
            <input id="s-date" v-model="draft.story_date" type="date" class="input" />
          </div>
          <div>
            <label class="field-label" for="s-setting">Setting</label>
            <input id="s-setting" v-model="draft.setting" class="input" placeholder="Outdoor play" />
          </div>
        </div>

        <div>
          <label class="field-label" for="s-project">Link to project</label>
          <select id="s-project" v-model="draft.project_id" class="input">
            <option value="">— None —</option>
            <option v-for="p in projects.projects" :key="p.id" :value="p.id">
              {{ p.title }}
            </option>
          </select>
        </div>

        <div>
          <label class="field-label" for="s-obs">Raw notes / what you observed *</label>
          <textarea
            id="s-obs"
            v-model="draft.observation"
            class="textarea"
            rows="4"
            placeholder="Jotted notes — the AI will turn these into a learning story."
          />
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              class="btn-primary"
              :disabled="ai.loading.value || !draft.observation.trim()"
              @click="generate"
            >
              {{ ai.loading.value ? 'Writing…' : '✨ Draft with AI' }}
            </button>
            <button class="btn-ghost" @click="askAi">Ask the assistant</button>
          </div>
          <p v-if="ai.error.value" class="mt-2 text-sm text-rose-700">
            {{ ai.error.value }}
          </p>
        </div>
      </div>

      <div class="card space-y-4">
        <div>
          <label class="field-label" for="s-title">Title</label>
          <input id="s-title" v-model="draft.title" class="input" placeholder="The wobbling tower" />
        </div>

        <div>
          <label class="field-label" for="s-narrative">The story</label>
          <textarea id="s-narrative" v-model="draft.narrative" class="textarea" rows="5" />
        </div>

        <div>
          <label class="field-label" for="s-analysis">Analysis of learning</label>
          <textarea id="s-analysis" v-model="draft.analysis" class="textarea" rows="4" />
        </div>

        <div>
          <label class="field-label" for="s-reflection">Educator reflection</label>
          <textarea
            id="s-reflection"
            v-model="draft.educator_reflection"
            class="textarea"
            rows="3"
          />
        </div>

        <div>
          <label class="field-label" for="s-next">Next steps / extension</label>
          <textarea id="s-next" v-model="draft.next_steps" class="textarea" rows="3" />
        </div>
      </div>

      <div class="grid gap-5 lg:grid-cols-2">
        <div class="card">
          <EylfOutcomePicker v-model="draft.eylf_outcome_ids" />
        </div>
        <div class="card">
          <TheoryPicker v-model="draft.theory_ids" :outcome-ids="draft.eylf_outcome_ids" />
        </div>
      </div>

      <button class="btn-primary w-full" @click="save">💾 Save learning story</button>
    </template>
  </div>
</template>
