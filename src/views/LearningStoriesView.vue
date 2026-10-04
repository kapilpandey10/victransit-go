<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import EylfOutcomePicker from '@/components/EylfOutcomePicker.vue'
import TheoryPicker from '@/components/TheoryPicker.vue'
import UnderDevelopmentBanner from '@/components/UnderDevelopmentBanner.vue'
import { PROMPTS } from '@/data/prompts'
import { EYLF_OUTCOMES } from '@/data/eylf'
import { THEORIES } from '@/data/theories'
import { useAiTask } from '@/composables/useAiTask'
import { transcribeAudio } from '@/services/ai'
import { recordUntilStopped } from '@/services/voice'
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

// Filtering & Search
const searchQuery = ref('')
const selectedOutcomeFilter = ref<number | 'all'>('all')
const selectedProjectFilter = ref<string | 'all'>('all')
const sortBy = ref<'newest' | 'oldest' | 'child'>('newest')

// Writer layout mode on mobile/tablet (edit or live preview)
const writerTab = ref<'edit' | 'preview'>('edit')

// Voice dictation state
const isRecording = ref(false)
const isTranscribing = ref(false)
let recordingHandle: { stop: () => Promise<Blob>; cancel: () => void } | null = null

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

// Computed stats for the hero banner
const uniqueChildrenCount = computed(() => {
  const names = new Set(stories.value.map(s => (s.child_name || '').trim().toLowerCase()).filter(Boolean))
  return names.size
})

const totalPhotosCount = computed(() => {
  return stories.value.reduce((acc, s) => acc + (s.photo_urls?.length || 0), 0)
})

const coveredOutcomesCount = computed(() => {
  const set = new Set<number>()
  stories.value.forEach(s => s.eylf_outcome_ids?.forEach(id => set.add(id)))
  return set.size
})

// Filtered stories for list mode
const filteredStories = computed(() => {
  let list = [...stories.value]
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(
      s =>
        (s.child_name || '').toLowerCase().includes(q) ||
        (s.title || '').toLowerCase().includes(q) ||
        (s.narrative || '').toLowerCase().includes(q) ||
        (s.setting || '').toLowerCase().includes(q),
    )
  }
  if (selectedOutcomeFilter.value !== 'all') {
    list = list.filter(s => s.eylf_outcome_ids?.includes(selectedOutcomeFilter.value as EylfOutcomeId))
  }
  if (selectedProjectFilter.value !== 'all') {
    list = list.filter(s => (s.project_id || '') === selectedProjectFilter.value)
  }
  if (sortBy.value === 'newest') {
    list.sort((a, b) => (b.story_date || '').localeCompare(a.story_date || ''))
  } else if (sortBy.value === 'oldest') {
    list.sort((a, b) => (a.story_date || '').localeCompare(b.story_date || ''))
  } else if (sortBy.value === 'child') {
    list.sort((a, b) => (a.child_name || '').localeCompare(b.child_name || ''))
  }
  return list
})

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

// Draft metrics
const draftWordCount = computed(() => {
  const text = `${draft.narrative} ${draft.analysis}`.trim()
  return text ? text.split(/\s+/).length : 0
})

