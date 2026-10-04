<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import MarkdownView from '@/components/MarkdownView.vue'
import UnderDevelopmentBanner from '@/components/UnderDevelopmentBanner.vue'
import { PROMPTS } from '@/data/prompts'
import { useAiTask } from '@/composables/useAiTask'
import { useContentStore } from '@/stores/content'
import { useUiStore } from '@/stores/ui'
import type { EylfOutcomeId } from '@/types'

const ai = useAiTask()
const content = useContentStore()
const ui = useUiStore()

interface GenResult {
  title: string
  content: string
  highlights: string[]
  eylfOutcomeIds: number[]
}

const mode = ref<'list' | 'write'>('list')
const editingId = ref<string | null>(null)
const preview = ref(false)

const draft = reactive({
  term: '',
  audience: 'families',
  highlights: '',
  title: '',
  content: '',
  eylf_outcome_ids: [] as EylfOutcomeId[],
})

const newsletters = computed(() => content.newsletters)

function startNew() {
  editingId.value = null
  Object.assign(draft, {
    term: '',
    audience: 'families',
    highlights: '',
    title: '',
    content: '',
    eylf_outcome_ids: [],
  })
  mode.value = 'write'
}

async function generate() {
  if (!draft.highlights.trim()) return
  const data = await ai.run<GenResult>(
    PROMPTS.newsletter({
      term: draft.term,
      audience: draft.audience,
      highlights: draft.highlights,
    }),
  )
  if (data) {
    draft.title = data.title
    draft.content = data.content
    draft.eylf_outcome_ids = (data.eylfOutcomeIds ?? []).filter(
      id => id >= 1 && id <= 5,
    ) as EylfOutcomeId[]
    ui.showToast('Newsletter drafted', 'success')
  }
}

async function save() {
  if (!draft.content.trim()) return
  await content.saveNewsletter(
    {
      title: draft.title || 'Newsletter',
      content: draft.content,
      term: draft.term,
      eylf_outcome_ids: draft.eylf_outcome_ids,
    },
    editingId.value ?? undefined,
  )
  ui.showToast('Newsletter saved', 'success')
  await content.loadNewsletters()
  mode.value = 'list'
}

function edit(item: (typeof newsletters.value)[number]) {
  editingId.value = item.id
  Object.assign(draft, {
    term: item.term ?? '',
    audience: 'families',
    highlights: '',
    title: item.title,
    content: item.content,
    eylf_outcome_ids: item.eylf_outcome_ids,
  })
  mode.value = 'write'
}

async function remove(id: string) {
  if (!window.confirm('Delete this newsletter?')) return
  await content.deleteNewsletter(id)
}

onMounted(() => content.loadNewsletters())
</script>

<template>
  <div class="space-y-5">
    <UnderDevelopmentBanner topic-key="newsletters" />

    <template v-if="mode === 'list'">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ newsletters.length }} saved
          {{ newsletters.length === 1 ? 'newsletter' : 'newsletters' }}.
        </p>
        <button class="btn-primary" @click="startNew">＋ New newsletter</button>
      </div>

      <div v-if="newsletters.length" class="grid gap-3 sm:grid-cols-2">
        <article v-for="item in newsletters" :key="item.id" class="card flex flex-col gap-2">
          <p class="font-bold">{{ item.title }}</p>
          <p class="text-xs text-slate-400">{{ item.term || 'No term' }}</p>
          <p class="line-clamp-4 text-xs text-slate-600 dark:text-slate-300">
            {{ item.content }}
          </p>
          <div class="mt-auto flex gap-2">
            <button class="btn-secondary flex-1 !py-2 text-xs" @click="edit(item)">
              ✏️ Edit
            </button>
            <button class="btn-ghost !px-3 !py-2 text-xs" @click="remove(item.id)">🗑</button>
          </div>
        </article>
      </div>
      <div v-else class="card text-center text-sm text-slate-500 dark:text-slate-400">
        No newsletters yet.
      </div>
    </template>

    <template v-else>
      <div class="flex items-center justify-between">
        <button class="btn-ghost" @click="mode = 'list'">← Back to list</button>
        <div class="flex gap-2">
          <button class="btn-secondary" @click="preview = !preview">
            {{ preview ? '✏️ Edit' : '👁 Preview' }}
          </button>
          <button class="btn-primary" @click="save">💾 Save</button>
        </div>
      </div>

      <div class="card space-y-4">
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="field-label" for="n-term">Term / period</label>
            <input id="n-term" v-model="draft.term" class="input" placeholder="Term 1, 2026" />
          </div>
          <div>
            <label class="field-label" for="n-audience">Audience</label>
            <input id="n-audience" v-model="draft.audience" class="input" placeholder="families" />
          </div>
        </div>

        <div>
          <label class="field-label" for="n-hi">Learning highlights (one per line) *</label>
          <textarea
            id="n-hi"
            v-model="draft.highlights"
            class="textarea"
            rows="5"
            placeholder="Learned to write our names"
          />
          <button
            class="btn-primary mt-2"
            :disabled="ai.loading.value || !draft.highlights.trim()"
            @click="generate"
          >
            {{ ai.loading.value ? 'Writing…' : '✨ Draft newsletter' }}
          </button>
          <p v-if="ai.error.value" class="mt-2 text-sm text-rose-700">{{ ai.error.value }}</p>
        </div>
      </div>

      <div class="card space-y-4">
        <div>
          <label class="field-label" for="n-title">Title</label>
          <input id="n-title" v-model="draft.title" class="input" />
        </div>

        <div v-if="preview" class="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 class="mb-2 font-display text-lg font-extrabold">{{ draft.title }}</h3>
          <MarkdownView :source="draft.content" />
        </div>
        <div v-else>
          <label class="field-label" for="n-content">Content (Markdown supported)</label>
          <textarea id="n-content" v-model="draft.content" class="textarea" rows="14" />
        </div>
      </div>
    </template>
  </div>
</template>
