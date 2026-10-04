<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import EylfOutcomePicker from '@/components/EylfOutcomePicker.vue'
import TheoryPicker from '@/components/TheoryPicker.vue'
import UnderDevelopmentBanner from '@/components/UnderDevelopmentBanner.vue'
import { PROMPTS } from '@/data/prompts'
import { EYLF_OUTCOMES } from '@/data/eylf'
import { THEORIES } from '@/data/theories'
import { useAiTask } from '@/composables/useAiTask'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import { exportLearningStoryPdf, formatStoryDate, type LearningStoryPrintOptions } from '@/utils/pdfExport'
import { printElement } from '@/utils/printElement'
import type { EylfOutcomeId, LearningStory } from '@/types'

const ai = useAiTask()
const auth = useAuthStore()
const projects = useProjectStore()
const ui = useUiStore()
const chat = useChatStore()

interface GenResult {
  title: string
  narrative: string
  analysis: string
  nextSteps: string
  familyLink?: string
  educatorReflection?: string
  eylfOutcomeIds: number[]
  theoryIds: string[]
}

const mode = ref<'list' | 'write'>('list')
const editingId = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const targetUploadIndex = ref<number | null>(null)

// Topic suggestions state
const topicSuggestions = ref<{ title: string; angle: string }[]>([])
const loadingTopics = ref(false)

// Print / PDF modal state & user-selectable print options
const printModalOpen = ref(false)
const storyToPrint = ref<LearningStory | null>(null)

const printOpts = reactive<LearningStoryPrintOptions>({
  includePhotos: true,
  includeEylfInline: true,
  includeAnalysis: false,
  includeNextSteps: false,
  includeFamilyLink: false,
  includeEducator: false,
  includeCentreName: false,
  includeFooterTags: false,
  imageSize: 'small',
  targetFormat: '1/4-a3',
})

const photoContainerClass = computed(() => {
  if (printOpts.imageSize === 'tiny') return 'w-[68px]'
  if (printOpts.imageSize === 'medium') return 'w-[125px]'
  return 'w-[88px]' // small (1/4 A3 compact default)
})

const draft = reactive({
  child_name: '',
  educator_name: '',
  story_date: new Date().toISOString().slice(0, 10),
  setting: '',
  project_id: '',
  observation: '',
  title: '',
  narrative: '',
  analysis: '',
  next_steps: '',
  family_link: '',
  educator_reflection: '',
  photo_urls: [] as string[],
  eylf_outcome_ids: [] as EylfOutcomeId[],
  theory_ids: [] as string[],
})

const stories = computed(() => projects.stories)

const displayPhotos = computed(() => {
  if (!storyToPrint.value?.photo_urls?.length) return []
  return storyToPrint.value.photo_urls.filter(Boolean).slice(0, 2)
})

const inlineOutcomeText = computed(() => {
  if (!storyToPrint.value?.eylf_outcome_ids?.length) return ''
  return storyToPrint.value.eylf_outcome_ids
    .map(id => `EYLF Outcome ${id}`)
    .join(', ')
})

function resetDraft() {
  Object.assign(draft, {
    child_name: '',
    educator_name: auth.displayName || 'Educator',
    story_date: new Date().toISOString().slice(0, 10),
    setting: '',
    project_id: projects.activeProject?.id ?? '',
    observation: '',
    title: '',
    narrative: '',
    analysis: '',
    next_steps: '',
    family_link: '',
    educator_reflection: '',
    photo_urls: [],
    eylf_outcome_ids: [],
    theory_ids: [],
  })
  topicSuggestions.value = []
  editingId.value = null
  targetUploadIndex.value = null
}

function startNew() {
  resetDraft()
  mode.value = 'write'
}

