<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MindMapEditor from '@/components/MindMapEditor.vue'
import EylfOutcomePicker from '@/components/EylfOutcomePicker.vue'
import TheoryPicker from '@/components/TheoryPicker.vue'
import { PROMPTS } from '@/data/prompts'
import { useAiTask } from '@/composables/useAiTask'
import { useChatStore } from '@/stores/chat'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import type { MindMapNode, NodeType } from '@/types'

const route = useRoute()
const router = useRouter()
const projects = useProjectStore()
const ui = useUiStore()
const chat = useChatStore()
const ai = useAiTask()

const projectId = computed(() => route.params.id as string)
const tab = ref<'map' | 'plan' | 'stories'>('map')
const nodes = ref<MindMapNode[]>([])
const mindRef = ref<InstanceType<typeof MindMapEditor> | null>(null)
const suggesting = ref(false)

const project = computed(() => projects.activeProject)
const stories = computed(() => projects.stories)

const savedLabel = computed(() =>
  projects.saving ? 'Saving…' : 'All changes saved',
)

type Suggestion = {
  questions: string[]
  themes: string[]
  activities: string[]
  resources: string[]
  outcomeIds: number[]
  theories: string[]
  reggioLens: string
}

const suggestion = ref<Suggestion | null>(null)

const TABS = [
  { id: 'map' as const, label: '🗺️ Mind map' },
  { id: 'plan' as const, label: '🎯 Outcomes & theories' },
  { id: 'stories' as const, label: '📖 Stories' },
]

function SUGGESTION_GROUPS(s: Suggestion) {
  return [
    { title: 'Lines of inquiry', items: s.themes },
    { title: 'Questions', items: s.questions },
    { title: 'Experiences', items: s.activities },
    { title: 'Resources', items: s.resources },
  ]
}

async function load() {
  if (!projectId.value) return
  await projects.loadWorkspace(projectId.value)
  nodes.value = await projects.loadNodes(projectId.value)
}

async function persistNodes(next: Partial<MindMapNode>[]) {
  if (!projectId.value) return
  await projects.saveNodes(projectId.value, next)
}

async function saveMeta(patch: Parameters<typeof projects.updateProject>[1]) {
  if (!projectId.value) return
  await projects.updateProject(projectId.value, patch)
}

async function suggestWithAi() {
  if (!project.value) return
  suggesting.value = true
  const result = await ai.run<Suggestion>(
    PROMPTS.mindmapSuggest({
      topic: project.value.inquiry_question || project.value.title,
      ageGroup: project.value.age_group ?? undefined,
    }),
  )
  suggesting.value = false
  if (result) suggestion.value = result
}

function appendSuggestionToMap() {
  if (!suggestion.value || !mindRef.value) return
  const existing = mindRef.value.collectNodes()
  const base = Date.now()
  let order = existing.length
  const rows: Partial<MindMapNode>[] = [...existing]

  const groups: { type: NodeType; items: string[] }[] = [
    { type: 'theme', items: suggestion.value.themes },
    { type: 'question', items: suggestion.value.questions },
    { type: 'activity', items: suggestion.value.activities },
    { type: 'resource', items: suggestion.value.resources },
  ]

  groups.forEach(group => {
    group.items.forEach((text, i) => {
      rows.push({
        id: `n-${base}-${group.type}-${i}`,
        parent_id: 'root',
        text,
        note: '',
        node_type: group.type,
        color: null,
        sort_order: order++,
      })
    })
  })

  nodes.value = rows.map(r => ({
    ...r,
    user_id: '',
    created_at: '',
    updated_at: '',
  })) as MindMapNode[]
  void persistNodes(rows)
  ui.showToast('Suggestions added to the mind map', 'success')
}

function askAiAboutProject() {
  if (!project.value) return
  chat.setContext({
    label: `Project: ${project.value.title}`,
    body: `Title: ${project.value.title}\nInquiry question: ${
      project.value.inquiry_question ?? '—'
    }\nAge group: ${project.value.age_group ?? '—'}\nNotes: ${
      project.value.description ?? '—'
    }`,
  })
  ui.toggleChat(true)
}

watch(tab, t => {
  if (t === 'stories') void projects.loadStories(projectId.value)
})

onMounted(load)
</script>