const draftReadTime = computed(() => {
  const words = draftWordCount.value
  return Math.max(1, Math.ceil(words / 150))
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
  writerTab.value = 'edit'
}

function startNew() {
  resetDraft()
  mode.value = 'write'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// ---- Voice Dictation -------------------------------------------------------
async function toggleVoiceRecording() {
  if (isRecording.value) {
    isRecording.value = false
    isTranscribing.value = true
    try {
      if (recordingHandle) {
        const audioBlob = await recordingHandle.stop()
        const text = await transcribeAudio(audioBlob)
        if (text) {
          draft.observation = draft.observation
            ? `${draft.observation.trim()} ${text}`
            : text
          ui.showToast('Voice transcribed and appended to observation', 'success')
        }
      }
    } catch (err) {
      ui.showToast(`Transcription error: ${(err as Error).message}`, 'error')
    } finally {
      isTranscribing.value = false
      recordingHandle = null
    }
  } else {
    try {
      recordingHandle = await recordUntilStopped()
      isRecording.value = true
      ui.showToast('Microphone recording active… speak naturally', 'info')
    } catch (err) {
      ui.showToast('Microphone access was denied or not available.', 'error')
    }
  }
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
      ui.showToast('AI suggested 4 story titles', 'success')
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
  writerTab.value = 'edit'
  mode.value = 'write'
  window.scrollTo({ top: 0, behavior: 'smooth' })
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
  <div class="space-y-6 max-w-7xl mx-auto pb-16">
    <UnderDevelopmentBanner topic-key="learning-stories" />

    <!-- ===================================================================== -->
    <!-- 1. LIST MODE: PORTFOLIO GALLERY & STORY EXPLORER                      -->
    <!-- ===================================================================== -->
    <template v-if="mode === 'list'">
      <!-- Hero Header Banner -->
      <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-900 via-brand-800 to-slate-900 p-6 sm:p-8 text-white shadow-soft">
        <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2 max-w-2xl">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-[11px] font-bold text-brand-200 border border-white/15">
              <span>📖</span>
              <span>Individual Child Portfolios &amp; Learning Journeys</span>
            </div>
            <h1 class="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
              Learning Stories Studio
            </h1>
            <p class="text-xs sm:text-sm text-brand-100/90 leading-relaxed">
              Capture individual schemas, milestone inquiries, and moments of discovery with article-style edge-wrapped photos, Reggio reflections, and 1/4 A3 scrapbook print output.
            </p>
          </div>

          <div class="flex items-center gap-3 shrink-0">
            <button
              class="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white text-brand-900 hover:bg-brand-50 font-black text-sm shadow-lift hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              @click="startNew"
            >
              <span class="text-lg">✨</span>
              <span>New Learning Story</span>
            </button>
          </div>
        </div>

        <!-- KPI Executive Ribbon -->
        <div class="relative z-10 mt-6 pt-6 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span class="text-[10px] uppercase font-bold tracking-wider text-brand-200">Total Stories</span>
            <p class="text-xl sm:text-2xl font-black text-white mt-0.5">{{ stories.length }}</p>
          </div>
          <div class="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span class="text-[10px] uppercase font-bold tracking-wider text-brand-200">Children Documented</span>
            <p class="text-xl sm:text-2xl font-black text-white mt-0.5">{{ uniqueChildrenCount }}</p>
          </div>
          <div class="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span class="text-[10px] uppercase font-bold tracking-wider text-brand-200">Attached Photos</span>
            <p class="text-xl sm:text-2xl font-black text-white mt-0.5">{{ totalPhotosCount }}</p>
          </div>
          <div class="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs">
            <span class="text-[10px] uppercase font-bold tracking-wider text-brand-200">EYLF Outcomes</span>
            <p class="text-xl sm:text-2xl font-black text-white mt-0.5">{{ coveredOutcomesCount }} / 5</p>
          </div>
        </div>
      </div>

      <!-- Search, Filter & View Controls -->
      <div class="card p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-xs">
        <!-- Search bar -->
        <div class="relative flex-1">
          <span class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            🔍
          </span>
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by child name, story title, or narrative keywords…"
            class="input pl-10 text-xs sm:text-sm"
          />
          <button
            v-if="searchQuery"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
            @click="searchQuery = ''"
          >
            ✕
          </button>
        </div>

        <!-- Filter controls -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <!-- Outcome filter -->
          <select v-model="selectedOutcomeFilter" class="input !w-auto text-xs font-semibold">
            <option :value="'all'">All EYLF Outcomes</option>
            <option v-for="o in EYLF_OUTCOMES" :key="o.id" :value="o.id">
              Outcome {{ o.id }}: {{ o.title }}
            </option>
          </select>

          <!-- Project filter -->
          <select v-model="selectedProjectFilter" class="input !w-auto text-xs font-semibold">
            <option :value="'all'">All Inquiry Projects</option>
            <option v-for="p in projects.projects" :key="p.id" :value="p.id">
              🧩 {{ p.title }}
            </option>
          </select>

          <!-- Sort dropdown -->
          <select v-model="sortBy" class="input !w-auto text-xs font-semibold">
            <option value="newest">📅 Newest Date</option>
            <option value="oldest">📅 Oldest Date</option>
            <option value="child">👶 Child (A-Z)</option>
          </select>
        </div>
      </div>

      <!-- Story Cards Grid -->
      <div v-if="filteredStories.length" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="story in filteredStories"
          :key="story.id"
          class="group card relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-5 shadow-xs hover:shadow-soft hover:border-brand-500/40 transition-all duration-200"
        >
          <!-- Top Card Meta -->
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-3">
              <div class="flex items-center gap-2.5 min-w-0">
                <!-- Child Avatar Initials -->
                <div class="h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-tr from-brand-600 to-emerald-500 text-white font-extrabold flex items-center justify-center text-xs shadow-xs">
                  {{ (story.child_name || 'C').slice(0, 2).toUpperCase() }}
                </div>
                <div class="min-w-0">
                  <span class="inline-block font-display font-extrabold text-xs text-slate-800 dark:text-slate-200 truncate">
                    {{ story.child_name || 'Individual child' }}
                  </span>
                  <p class="text-[11px] text-slate-400">
                    {{ formatStoryDate(story.story_date) }}
                  </p>
                </div>
              </div>

              <!-- Photo Thumbnails (Max 2) -->
              <div v-if="story.photo_urls?.length" class="flex gap-1 shrink-0">
                <img
                  v-for="(pUrl, pIdx) in story.photo_urls.slice(0, 2)"
                  :key="pIdx"
                  :src="pUrl"
                  alt="Story photo"
                  class="h-11 w-11 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-2xs group-hover:scale-105 transition-transform"
                />
              </div>
            </div>

            <!-- Title -->
            <h3 class="font-display text-base font-extrabold text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
              {{ story.title || 'Untitled Learning Story' }}
            </h3>

            <!-- Narrative Excerpt -->
            <p class="line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {{ story.narrative || 'No narrative text written yet.' }}
            </p>

            <!-- Badges -->
            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <span
                v-for="id in (story.eylf_outcome_ids || []).slice(0, 2)"
                :key="id"
                class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800"
              >
                Outcome {{ id }}
              </span>
              <span
                v-if="story.family_link"
                class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1"
              >
                <span>💬</span>
                <span>Family</span>
              </span>
              <span
                v-if="story.setting"
                class="px-2 py-0.5 rounded-full text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 truncate max-w-[120px]"
              >
                📍 {{ story.setting }}
              </span>
            </div>
          </div>

          <!-- Bottom Actions -->
          <div class="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 flex-1">
              <button
                class="btn-secondary !py-1.5 !px-3 text-xs font-bold flex-1 flex items-center justify-center gap-1"
                @click="edit(story)"
              >
                <span>✏️</span>
                <span>Edit</span>
              </button>
              <button
                class="btn-secondary !py-1.5 !px-3 text-xs font-bold flex items-center justify-center gap-1"
                title="Print or export PDF report"
                @click="openPrintModal(story)"
              >
                <span>🖨️</span>
                <span>Print</span>
              </button>
            </div>

            <!-- Delete or Shared badge -->
            <div>
              <button
                v-if="projects.canDeleteStory(story)"
                class="btn-ghost !p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl"
                title="Delete story"
                @click="remove(story.id)"
              >
                🗑
              </button>
              <span
                v-else
                class="inline-flex items-center text-[10px] text-slate-400 px-2 py-1 select-none font-bold"
                title="Shared with centre: Only author can delete"
              >
                🔒 Shared
              </span>
            </div>
          </div>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="card text-center py-16 px-4 space-y-4 max-w-xl mx-auto border-dashed border-2 border-slate-200 dark:border-slate-800">
        <div class="h-16 w-16 mx-auto rounded-3xl bg-brand-50 dark:bg-brand-950/60 text-brand-600 dark:text-brand-400 flex items-center justify-center text-3xl shadow-soft">
          🌱
        </div>
        <div class="space-y-1">
          <h3 class="font-display text-lg font-black text-slate-900 dark:text-slate-100">
            {{ searchQuery ? 'No matching learning stories' : 'No learning stories recorded yet' }}
          </h3>
          <p class="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            {{
              searchQuery
                ? 'Try adjusting your search keywords or clearing filters.'
                : 'Capture individual children’s learning inquiries with hands-free voice dictation, Reggio Emilia principles, and 1/4 A3 scrapbook print layouts.'
            }}
          </p>
        </div>
        <div class="pt-2">
          <button v-if="searchQuery" class="btn-secondary text-xs" @click="searchQuery = ''; selectedOutcomeFilter = 'all'; selectedProjectFilter = 'all'">
            Clear all filters
          </button>
          <button v-else class="btn-primary text-xs font-bold px-5 py-2.5" @click="startNew">
            ✨ Create First Learning Story
          </button>
        </div>
      </div>
    </template>

    <!-- ===================================================================== -->
    <!-- 2. WRITER MODE: PEDAGOGICAL STUDIO & SCRAPBOOK EDITOR                 -->
    <!-- ===================================================================== -->
    <template v-else>
      <!-- Top Sticky Action Bar -->
      <div class="sticky top-14 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 shadow-soft">
        <div class="flex items-center gap-3">
          <button
            class="btn-ghost !px-3 !py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"
            @click="mode = 'list'"
          >
            <span>←</span>
            <span>Portfolio List</span>
          </button>
          <div class="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />
          <span class="text-xs font-extrabold text-slate-800 dark:text-slate-200 hidden sm:inline">
            {{ editingId ? 'Editing Learning Story' : 'New Learning Story Studio' }}
          </span>
          <!-- Mobile tab switcher -->
          <div class="flex xl:hidden rounded-xl border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800 text-xs">
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg font-bold transition"
              :class="writerTab === 'edit' ? 'bg-white dark:bg-slate-900 shadow-xs text-brand-600 dark:text-brand-400' : 'text-slate-500'"
              @click="writerTab = 'edit'"
            >
              ✍️ Story Editor
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg font-bold transition"
              :class="writerTab === 'preview' ? 'bg-white dark:bg-slate-900 shadow-xs text-brand-600 dark:text-brand-400' : 'text-slate-500'"
              @click="writerTab = 'preview'"
            >
              👁️ Scrapbook Preview
            </button>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <!-- Reading stats badge -->
          <div class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 font-medium">
            <span>{{ draftWordCount }} words</span>
            <span>·</span>
            <span>~{{ draftReadTime }} min read</span>
          </div>

          <button
            class="btn-secondary !py-2 !px-3 text-xs font-bold flex items-center gap-1.5"
            title="Preview article layout and print / export PDF"
            @click="openPrintModal()"
          >
            <span>🖨️</span>
            <span class="hidden sm:inline">Ready to Print / PDF</span>
            <span class="sm:hidden">Print</span>
          </button>

          <button
            class="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5 shadow-sm"
            @click="save"
          >
            <span>💾</span>
            <span>Save Story</span>
          </button>
        </div>
      </div>

      <!-- Studio Responsive Workspace -->
      <div class="grid gap-6 xl:grid-cols-12 items-start">
        <!-- Main Form Column (7 cols on Desktop, hidden on mobile if preview tab active) -->
        <div
          class="space-y-6 xl:col-span-7"
          :class="{ 'hidden xl:block': writerTab === 'preview' }"
        >
          <!-- 1. Child & Setting Context Card -->
          <section class="card space-y-4">
            <h2 class="font-display text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <span>👶</span>
              <span>Child &amp; Setting Context</span>
            </h2>

            <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label class="field-label" for="s-child">Child First Name *</label>
                <input
                  id="s-child"
                  v-model="draft.child_name"
                  class="input font-bold text-sm"
                  placeholder="e.g. Leonardo, Lacey"
                />
              </div>
              <div>
                <label class="field-label" for="s-educator">Author / Educator</label>
                <input
                  id="s-educator"
                  v-model="draft.educator_name"
                  class="input text-xs"
                  placeholder="e.g. Kelly Goodsir"
                />
              </div>
              <div>
                <label class="field-label" for="s-date">Observation Date</label>
                <input id="s-date" v-model="draft.story_date" type="date" class="input text-xs" />
              </div>
              <div>
                <label class="field-label" for="s-setting">Learning Environment</label>
                <input
                  id="s-setting"
                  v-model="draft.setting"
                  class="input text-xs"
                  placeholder="e.g. Outdoor garden, Sandpit"
                />
              </div>
            </div>

            <div>
              <label class="field-label" for="s-project">Link to Inquiry Project (Optional)</label>
              <select id="s-project" v-model="draft.project_id" class="input text-xs font-semibold">
                <option value="">— Standalone Portfolio Story (Not linked to project) —</option>
                <option v-for="p in projects.projects" :key="p.id" :value="p.id">
                  🧩 {{ p.title }}
                </option>
              </select>
            </div>
          </section>

          <!-- 2. Raw Observation & Voice Dictation Notepad -->
          <section class="card space-y-3.5 border-brand-200/60 dark:border-brand-900/60">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div>
                <h2 class="font-display text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <span>🎙️</span>
                  <span>Observation Notes &amp; Raw Insights</span>
                </h2>
                <p class="text-[11px] text-slate-400">
                  Type or dictate child quotes, schemas, and actions — AI expands them into an EYLF story.
                </p>
              </div>

              <!-- Microphone Voice Dictation Button -->
              <button
                type="button"
                class="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs"
                :class="
                  isRecording
                    ? 'bg-rose-600 text-white animate-pulse'
                    : isTranscribing
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200'
                      : 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border border-brand-200 dark:border-brand-800 hover:bg-brand-100'
                "
                :disabled="isTranscribing"
                @click="toggleVoiceRecording"
              >
                <span>{{ isRecording ? '⏹ Stop Recording' : isTranscribing ? '⏳ Transcribing…' : '🎤 Voice Dictate' }}</span>
              </button>
            </div>

            <textarea
              id="s-obs"
              v-model="draft.observation"
              class="textarea text-xs sm:text-sm font-normal leading-relaxed"
              rows="4"
              placeholder="e.g. Leonardo looked up at the sky and spotted a bright airplane with a long trail of cloud behind it. He told the group that the plane was heading to the moon..."
            />

            <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div class="flex flex-wrap items-center gap-2">
                <button
                  class="btn-primary !py-2 !px-4 text-xs font-bold flex items-center gap-1.5"
                  :disabled="ai.loading.value || !draft.observation.trim()"
                  @click="generate"
                >
                  <span>{{ ai.loading.value ? 'Writing Story…' : '✨ Draft Story with AI' }}</span>
                </button>
                <button
                  class="btn-secondary !py-2 !px-3 text-xs font-bold flex items-center gap-1.5"
                  :disabled="loadingTopics || !draft.observation.trim()"
                  @click="suggestTopics"
                >
                  <span>{{ loadingTopics ? 'Thinking…' : '💡 Suggest Titles' }}</span>
                </button>
              </div>

              <button class="btn-ghost !text-xs !py-1 text-slate-500 hover:text-slate-800" @click="askAi">
                💬 Ask Assistant
              </button>
            </div>

            <!-- Topic Suggestions -->
            <div v-if="topicSuggestions.length" class="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p class="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Select an AI Suggested Title:
              </p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="(t, i) in topicSuggestions"
                  :key="i"
                  type="button"
                  class="px-3 py-1.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-800 dark:bg-brand-950 dark:hover:bg-brand-900 dark:text-brand-200 border border-brand-200 dark:border-brand-800 text-xs text-left transition cursor-pointer"
                  @click="applyTopic(t.title)"
                >
                  <span class="font-bold">{{ t.title }}</span>
                  <span class="opacity-75 text-[10px] ml-1">({{ t.angle }})</span>
                </button>
              </div>
            </div>
          </section>

          <!-- 3. Story Narrative & Analysis Fields -->
          <section class="card space-y-5">
            <div>
              <label class="field-label" for="s-title">Story Title *</label>
              <input
                id="s-title"
                v-model="draft.title"
                class="input font-display font-extrabold text-base sm:text-lg"
                placeholder="e.g. Leonardo's Sky Adventure"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="field-label !mb-0" for="s-narrative">
                  The Story Narrative (Article Body)
                </label>
                <span class="text-[11px] text-slate-400">
                  Wraps smoothly around photos in print
                </span>
              </div>
              <textarea
                id="s-narrative"
                v-model="draft.narrative"
                class="textarea text-xs sm:text-sm leading-relaxed"
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
                  Cognitive schemas, EYLF learning outcomes
                </span>
              </div>
              <textarea
                id="s-analysis"
                v-model="draft.analysis"
                class="textarea text-xs sm:text-sm leading-relaxed"
                rows="3"
                placeholder="Leonardo used imaginative language and linked the airplane to places he knows, showing his growing sense of place and belonging…"
              />
            </div>

            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="field-label !mb-0" for="s-next">
                  Ways to Support Continued Engagement (Next Steps)
                </label>
                <span class="text-[11px] text-slate-400">
                  Curriculum extensions &amp; provocations
                </span>
              </div>
              <textarea
                id="s-next"
                v-model="draft.next_steps"
                class="textarea text-xs sm:text-sm leading-relaxed"
                rows="2"
                placeholder="Provide materials to fold paper planes, world maps, and binoculars in the outdoor yard…"
              />
            </div>

            <!-- Family Connection (Warm highlight) -->
            <div class="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/60 space-y-1.5">
              <label class="field-label !mb-0 text-amber-900 dark:text-amber-200 font-bold" for="s-family">
                💬 Family Connection / Question for Home
              </label>
              <textarea
                id="s-family"
                v-model="draft.family_link"
                class="textarea bg-white dark:bg-slate-900 text-xs sm:text-sm"
                rows="2"
                placeholder="I wonder if Leonardo has noticed airplanes passing overhead or spoken about planes at home?"
              />
            </div>

            <div>
              <label class="field-label" for="s-reflection">Educator Reflection (Private practitioner notes)</label>
              <textarea
                id="s-reflection"
                v-model="draft.educator_reflection"
                class="textarea text-xs"
                rows="2"
                placeholder="I noticed Leonardo was deeply absorbed in storytelling and engaged the entire group…"
              />
            </div>
          </section>

          <!-- 4. EYLF Outcomes & Theory Pickers -->
          <div class="grid gap-5 lg:grid-cols-2">
            <div class="card">
              <EylfOutcomePicker v-model="draft.eylf_outcome_ids" />
            </div>
            <div class="card">
              <TheoryPicker v-model="draft.theory_ids" :outcome-ids="draft.eylf_outcome_ids" />
            </div>
          </div>
        </div>

        <!-- Studio Sidebar / Live Preview Column (5 cols on Desktop) -->
        <div
          class="space-y-6 xl:col-span-5"
          :class="{ 'hidden xl:block': writerTab === 'edit' }"
        >
          <!-- Photo Attachment Studio (Max 2 Photos) -->
          <section class="card space-y-3.5">
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              multiple
              class="hidden"
              @change="handlePhotoUpload"
            />

            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <div>
                <h3 class="font-display text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                  <span>📷</span>
                  <span>Attached Photos ({{ draft.photo_urls.length }}/2)</span>
                </h3>
                <p class="text-[11px] text-slate-400">
                  Small edge-wrapped photos for scrapbook paper
                </p>
              </div>

              <button
                v-if="draft.photo_urls.length < 2"
                type="button"
                class="btn-secondary !py-1.5 !px-3 text-xs font-bold"
                @click="triggerAddPhoto"
              >
                ＋ Add Photo
              </button>
            </div>

            <!-- Empty upload prompt -->
            <div
              v-if="!draft.photo_urls.length"
              class="border-2 border-dashed border-slate-200 dark:border-slate-700/80 rounded-2xl p-6 text-center space-y-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
              @click="triggerAddPhoto"
            >
              <span class="text-3xl">🖼️</span>
              <p class="font-bold text-xs text-slate-700 dark:text-slate-200">
                Click to attach moments of discovery
              </p>
              <p class="text-[11px] text-slate-400">
                Maximum 2 photos arranged neatly on the right edge.
              </p>
            </div>

            <!-- Attached photo previews -->
            <div v-else class="space-y-3">
              <div
                v-for="(pUrl, idx) in draft.photo_urls"
                :key="idx"
                class="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
              >
                <img
                  :src="pUrl"
                  :alt="`Photo ${idx + 1}`"
                  class="h-16 w-20 object-cover rounded-xl border border-slate-300 dark:border-slate-600 shadow-xs shrink-0"
                />
                <div class="space-y-1 min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200 text-[10px] font-bold">
                      Photo {{ idx + 1 }}
                    </span>
                    <span class="text-[11px] text-slate-400">Right-edge wrap</span>
                  </div>
                  <div class="flex gap-2 pt-1">
                    <button
                      type="button"
                      class="btn-secondary !py-1 !px-2.5 text-[11px] font-bold"
                      @click="triggerReplacePhoto(idx)"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      class="btn-ghost !py-1 !px-2.5 text-[11px] font-bold text-rose-500"
                      @click="removePhoto(idx)"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- Live Miniature Scrapbook Preview Card -->
          <section class="card space-y-3">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <h3 class="font-display text-xs font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <span>👁️</span>
                <span>Live Scrapbook Preview</span>
              </h3>
              <span class="text-[10px] font-bold text-brand-600 dark:text-brand-400">
                1/4 A3 Paper Layout
              </span>
            </div>

            <!-- Mini rendered preview sheet -->
            <div class="p-4 sm:p-5 rounded-2xl bg-white text-slate-900 border border-dashed border-slate-300 shadow-sm space-y-3 text-xs">
              <div class="flex items-baseline justify-between gap-2 border-b border-slate-100 pb-2">
                <h4 class="font-display font-black text-sm text-slate-900 truncate">
                  {{ draft.title || 'Story Title' }}
                </h4>
                <span class="text-[11px] font-bold text-slate-500 whitespace-nowrap">
                  {{ formatStoryDate(draft.story_date) }}
                </span>
              </div>

              <!-- Wrapped Photos & Text -->
              <div class="text-xs leading-relaxed text-slate-800">
                <div
                  v-if="draft.photo_urls.length"
                  class="float-right ml-2.5 mb-1.5 flex flex-col gap-1 w-[80px]"
                >
                  <img
                    v-for="(p, pI) in draft.photo_urls"
                    :key="pI"
                    :src="p"
                    class="w-full aspect-[4/3] object-cover rounded border border-slate-200 shadow-2xs"
                  />
                </div>
                <p class="whitespace-pre-wrap">
                  {{ draft.narrative || 'Story narrative text will flow here, wrapping cleanly around your photos on the right edge.' }}
                </p>
                <div class="clear-both" />
              </div>

              <!-- Quick outcome tags -->
              <div v-if="draft.eylf_outcome_ids.length" class="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                <span
                  v-for="id in draft.eylf_outcome_ids"
                  :key="id"
                  class="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-bold"
                >
                  EYLF Outcome {{ id }}
                </span>
              </div>
            </div>

            <button
              type="button"
              class="btn-secondary w-full text-xs font-bold py-2 flex items-center justify-center gap-1.5"
              @click="openPrintModal()"
            >
              <span>🖨️</span>
              <span>Open Full Print / PDF Studio</span>
            </button>
          </section>
        </div>
      </div>
    </template>

    <!-- ===================================================================== -->
    <!-- 3. PRINT & PDF MODAL (Single-Page Scrapbook Output)                   -->
    <!-- ===================================================================== -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="printModalOpen && storyToPrint"
          class="print-modal-portal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/75 backdrop-blur-sm overflow-y-auto"
          @click.self="closePrintModal"
        >
          <div class="print-modal-card relative w-full max-w-3xl rounded-3xl bg-white shadow-lift dark:bg-slate-900 my-auto p-4 sm:p-6 space-y-4 max-h-[92vh] flex flex-col">
            <!-- Modal Action Bar -->
            <div class="no-print flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 class="font-display text-base font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>🖨️</span>
                  <span>Print &amp; PDF Scrapbook Studio</span>
                </h3>
                <p class="text-xs text-slate-500">
                  Compact 1-page layout with edge-wrapped photos for pasting into 1/4 A3 portfolio paper.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn-secondary !py-1.5 !px-3 text-xs font-bold" @click="downloadPdf">
                  ⤓ Download PDF
                </button>
                <button class="btn-primary !py-1.5 !px-3 text-xs font-bold" @click="printNow">
                  🖨️ Print (1 Page)
                </button>
                <button class="btn-ghost !px-2.5 text-slate-400 hover:text-slate-700 text-lg" @click="closePrintModal">
                  ✕
                </button>
              </div>
            </div>

            <!-- Size & Options Toolbar -->
            <div class="no-print p-3.5 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <!-- Sizing controls row -->
              <div class="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-200/80 dark:border-slate-700">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Image size:</span>
                  <div class="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs">
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-lg transition"
                      :class="printOpts.imageSize === 'tiny' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.imageSize = 'tiny'"
                    >
                      Tiny (68px)
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-lg transition"
                      :class="printOpts.imageSize === 'small' || !printOpts.imageSize ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.imageSize = 'small'"
                    >
                      Small (88px · 1/4 A3)
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-lg transition"
                      :class="printOpts.imageSize === 'medium' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.imageSize = 'medium'"
                    >
                      Medium (125px)
                    </button>
                  </div>
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-slate-700 dark:text-slate-200">Format:</span>
                  <div class="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs">
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-lg transition"
                      :class="printOpts.targetFormat === '1/4-a3' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="printOpts.targetFormat = '1/4-a3'"
                    >
                      1/4 of A3 paper
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-lg transition"
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
                  <span>Centre header</span>
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
                class="p-5 sm:p-7 bg-white text-slate-900 rounded-2xl border border-slate-200 shadow-xs max-w-xl mx-auto space-y-3.5"
                :class="printOpts.targetFormat === '1/4-a3' ? 'border-dashed border-slate-300' : ''"
              >
                <!-- Optional Top Centre Banner -->
                <p
                  v-if="printOpts.includeCentreName"
                  class="text-[10px] tracking-wider uppercase text-slate-400 font-bold"
                >
                  {{ auth.profile?.centre_name || 'Hadfield Early Learning Centre' }}
                </p>

                <!-- Header: Bold Title & Date -->
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
                      class="w-full aspect-[4/3] object-cover rounded-lg border border-slate-200 shadow-2xs"
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
                  <div class="clear-both" />
                </div>

                <!-- Optional: Analysis -->
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

                <!-- Optional: Next steps -->
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
                  class="space-y-1 pt-2 border-t border-slate-100 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60"
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