// ---- AI generation & suggestions -------------------------------------------
async function generate() {
  if (!draft.observation.trim()) {
    ui.showToast('Please enter observation notes first', 'info')
    return
  }
  const data = await ai.run<GenResult>(
    PROMPTS.learningStory({
      child: draft.child_name,
      observation: draft.observation,
      setting: draft.setting,
    }),
  )
  if (data) {
    if (!draft.title.trim()) draft.title = data.title
    draft.narrative = data.narrative
    draft.analysis = data.analysis
    draft.next_steps = data.nextSteps
    if (data.familyLink) draft.family_link = data.familyLink
    if (data.educatorReflection) draft.educator_reflection = data.educatorReflection
    draft.eylf_outcome_ids = (data.eylfOutcomeIds ?? []).filter(
      id => id >= 1 && id <= 5,
    ) as EylfOutcomeId[]
    draft.theory_ids = data.theoryIds ?? []
    ui.showToast('Learning story drafted — review and personalize', 'success')
  }
}

async function suggestTopics() {
  if (!draft.observation.trim()) {
    ui.showToast('Please enter observation notes first', 'info')
    return
  }
  loadingTopics.value = true
  try {
    const res = await ai.run<{ topics: { title: string; angle: string }[] }>(
      PROMPTS.learningStoryTopics({
        child: draft.child_name,
        observation: draft.observation,
      }),
    )
    if (res?.topics?.length) {
      topicSuggestions.value = res.topics
      ui.showToast('AI suggested 4 story topics', 'success')
    }
  } finally {
    loadingTopics.value = false
  }
}

function applyTopic(title: string) {
  draft.title = title
  ui.showToast('Title updated', 'info')
}

// ---- Photo upload (max 2 images) -------------------------------------------
function triggerAddPhoto() {
  targetUploadIndex.value = null
  fileInput.value?.click()
}

function triggerReplacePhoto(index: number) {
  targetUploadIndex.value = index
  fileInput.value?.click()
}

function handlePhotoUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  if (targetUploadIndex.value !== null) {
    const file = files[0]
    if (file.size > 8 * 1024 * 1024) {
      ui.showToast('Please select an image smaller than 8MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      const updated = [...draft.photo_urls]
      updated[targetUploadIndex.value!] = result
      draft.photo_urls = updated
      ui.showToast('Photo updated', 'success')
    }
    reader.readAsDataURL(file)
  } else {
    const remainingSlots = 2 - draft.photo_urls.length
    if (remainingSlots <= 0) {
      ui.showToast('Maximum 2 photos allowed', 'info')
      return
    }
    const filesToRead = Array.from(files).slice(0, remainingSlots)
    for (const file of filesToRead) {
      if (file.size > 8 * 1024 * 1024) {
        ui.showToast('Please select images smaller than 8MB', 'error')
        continue
      }
      const reader = new FileReader()
      reader.onload = e => {
        if (draft.photo_urls.length < 2) {
          draft.photo_urls.push(e.target?.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
    ui.showToast('Photo attached', 'success')
  }
  target.value = ''
}

function removePhoto(index: number) {
  draft.photo_urls.splice(index, 1)
  if (fileInput.value) fileInput.value.value = ''
}

// ---- Persistence -----------------------------------------------------------
async function save() {
  if (!draft.narrative.trim() && !draft.title.trim()) {
    ui.showToast('Please provide a title or story narrative', 'info')
    return
  }
  const payload = {
    child_name: draft.child_name,
    educator_name: draft.educator_name,
    title: draft.title || 'Untitled learning story',
    setting: draft.setting,
    narrative: draft.narrative,
    analysis: draft.analysis,
    educator_reflection: draft.educator_reflection,
    next_steps: draft.next_steps,
    family_link: draft.family_link,
    photo_urls: draft.photo_urls.slice(0, 2),
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
  ui.showToast('Learning story saved to portfolio', 'success')
  await projects.loadStories()
  mode.value = 'list'
}

function edit(story: LearningStory) {
  editingId.value = story.id
  Object.assign(draft, {
    child_name: story.child_name,
    educator_name: story.educator_name || auth.displayName || 'Educator',
    story_date: story.story_date,
    setting: story.setting ?? '',
    project_id: story.project_id ?? '',
    observation: '',
    title: story.title,
    narrative: story.narrative,
    analysis: story.analysis ?? '',
    educator_reflection: story.educator_reflection ?? '',
    next_steps: story.next_steps ?? '',
    family_link: story.family_link ?? '',
    photo_urls: (story.photo_urls ?? []).slice(0, 2),
    eylf_outcome_ids: story.eylf_outcome_ids,
    theory_ids: story.theory_ids,
  })
  topicSuggestions.value = []
  targetUploadIndex.value = null
  mode.value = 'write'
}

async function remove(id: string) {
  if (!window.confirm('Delete this learning story?')) return
  try {
    await projects.deleteStory(id)
    ui.showToast('Story deleted', 'info')
  } catch (err: unknown) {
    ui.showToast((err as Error)?.message || 'Failed to delete story', 'error')
  }
}

function askAi() {
  chat.setContext({
    label: `Learning story: ${draft.child_name || 'child'}`,
    body: `Observation notes: ${draft.observation}\n\nDraft analysis: ${draft.analysis}`,
  })
  ui.toggleChat(true)
}

// ---- Printing & PDF --------------------------------------------------------
function openPrintModal(story?: LearningStory) {
  if (story) {
    storyToPrint.value = story
  } else {
    storyToPrint.value = {
      id: editingId.value || 'draft',
      user_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_id: draft.project_id || null,
      child_name: draft.child_name,
      educator_name: draft.educator_name || auth.displayName || 'Educator',
      title: draft.title || 'Untitled Learning Story',
      setting: draft.setting,
      narrative: draft.narrative,
      analysis: draft.analysis,
      next_steps: draft.next_steps,
      family_link: draft.family_link,
      educator_reflection: draft.educator_reflection,
      eylf_outcome_ids: draft.eylf_outcome_ids,
      theory_ids: draft.theory_ids,
      photo_urls: draft.photo_urls.slice(0, 2),
      story_date: draft.story_date,
    }
  }
  printModalOpen.value = true
}

function closePrintModal() {
  printModalOpen.value = false
  storyToPrint.value = null
}

function printNow() {
  printElement('printable-story-report', storyToPrint.value?.title || 'Learning Story')
}

function downloadPdf() {
  if (!storyToPrint.value) return
  const doc = exportLearningStoryPdf(storyToPrint.value, {
    ...printOpts,
    centreName: auth.profile?.centre_name || 'Hadfield Early Learning Centre',
  })
  const childSafe = (storyToPrint.value.child_name || 'child').toLowerCase().replace(/\s+/g, '-')
  doc.save(`${childSafe}-learning-story.pdf`)
  ui.showToast('PDF downloaded ready to print', 'success')
}

function outcomeLabel(id: number) {
  return EYLF_OUTCOMES.find(o => o.id === id)?.title || `Outcome ${id}`
}

function theoryLabel(id: string) {
  const found = THEORIES.find(t => t.id === id)
  return found?.name ? found.name.split('—')[0].trim() : id
}

onMounted(() => {
  void projects.loadProjects()
  void projects.loadStories()
})
</script>

<template>
  <div class="space-y-5">
    <UnderDevelopmentBanner topic-key="learning-stories" />

    <!-- ===== List Mode ===== -->
    <template v-if="mode === 'list'">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-extrabold text-slate-700 dark:text-slate-200">
            Individual Children's Books / Portfolios
          </p>
          <p class="text-xs text-slate-500 dark:text-slate-400">
            {{ stories.length }} {{ stories.length === 1 ? 'learning story' : 'learning stories' }} documented.
          </p>
        </div>
        <button class="btn-primary" @click="startNew">＋ New learning story</button>
      </div>

      <div v-if="stories.length" class="grid gap-4 sm:grid-cols-2">
        <article
          v-for="story in stories"
          :key="story.id"
          class="card flex flex-col gap-3 transition hover:shadow-soft"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0 flex-1">
              <h3 class="truncate font-display text-base font-extrabold text-slate-900 dark:text-slate-100">
                {{ story.title }}
              </h3>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ story.child_name || 'Individual child' }} · {{ formatStoryDate(story.story_date) }}
                <span v-if="story.educator_name"> · {{ story.educator_name }}</span>
              </p>
            </div>
            <!-- Thumbnails if photos present (up to 2) -->
            <div v-if="story.photo_urls?.length" class="flex gap-1 shrink-0">
              <img
                v-for="(pUrl, pIdx) in story.photo_urls.slice(0, 2)"
                :key="pIdx"
                :src="pUrl"
                alt="Story photo"
                class="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
              />
            </div>
          </div>

          <p class="line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            {{ story.narrative }}
          </p>

          <div class="flex flex-wrap items-center gap-1">
            <span
              v-for="id in story.eylf_outcome_ids.slice(0, 3)"
              :key="id"
              class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200 text-[10px]"
            >
              Outcome {{ id }}
            </span>
            <span
              v-if="story.family_link"
              class="chip bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 text-[10px]"
            >
              💬 Family link
            </span>
          </div>

          <div class="mt-auto flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button class="btn-secondary flex-1 !py-1.5 text-xs" @click="edit(story)">
              ✏️ Edit
            </button>
            <button
              class="btn-secondary !py-1.5 !px-3 text-xs"
              title="Print or export PDF report"
              @click="openPrintModal(story)"
            >
              🖨️ Print / PDF
            </button>
            <button
              v-if="projects.canDeleteStory(story)"
              class="btn-ghost !px-2.5 !py-1.5 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              title="Delete learning story"
              @click="remove(story.id)"
            >
              🗑
            </button>
            <span
              v-else
              class="inline-flex items-center text-[10px] text-slate-400 px-2 py-1 select-none"
              title="Shared with centre: You can edit and compile with AI, but only the author or Director can delete"
            >
              🔒 Shared
            </span>
          </div>
        </article>
      </div>

      <div v-else class="card text-center py-10 text-sm text-slate-500 dark:text-slate-400 space-y-3">
        <p class="text-3xl">📖</p>
        <p class="font-bold text-slate-700 dark:text-slate-300">No learning stories created yet.</p>
        <p class="text-xs max-w-md mx-auto">
          Capture individual children's moments of inquiry, schemas, and milestones with article-style wrapped photo layouts, AI topic generation, and print-ready PDF export.
        </p>
        <button class="btn-primary mt-2" @click="startNew">Create first learning story</button>
      </div>
    </template>

    <!-- ===== Writer Mode ===== -->
    <template v-else>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <button class="btn-ghost" @click="mode = 'list'">← Back to portfolio list</button>
        <div class="flex items-center gap-2">
          <button
            class="btn-secondary"
            title="Preview article layout and print / export PDF"
            @click="openPrintModal()"
          >
            🖨️ Ready to print / PDF
          </button>
          <button class="btn-primary" @click="save">💾 Save story</button>
        </div>
      </div>

      <!-- Child & Context Details -->
      <section class="card space-y-4">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label class="field-label" for="s-child">Child (first name) *</label>
            <input
              id="s-child"
              v-model="draft.child_name"
              class="input font-bold"
              placeholder="e.g. Leonardo, Lacey"
            />
          </div>
          <div>
            <label class="field-label" for="s-educator">Educator name</label>
            <input
              id="s-educator"
              v-model="draft.educator_name"
              class="input"
              placeholder="e.g. Kelly Goodsir"
            />
          </div>
          <div>
            <label class="field-label" for="s-date">Date</label>
            <input id="s-date" v-model="draft.story_date" type="date" class="input" />
          </div>
          <div>
            <label class="field-label" for="s-setting">Setting / Experience</label>
            <input
              id="s-setting"
              v-model="draft.setting"
              class="input"
              placeholder="e.g. Outdoor garden, Sandpit"
            />
          </div>
        </div>

        <div>
          <label class="field-label" for="s-project">Link to inquiry project (optional)</label>
          <select id="s-project" v-model="draft.project_id" class="input">
            <option value="">— Standalone / Not linked to project —</option>
            <option v-for="p in projects.projects" :key="p.id" :value="p.id">
              {{ p.title }}
            </option>
          </select>
        </div>
      </section>

      <!-- Raw Observation & AI Generation -->
      <section class="card space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <label class="field-label !mb-0" for="s-obs">
            Raw observation / What you observed *
          </label>
          <span class="text-[11px] text-slate-400">
            Jot down actions, quotes, and focus — AI turns them into a warm story.
          </span>
        </div>

        <textarea
          id="s-obs"
          v-model="draft.observation"
          class="textarea"
          rows="4"
          placeholder="e.g. Leonardo looked up at the sky and spotted a bright airplane with a long trail of cloud behind it. He told the group that the plane was heading to the moon..."
        />

        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button
            class="btn-primary"
            :disabled="ai.loading.value || !draft.observation.trim()"
            @click="generate"
          >
            {{ ai.loading.value ? 'Writing story…' : '✨ Draft story with AI' }}
          </button>
          <button
            class="btn-secondary"
            :disabled="loadingTopics || !draft.observation.trim()"
            @click="suggestTopics"
          >
            {{ loadingTopics ? 'Thinking…' : '💡 Suggest topics' }}
          </button>
          <button class="btn-ghost" @click="askAi">Ask AI assistant</button>
        </div>

        <!-- Topic suggestions chips -->
        <div v-if="topicSuggestions.length" class="space-y-1.5 pt-2">
          <p class="text-xs font-bold text-slate-600 dark:text-slate-300">
            Select an AI-suggested title:
          </p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(t, i) in topicSuggestions"
              :key="i"
              type="button"
              class="chip bg-brand-50 hover:bg-brand-100 text-brand-800 dark:bg-brand-950 dark:hover:bg-brand-900 dark:text-brand-200 border border-brand-200 text-xs text-left"
              @click="applyTopic(t.title)"
            >
              <span class="font-bold">{{ t.title }}</span>
              <span class="opacity-75 text-[10px] ml-1">({{ t.angle }})</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Photos Attachment (Maximum 2 Photos) -->
      <section class="card space-y-3">
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          @change="handlePhotoUpload"
        />

        <div class="flex items-center justify-between">
          <div>
            <label class="field-label !mb-0">Attached photos (maximum 2 photos)</label>
            <p class="text-[11px] text-slate-400">
              Small compact images arranged vertically on the right side with wrapped text.
            </p>
          </div>
          <button
            v-if="draft.photo_urls.length < 2"
            type="button"
            class="btn-secondary !py-1.5 !px-3 text-xs"
            @click="triggerAddPhoto"
          >
            📷 Attach photo ({{ draft.photo_urls.length }}/2)
          </button>
        </div>

        <!-- Photo previews if attached -->
        <div v-if="draft.photo_urls.length" class="grid gap-3 sm:grid-cols-2">
          <div
            v-for="(pUrl, idx) in draft.photo_urls"
            :key="idx"
            class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
          >
            <img
              :src="pUrl"
              :alt="`Photo ${idx + 1}`"
              class="h-16 w-20 object-cover rounded-lg border border-slate-300 dark:border-slate-600 shadow-xs shrink-0"
            />
            <div class="space-y-1 min-w-0 flex-1">
              <div class="flex items-center gap-1.5">
                <span class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200 text-[10px] font-bold">
                  Photo {{ idx + 1 }}
                </span>
                <span class="text-[11px] text-slate-400">Small edge wrap</span>
              </div>
              <div class="flex gap-2 pt-1">
                <button
                  type="button"
                  class="btn-secondary !py-1 !px-2.5 text-xs"
                  @click="triggerReplacePhoto(idx)"
                >
                  Replace
                </button>
                <button
                  type="button"
                  class="btn-ghost !py-1 !px-2.5 text-xs text-rose-500"
                  @click="removePhoto(idx)"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Story Narrative & Pedagogical Sections -->
      <section class="card space-y-4">
        <div>
          <label class="field-label" for="s-title">Story title / Topic *</label>
          <input
            id="s-title"
            v-model="draft.title"
            class="input font-bold text-base"
            placeholder="e.g. Leonardo's Sky Adventure"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="field-label !mb-0" for="s-narrative">
              The story (Narrative)
            </label>
            <span class="text-[11px] text-slate-400">
              Text wraps around the attached photos on the right
            </span>
          </div>
          <textarea
            id="s-narrative"
            v-model="draft.narrative"
            class="textarea"
            rows="6"
            placeholder="Leonardo looked up at the sky and spotted a bright airplane with a long trail of cloud behind it. He told the group that the plane was heading to the moon…"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="field-label !mb-0" for="s-analysis">
              What {{ draft.child_name || 'the child' }} is learning here? (Analysis)
            </label>
            <span class="text-[11px] text-slate-400">
              Schemas, sense of belonging, communication, confidence
            </span>
          </div>
          <textarea
            id="s-analysis"
            v-model="draft.analysis"
            class="textarea"
            rows="3"
            placeholder="Leonardo used imaginative language and linked the airplane to places he knows, showing his growing sense of place and belonging…"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="field-label !mb-0" for="s-next">
              Ways to support continued engagement (Next steps)
            </label>
            <span class="text-[11px] text-slate-400">
              Continuing experiences and inquiries
            </span>
          </div>
          <textarea
            id="s-next"
            v-model="draft.next_steps"
            class="textarea"
            rows="2"
            placeholder="Provide materials to fold paper planes, world maps, and binoculars in the outdoor yard…"
          />
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="field-label !mb-0" for="s-family">
              Family Connection / Question for home
            </label>
            <span class="text-[11px] text-slate-400">
              Warm question inviting dialogue with parents
            </span>
          </div>
          <textarea
            id="s-family"
            v-model="draft.family_link"
            class="textarea"
            rows="2"
            placeholder="I wonder if Leonardo has noticed airplanes passing overhead or spoken about planes at home?"
          />
        </div>

        <div>
          <label class="field-label" for="s-reflection">Educator reflection (personal notes)</label>
          <textarea
            id="s-reflection"
            v-model="draft.educator_reflection"
            class="textarea"
            rows="2"
            placeholder="I noticed Leonardo was deeply absorbed in storytelling and engaged the entire group…"
          />
        </div>
      </section>

      <!-- EYLF Outcomes & Theory Pickers -->
      <div class="grid gap-5 lg:grid-cols-2">
        <div class="card">
          <EylfOutcomePicker v-model="draft.eylf_outcome_ids" />
        </div>
        <div class="card">
          <TheoryPicker v-model="draft.theory_ids" :outcome-ids="draft.eylf_outcome_ids" />
        </div>
      </div>

      <!-- Action Footer -->
      <div class="flex flex-wrap gap-3">
        <button class="btn-secondary flex-1 !py-3 font-bold" @click="openPrintModal()">
          🖨️ Ready to print / Export PDF
        </button>
        <button class="btn-primary flex-1 !py-3 font-bold text-base" @click="save">
          💾 Save learning story
        </button>
      </div>
    </template>

    <!-- ===== Print & PDF Preview Modal (Teleported to Body for Single Page Print) ===== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="printModalOpen && storyToPrint"
          class="print-modal-portal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
          @click.self="closePrintModal"
        >
          <div class="print-modal-card relative w-full max-w-3xl rounded-2xl bg-white shadow-lift dark:bg-slate-900 my-auto p-4 sm:p-6 space-y-4 max-h-[94vh] flex flex-col">
            <!-- Modal action bar -->
            <div class="no-print flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 class="font-display text-base font-extrabold text-slate-800 dark:text-slate-100">
                  Print &amp; PDF Report Preview
                </h3>
                <p class="text-xs text-slate-500">
                  Compact 1-page layout with small edge-wrapped photos for pasting into 1/4 A3 scrapbook paper.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn-secondary !py-1.5 !px-3 text-xs" @click="downloadPdf">
                  ⤓ Download PDF
                </button>
                <button class="btn-primary !py-1.5 !px-3 text-xs" @click="printNow">
                  🖨️ Print (1 Page)
                </button>
                <button class="btn-ghost !px-2 text-slate-400 text-lg" @click="closePrintModal">
                  ✕
                </button>
              </div>
            </div>

            <!-- Size & Options Toolbar -->
            <div class="no-print p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <!-- Sizing controls row -->
              <div class="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-700">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Image size:</span>
                  <div class="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs">
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md transition"
                      :class="printOpts.imageSize === 'tiny' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.imageSize = 'tiny'"
                    >
                      Tiny (68px)
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md transition"
                      :class="printOpts.imageSize === 'small' || !printOpts.imageSize ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.imageSize = 'small'"
                    >
                      Small (88px · 1/4 A3)
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md transition"
                      :class="printOpts.imageSize === 'medium' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.imageSize = 'medium'"
                    >
                      Medium (125px)
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Format:</span>
                  <div class="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs">
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md transition"
                      :class="printOpts.targetFormat === '1/4-a3' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.targetFormat = '1/4-a3'"
                    >
                      1/4 of A3 paper
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md transition"
                      :class="printOpts.targetFormat === 'a4' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.targetFormat = 'a4'"
                    >
                      Full A4
                    </button>
                  </div>
                </div>
              </div>

              <!-- Section checkboxes -->
              <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <label class="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                  <input
                    v-model="printOpts.includePhotos"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Attached photos (max 2)</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                  <input
                    v-model="printOpts.includeEylfInline"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Inline EYLF outcome tag</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    v-model="printOpts.includeAnalysis"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>What learning happened (Analysis)</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    v-model="printOpts.includeNextSteps"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Next steps</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    v-model="printOpts.includeFamilyLink"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Family connection</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400">
                  <input
                    v-model="printOpts.includeEducator"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Child &amp; Educator details</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400">
                  <input
                    v-model="printOpts.includeCentreName"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Childcare centre header</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400">
                  <input
                    v-model="printOpts.includeFooterTags"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Theorist tags</span>
                </label>
              </div>
            </div>

            <!-- Printable Article Content (Guaranteed 1-Page Layout) -->
            <div class="overflow-y-auto flex-1 pr-1">
              <article
                id="printable-story-report"
                class="p-5 sm:p-7 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-xs max-w-xl mx-auto space-y-3.5"
                :class="printOpts.targetFormat === '1/4-a3' ? 'border-dashed border-slate-300' : ''"
              >
                <!-- Optional Top Centre Banner -->
                <p
                  v-if="printOpts.includeCentreName"
                  class="text-[10px] tracking-wider uppercase text-slate-400 font-bold"
                >
                  {{ auth.profile?.centre_name || 'Hadfield Early Learning Centre' }}
                </p>

                <!-- Header: Bold Title (left) & Bold Date (right) - Exactly like sample template -->
                <div class="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <h1 class="font-display text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    {{ storyToPrint.title || 'Learning Story' }}
                  </h1>
                  <div class="font-display text-sm sm:text-base font-bold text-slate-900 shrink-0 whitespace-nowrap">
                    {{ formatStoryDate(storyToPrint.story_date) }}
                  </div>
                </div>

                <!-- Optional Child / Educator Details -->
                <div
                  v-if="printOpts.includeEducator"
                  class="text-xs text-slate-500 font-medium pb-1.5 border-b border-slate-100"
                >
                  <span v-if="storyToPrint.child_name">Child: <strong>{{ storyToPrint.child_name }}</strong> · </span>
                  <span v-if="storyToPrint.educator_name">Educator: <strong>{{ storyToPrint.educator_name }}</strong> · </span>
                  <span v-if="storyToPrint.setting">Setting: {{ storyToPrint.setting }}</span>
                </div>

                <!-- Article Layout: Narrative with small wrapped photos on the right edge -->
                <div class="story-article-flow text-slate-900 text-sm leading-relaxed">
                  <!-- Photos stacked vertically on right edge -->
                  <div
                    v-if="printOpts.includePhotos && displayPhotos.length"
                    :class="photoContainerClass"
                    class="float-right ml-3 mb-1.5 flex flex-col gap-1.5 shrink-0"
                  >
                    <img
                      v-for="(photo, idx) in displayPhotos"
                      :key="idx"
                      :src="photo"
                      :alt="`Photo ${idx + 1}`"
                      class="w-full aspect-[4/3] object-cover rounded border border-slate-200 shadow-2xs"
                    />
                  </div>

                  <!-- Narrative with inline outcome at the end -->
                  <p class="whitespace-pre-wrap">
                    {{ storyToPrint.narrative }}
                    <span
                      v-if="printOpts.includeEylfInline && inlineOutcomeText"
                      class="font-semibold text-slate-800"
                    >
                      ({{ inlineOutcomeText }})
                    </span>
                  </p>
                  <div class="clear-both"></div>
                </div>

                <!-- Optional: What Child is Learning Here? (Analysis) -->
                <section
                  v-if="printOpts.includeAnalysis && storyToPrint.analysis"
                  class="space-y-1 pt-2.5 border-t border-slate-100"
                >
                  <h2 class="font-display text-xs font-extrabold text-teal-800">
                    What {{ storyToPrint.child_name || 'the child' }} is learning here?
                  </h2>
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {{ storyToPrint.analysis }}
                  </p>
                </section>

                <!-- Optional: Ways to support continued engagement -->
                <section
                  v-if="printOpts.includeNextSteps && storyToPrint.next_steps"
                  class="space-y-1 pt-2.5 border-t border-slate-100"
                >
                  <h2 class="font-display text-xs font-extrabold text-teal-800">
                    Ways to support continued engagement for {{ storyToPrint.child_name || 'the child' }}
                  </h2>
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {{ storyToPrint.next_steps }}
                  </p>
                </section>

                <!-- Optional: Family Link -->
                <section
                  v-if="printOpts.includeFamilyLink && storyToPrint.family_link"
                  class="space-y-1 pt-2 border-t border-slate-100 bg-amber-50/50 p-2.5 rounded-lg border border-amber-200/60"
                >
                  <h2 class="font-display text-[11px] font-extrabold text-amber-900">
                    Family Connection / Question for Home
                  </h2>
                  <p class="text-xs leading-relaxed text-amber-950 italic">
                    {{ storyToPrint.family_link }}
                  </p>
                </section>

                <!-- Optional Footer: Theorist & Outcome tags -->
                <div
                  v-if="printOpts.includeFooterTags"
                  class="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5 text-[10px] text-slate-500"
                >
                  <span
                    v-for="id in storyToPrint.eylf_outcome_ids"
                    :key="id"
                    class="chip !py-0.5 !px-2 bg-slate-100 text-slate-700 text-[10px]"
                  >
                    {{ outcomeLabel(id) }}
                  </span>
                  <span
                    v-for="tid in storyToPrint.theory_ids"
                    :key="tid"
                    class="chip !py-0.5 !px-2 bg-slate-100 text-slate-700 text-[10px]"
                  >
                    {{ theoryLabel(tid) }}
                  </span>
                </div>
              </article>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style>
@media print {
  @page {
    margin: 8mm 10mm;
    size: auto;
  }
  body > #app,
  body > #chat-dock,
  body > #toast-host {
    display: none !important;
  }
  .print-modal-portal {
    position: static !important;
    background: transparent !important;
    padding: 0 !important;
    margin: 0 !important;
    inset: auto !important;
    overflow: visible !important;
    display: block !important;
  }
  .print-modal-card {
    position: static !important;
    border: none !important;
    box-shadow: none !important;
    max-height: none !important;
    max-width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
    overflow: visible !important;
    background: transparent !important;
  }
  .no-print {
    display: none !important;
  }
  #printable-story-report {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
  }
}
</style>