<template>
  <div v-if="!project" class="card text-center text-sm text-slate-500">Loading project…</div>

  <div v-else class="space-y-5">
    <header class="card">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <input
            :value="project.title"
            class="w-full border-0 bg-transparent p-0 font-display text-xl font-extrabold focus:ring-0"
            @change="saveMeta({ title: ($event.target as HTMLInputElement).value })"
          />
          <p class="text-xs text-slate-400">
            {{ project.age_group || '—' }} · {{ project.room || 'No room' }}
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn-secondary" @click="askAiAboutProject">✨ Ask AI about this</button>
          <button class="btn-ghost" @click="router.push('/projects')">← All projects</button>
        </div>
      </div>

      <div class="mt-3">
        <label class="field-label" for="w-q">Inquiry question</label>
        <input
          id="w-q"
          :value="project.inquiry_question"
          class="input"
          placeholder="What are we wondering about?"
          @change="saveMeta({ inquiry_question: ($event.target as HTMLInputElement).value })"
        />
      </div>

      <p class="mt-2 text-right text-[11px] text-slate-400">{{ savedLabel }}</p>
    </header>

    <nav class="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      <button
        v-for="t in TABS"
        :key="t.id"
        class="flex-1 rounded-lg px-3 py-2 text-sm font-bold transition"
        :class="
          tab === t.id
            ? 'bg-white text-brand-800 shadow-soft dark:bg-slate-900 dark:text-brand-200'
            : 'text-slate-500'
        "
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </nav>

    <section v-if="tab === 'map'" class="space-y-3">
      <div class="card flex flex-wrap items-center justify-between gap-3">
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Build your inquiry: lines of inquiry, questions, experiences and resources.
        </p>
        <button class="btn-primary" :disabled="suggesting" @click="suggestWithAi">
          {{ suggesting ? 'Thinking…' : '✨ AI brainstorm' }}
        </button>
      </div>

      <div v-if="ai.error.value" class="card border-rose-200 bg-rose-50 text-sm text-rose-700">
        {{ ai.error.value }}
      </div>

      <div v-if="suggestion" class="card space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="font-display text-sm font-extrabold">AI suggestions</h3>
          <button class="btn-secondary !py-1.5 text-xs" @click="appendSuggestionToMap">
            ＋ Add to mind map
          </button>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="group in SUGGESTION_GROUPS(suggestion)" :key="group.title">
            <p class="text-xs font-bold text-slate-500">{{ group.title }}</p>
            <ul
              class="mt-1 list-disc space-y-0.5 pl-4 text-xs text-slate-600 dark:text-slate-300"
            >
              <li v-for="(item, i) in group.items" :key="i">{{ item }}</li>
            </ul>
          </div>
        </div>
        <p
          v-if="suggestion.reggioLens"
          class="rounded-xl bg-brand-50 p-3 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-100"
        >
          <span class="font-bold">Reggio lens:</span> {{ suggestion.reggioLens }}
        </p>
      </div>

      <MindMapEditor
        ref="mindRef"
        :nodes="nodes"
        :central-topic="project.title"
        :saving="projects.saving"
        :on-save="persistNodes"
      />
    </section>

    <section v-else-if="tab === 'plan'" class="grid gap-5 lg:grid-cols-2">
      <div class="card">
        <EylfOutcomePicker
          :model-value="project.eylf_outcome_ids"
          @change="saveMeta({ eylf_outcome_ids: $event })"
        />
      </div>
      <div class="card">
        <TheoryPicker
          :model-value="project.theory_ids"
          :outcome-ids="project.eylf_outcome_ids"
          @change="saveMeta({ theory_ids: $event })"
        />
      </div>
    </section>

    <section v-else class="space-y-3">
      <div class="flex items-center justify-between">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ stories.length }}
          {{ stories.length === 1 ? 'learning story' : 'learning stories' }} in this
          project.
        </p>
        <RouterLink to="/learning-stories" class="btn-primary">＋ New story</RouterLink>
      </div>

      <div v-if="stories.length" class="grid gap-3 sm:grid-cols-2">
        <article v-for="story in stories" :key="story.id" class="card">
          <p class="font-bold">{{ story.title }}</p>
          <p class="text-xs text-slate-400">
            {{ story.child_name || 'Unknown child' }} · {{ story.story_date }}
          </p>
          <p class="mt-2 line-clamp-3 text-xs text-slate-600 dark:text-slate-300">
            {{ story.narrative }}
          </p>
          <div class="mt-2 flex flex-wrap gap-1">
            <span
              v-for="id in story.eylf_outcome_ids"
              :key="id"
              class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              O{{ id }}
            </span>
          </div>
        </article>
      </div>
      <div v-else class="card text-center text-sm text-slate-500">
        No learning stories yet for this project.
      </div>
    </section>
  </div>
</template>
