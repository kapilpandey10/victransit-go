<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import EylfOutcomePicker from '@/components/EylfOutcomePicker.vue'
import TheoryPicker from '@/components/TheoryPicker.vue'
import UnderDevelopmentBanner from '@/components/UnderDevelopmentBanner.vue'
import { PROMPTS } from '@/data/prompts'
import { EYLF_OUTCOMES } from '@/data/eylf'
import { ROOMS } from '@/data/rooms'
import { useAiTask } from '@/composables/useAiTask'
import { useAuthStore } from '@/stores/auth'
import { useContentStore } from '@/stores/content'
import { useProjectStore } from '@/stores/project'
import { useRoomsStore } from '@/stores/rooms'
import { useUiStore } from '@/stores/ui'
import { exportProgramBookPdf, formatStoryDate, type ProgramBookPrintOptions } from '@/utils/pdfExport'
import { printElement } from '@/utils/printElement'
import type { Activity, EylfOutcomeId } from '@/types'

const ai = useAiTask()
const auth = useAuthStore()
const content = useContentStore()
const projects = useProjectStore()
const roomsStore = useRoomsStore()
const ui = useUiStore()

const roomList = computed(() => roomsStore.roomNames)

// Main view mode: Experiences vs Analysis
const viewTab = ref<'experiences' | 'analysis'>('experiences')

// ============================================================================
// 1. PROGRAMMING EXPERIENCES (Group, Inquiry, Intentional Learning)
// ============================================================================
const expMode = ref<'list' | 'write'>('list')
const editingExpId = ref<string | null>(null)
const expFileInput = ref<HTMLInputElement | null>(null)
const targetExpUploadIndex = ref<number | null>(null)

// Topic suggestions
const topicSuggestions = ref<{ title: string; type: string; description: string }[]>([])
const loadingTopics = ref(false)

// Print / PDF modal
const printModalOpen = ref(false)
const expToPrint = ref<Activity | null>(null)

const expPrintOpts = reactive<ProgramBookPrintOptions>({
  includePhotos: true,
  includeEylfInline: true,
  includeLearningIntentions: false,
  includeStrategies: false,
  includeResources: false,
  includeExtensions: false,
  includeEducator: false,
  includeCentreName: false,
  includeFooterTags: false,
  imageSize: 'small',
  targetFormat: '1/4-a3',
})

const expPhotoContainerClass = computed(() => {
  if (expPrintOpts.imageSize === 'tiny') return 'w-[68px]'
  if (expPrintOpts.imageSize === 'medium') return 'w-[125px]'
  return 'w-[88px]' // small (1/4 A3 compact default)
})

const expDraft = reactive({
  title: '',
  room: (roomsStore.roomNames[0] || 'Blossoms') as string,
  experience_type: 'group' as 'group' | 'inquiry' | 'intentional' | 'spontaneous',
  date: new Date().toISOString().slice(0, 10),
  educator_name: '',
  description: '',
  learning_intentions: '',
  success_criteria: '',
  resources: '',
  extension_ideas: '',
  photo_urls: [] as string[],
  eylf_outcome_ids: [] as EylfOutcomeId[],
  theory_ids: [] as string[],
  project_id: '',
})

const activities = computed(() => projects.activities)

const expDisplayPhotos = computed(() => {
  if (!expToPrint.value?.photo_urls?.length) return []
  return expToPrint.value.photo_urls.filter(Boolean).slice(0, 2)
})

const expInlineOutcomeText = computed(() => {
  if (!expToPrint.value?.eylf_outcome_ids?.length) return ''
  return expToPrint.value.eylf_outcome_ids
    .map(id => `EYLF Outcome ${id}`)
    .join(', ')
})

function resetExpDraft() {
  Object.assign(expDraft, {
    title: '',
    room: roomsStore.roomNames[0] || 'Blossoms',
    experience_type: 'group',
    date: new Date().toISOString().slice(0, 10),
    educator_name: auth.displayName || 'Educator',
    description: '',
    learning_intentions: '',
    success_criteria: '',
    resources: '',
    extension_ideas: '',
    photo_urls: [],
    eylf_outcome_ids: [],
    theory_ids: [],
    project_id: '',
  })
  topicSuggestions.value = []
  editingExpId.value = null
  targetExpUploadIndex.value = null
}

function startNewExp() {
  resetExpDraft()
  expMode.value = 'write'
}

interface GenExpResult {
  title: string
  experienceType: 'group' | 'inquiry' | 'intentional' | 'spontaneous'
  narrative: string
  learningIntentions: string[]
  teachingStrategies: string
  environmentResources: string
  nextSteps: string
  eylfOutcomeIds: number[]
  theoryIds: string[]
}

async function generateExp() {
  if (!expDraft.description.trim()) {
    ui.showToast('Please enter observation notes or idea first', 'info')
    return
  }
  const data = await ai.run<GenExpResult>(
    PROMPTS.programExperience({
      topicOrNotes: expDraft.description,
      room: expDraft.room,
      type: expDraft.experience_type,
    }),
  )
  if (data) {
    if (!expDraft.title.trim()) expDraft.title = data.title
    expDraft.experience_type = data.experienceType || expDraft.experience_type
    expDraft.description = data.narrative
    expDraft.learning_intentions = (data.learningIntentions || []).join('\n')
    expDraft.success_criteria = data.teachingStrategies || ''
    expDraft.resources = data.environmentResources || ''
    expDraft.extension_ideas = data.nextSteps || ''
    expDraft.eylf_outcome_ids = (data.eylfOutcomeIds ?? []).filter(
      id => id >= 1 && id <= 5,
    ) as EylfOutcomeId[]
    expDraft.theory_ids = data.theoryIds ?? []
    ui.showToast('Curriculum experience planned', 'success')
  }
}

async function suggestExpTopics() {
  if (!expDraft.description.trim()) {
    ui.showToast('Please enter rough notes or room interests first', 'info')
    return
  }
  loadingTopics.value = true
  try {
    const res = await ai.run<{ topics: { title: string; type: string; description: string }[] }>(
      PROMPTS.programExperienceTopics({
        notes: expDraft.description,
        room: expDraft.room,
      }),
    )
    if (res?.topics?.length) {
      topicSuggestions.value = res.topics
      ui.showToast('AI suggested 4 curriculum topics', 'success')
    }
  } finally {
    loadingTopics.value = false
  }
}

function applyExpTopic(topic: { title: string; type: string }) {
  expDraft.title = topic.title
  if (['group', 'inquiry', 'intentional', 'spontaneous'].includes(topic.type)) {
    expDraft.experience_type = topic.type as never
  }
  ui.showToast('Topic applied', 'info')
}

// Photo upload (max 2 images)
function triggerAddExpPhoto() {
  targetExpUploadIndex.value = null
  expFileInput.value?.click()
}

function triggerReplaceExpPhoto(index: number) {
  targetExpUploadIndex.value = index
  expFileInput.value?.click()
}

function handlePhotoUpload(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (!files || files.length === 0) return

  if (targetExpUploadIndex.value !== null) {
    const file = files[0]
    if (file.size > 8 * 1024 * 1024) {
      ui.showToast('Please select an image smaller than 8MB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const result = e.target?.result as string
      const updated = [...expDraft.photo_urls]
      updated[targetExpUploadIndex.value!] = result
      expDraft.photo_urls = updated
      ui.showToast('Photo updated', 'success')
    }
    reader.readAsDataURL(file)
  } else {
    const remainingSlots = 2 - expDraft.photo_urls.length
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
        if (expDraft.photo_urls.length < 2) {
          expDraft.photo_urls.push(e.target?.result as string)
        }
      }
      reader.readAsDataURL(file)
    }
    ui.showToast('Photo attached', 'success')
  }
  target.value = ''
}

function removeExpPhoto(index: number) {
  expDraft.photo_urls.splice(index, 1)
  if (expFileInput.value) expFileInput.value.value = ''
}

async function saveExp() {
  if (!expDraft.title.trim()) {
    ui.showToast('Please provide an experience title', 'info')
    return
  }
  const payload = {
    title: expDraft.title,
    room: expDraft.room,
    experience_type: expDraft.experience_type,
    date: expDraft.date,
    educator_name: expDraft.educator_name,
    description: expDraft.description,
    learning_intentions: expDraft.learning_intentions,
    success_criteria: expDraft.success_criteria,
    resources: expDraft.resources,
    extension_ideas: expDraft.extension_ideas,
    photo_urls: expDraft.photo_urls.slice(0, 2),
    eylf_outcome_ids: expDraft.eylf_outcome_ids,
    theory_ids: expDraft.theory_ids,
    project_id: expDraft.project_id || null,
  }
  if (editingExpId.value) {
    await projects.updateActivity(editingExpId.value, payload as never)
  } else {
    await projects.createActivity(payload as never)
  }
  ui.showToast('Experience saved to Programming Book', 'success')
  await projects.loadActivities()
  expMode.value = 'list'
}

function editExp(act: Activity) {
  editingExpId.value = act.id
  Object.assign(expDraft, {
    title: act.title,
    room: act.room || ROOMS[0],
    experience_type: act.experience_type || 'group',
    date: act.date || new Date().toISOString().slice(0, 10),
    educator_name: act.educator_name || auth.displayName || 'Educator',
    description: act.description ?? '',
    learning_intentions: act.learning_intentions ?? '',
    success_criteria: act.success_criteria ?? '',
    resources: act.resources ?? '',
    extension_ideas: act.extension_ideas ?? '',
    photo_urls: (act.photo_urls ?? []).slice(0, 2),
    eylf_outcome_ids: act.eylf_outcome_ids ?? [],
    theory_ids: act.theory_ids ?? [],
    project_id: act.project_id ?? '',
  })
  topicSuggestions.value = []
  targetExpUploadIndex.value = null
  expMode.value = 'write'
}

async function removeExp(id: string) {
  if (!window.confirm('Delete this Programming Book entry?')) return
  await projects.deleteActivity(id)
  ui.showToast('Entry deleted', 'info')
}

function openPrintModal(act?: Activity) {
  if (act) {
    expToPrint.value = act
  } else {
    expToPrint.value = {
      id: editingExpId.value || 'draft',
      user_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      project_id: expDraft.project_id || null,
      title: expDraft.title || 'Untitled Curriculum Experience',
      room: expDraft.room,
      experience_type: expDraft.experience_type,
      date: expDraft.date,
      educator_name: expDraft.educator_name,
      description: expDraft.description,
      learning_intentions: expDraft.learning_intentions,
      success_criteria: expDraft.success_criteria,
      resources: expDraft.resources,
      extension_ideas: expDraft.extension_ideas,
      photo_urls: expDraft.photo_urls.slice(0, 2),
      eylf_outcome_ids: expDraft.eylf_outcome_ids,
      theory_ids: expDraft.theory_ids,
    }
  }
  printModalOpen.value = true
}

function closePrintModal() {
  printModalOpen.value = false
  expToPrint.value = null
}

function printNow() {
  printElement('printable-program-report', expToPrint.value?.title || 'Programming Experience')
}

function downloadExpPdf() {
  if (!expToPrint.value) return
  const doc = exportProgramBookPdf(expToPrint.value, {
    ...expPrintOpts,
    centreName: auth.profile?.centre_name || 'Hadfield Early Learning Centre',
  })
  const fileSafe = (expToPrint.value.title || 'program-experience').toLowerCase().replace(/\s+/g, '-')
  doc.save(`${fileSafe}.pdf`)
  ui.showToast('PDF downloaded ready to display', 'success')
}

// ============================================================================
// 2. PROGRAM BOOK CRITICAL ANALYSIS (EYLF Coverage & Reflection)
// ============================================================================
interface AnalysisResult {
  summary: string
  strengths: string[]
  gaps: string[]
  recommendations: string[]
  coverage: Record<string, number>
  eylfOutcomeIds: number[]
}

const analysisTitle = ref('')
const analysisSourceText = ref('')
const analysisResult = ref<AnalysisResult | null>(null)
const analysisSavedId = ref<string | null>(null)

const analyses = computed(() => content.analyses)

const coverageList = computed(() => {
  const cov = analysisResult.value?.coverage ?? {}
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
  if (!analysisSourceText.value.trim()) {
    ui.showToast('Please enter text to analyse', 'info')
    return
  }
  const data = await ai.run<AnalysisResult>(
    PROMPTS.programAnalysis({
      programText: analysisSourceText.value,
    }),
  )
  if (data) {
    analysisResult.value = data
    ui.showToast('Critical analysis complete', 'success')
  }
}

async function saveAnalysis() {
  if (!analysisResult.value) return
  const payload = {
    title: analysisTitle.value || 'Program Analysis ' + new Date().toLocaleDateString('en-AU'),
    source_text: analysisSourceText.value,
    summary: analysisResult.value.summary,
    strengths: analysisResult.value.strengths,
    gaps: analysisResult.value.gaps,
    recommendations: analysisResult.value.recommendations,
    coverage: analysisResult.value.coverage,
    eylf_outcome_ids: (analysisResult.value.eylfOutcomeIds ?? []) as EylfOutcomeId[],
  }
  const saved = await content.saveAnalysis(payload, analysisSavedId.value || undefined)
  if (saved?.id) analysisSavedId.value = saved.id
  ui.showToast('Analysis saved to Program Book', 'success')
  await content.loadAnalyses()
}

function loadSavedAnalysis(id: string) {
  const found = analyses.value.find(a => a.id === id)
  if (!found) return
  analysisSavedId.value = found.id
  analysisTitle.value = found.title
  analysisSourceText.value = found.source_text || ''
  analysisResult.value = {
    summary: found.summary || '',
    strengths: (found.strengths as string[]) ?? [],
    gaps: (found.gaps as string[]) ?? [],
    recommendations: (found.recommendations as string[]) ?? [],
    coverage: (found.coverage as Record<string, number>) ?? {},
    eylfOutcomeIds: found.eylf_outcome_ids,
  }
}

function startNewAnalysis() {
  analysisSavedId.value = null
  analysisTitle.value = ''
  analysisSourceText.value = ''
  analysisResult.value = null
}

async function removeAnalysis(id: string) {
  if (!window.confirm('Delete this analysis?')) return
  await content.deleteAnalysis(id)
  if (analysisSavedId.value === id) startNewAnalysis()
}

onMounted(() => {
  void roomsStore.loadRooms()
  void projects.loadActivities()
  void content.loadAnalyses()
})
</script>

<template>
  <div class="space-y-5">
    <UnderDevelopmentBanner topic-key="program-book" />

    <!-- View Switcher Tabs -->
    <header class="card !p-2 flex flex-wrap gap-2">
      <button
        class="flex-1 rounded-xl py-2 px-4 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
        :class="viewTab === 'experiences' ? 'bg-brand-700 text-white shadow-soft' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'"
        @click="viewTab = 'experiences'"
      >
        <span>📖</span>
        <span>Programming Book (Group &amp; Inquiry Experiences)</span>
      </button>
      <button
        class="flex-1 rounded-xl py-2 px-4 text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2"
        :class="viewTab === 'analysis' ? 'bg-brand-700 text-white shadow-soft' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'"
        @click="viewTab = 'analysis'"
      >
        <span>🔍</span>
        <span>Program Critical Reflection &amp; EYLF Radar</span>
      </button>
    </header>

    <!-- ================================================================= -->
    <!-- TAB 1: PROGRAMMING EXPERIENCES (Group, Inquiry, Intentional)       -->
    <!-- ================================================================= -->
    <div v-if="viewTab === 'experiences'" class="space-y-5">
      <!-- List Mode -->
      <template v-if="expMode === 'list'">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              Room Programming Book Entries
            </h2>
            <p class="text-xs text-slate-500">
              Group experiences, ongoing emergent inquiries, and intentional learning moments.
            </p>
          </div>
          <button class="btn-primary" @click="startNewExp">＋ New program entry</button>
        </div>

        <div v-if="activities.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <article
            v-for="act in activities"
            :key="act.id"
            class="card flex flex-col gap-3 transition hover:shadow-soft"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <span class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200 text-[10px] font-bold">
                  {{ act.room || 'Room' }} · {{ (act.experience_type || 'group').toUpperCase() }}
                </span>
                <h3 class="truncate font-display text-base font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  {{ act.title }}
                </h3>
                <p class="text-xs text-slate-400">
                  {{ formatStoryDate(act.date) }}
                  <span v-if="act.educator_name"> · {{ act.educator_name }}</span>
                </p>
              </div>
              <!-- Thumbnails (up to 2) -->
              <div v-if="act.photo_urls?.length" class="flex gap-1 shrink-0">
                <img
                  v-for="(pUrl, pIdx) in act.photo_urls.slice(0, 2)"
                  :key="pIdx"
                  :src="pUrl"
                  alt="Experience photo"
                  class="h-12 w-12 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                />
              </div>
            </div>

            <p class="line-clamp-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {{ act.description }}
            </p>

            <div class="flex flex-wrap items-center gap-1">
              <span
                v-for="id in (act.eylf_outcome_ids || []).slice(0, 3)"
                :key="id"
                class="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-[10px]"
              >
                Outcome {{ id }}
              </span>
            </div>

            <div class="mt-auto flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button class="btn-secondary flex-1 !py-1.5 text-xs" @click="editExp(act)">
                ✏️ Edit
              </button>
              <button
                class="btn-secondary !py-1.5 !px-3 text-xs"
                title="Print or export PDF report"
                @click="openPrintModal(act)"
              >
                🖨️ Print / PDF
              </button>
              <button class="btn-ghost !px-2.5 !py-1.5 text-xs text-rose-500" @click="removeExp(act.id)">
                🗑
              </button>
            </div>
          </article>
        </div>

        <div v-else class="card text-center py-10 text-sm text-slate-500 dark:text-slate-400 space-y-3">
          <p class="text-3xl">🌱</p>
          <p class="font-bold text-slate-700 dark:text-slate-300">No Programming Book entries yet.</p>
          <p class="text-xs max-w-md mx-auto">
            Document group investigations, emergent inquiry threads, and intentional provocations with AI topic generation and print-ready curriculum reports.
          </p>
          <button class="btn-primary mt-2" @click="startNewExp">Document first experience</button>
        </div>
      </template>

      <!-- Writer Mode -->
      <template v-else>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button class="btn-ghost" @click="expMode = 'list'">← Back to Programming Book</button>
          <div class="flex items-center gap-2">
            <button class="btn-secondary" @click="openPrintModal()">
              🖨️ Ready to print / PDF
            </button>
            <button class="btn-primary" @click="saveExp">💾 Save entry</button>
          </div>
        </div>

        <!-- Meta Card -->
        <section class="card space-y-4">
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label class="field-label" for="exp-room">Room *</label>
              <select id="exp-room" v-model="expDraft.room" class="input font-bold">
                <option v-for="r in roomList" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>
            <div>
              <label class="field-label" for="exp-type">Experience type</label>
              <select id="exp-type" v-model="expDraft.experience_type" class="input font-bold">
                <option value="group">Group Experience</option>
                <option value="inquiry">Ongoing Inquiry Project</option>
                <option value="intentional">Intentional Teaching Provocation</option>
                <option value="spontaneous">Spontaneous Discovery</option>
              </select>
            </div>
            <div>
              <label class="field-label" for="exp-date">Date</label>
              <input id="exp-date" v-model="expDraft.date" type="date" class="input" />
            </div>
            <div>
              <label class="field-label" for="exp-educator">Educator</label>
              <input id="exp-educator" v-model="expDraft.educator_name" class="input" placeholder="e.g. Kapil Pandey" />
            </div>
          </div>
        </section>

        <!-- Observation / Notes & AI Generator -->
        <section class="card space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <label class="field-label !mb-0" for="exp-desc">
              Observation notes / What happened with the group *
            </label>
            <span class="text-[11px] text-slate-400">
              Children's quotes, collective interactions, materials used.
            </span>
          </div>

          <textarea
            id="exp-desc"
            v-model="expDraft.description"
            class="textarea"
            rows="5"
            placeholder="e.g. Children showed high curiosity in waterways in the sandpit. Together with Kapil, they connected PVC pipes, built sand dams, and tested water flow. Lively discussions took place on how to stop leaks."
          />

          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button
              class="btn-primary"
              :disabled="ai.loading.value || !expDraft.description.trim()"
              @click="generateExp"
            >
              {{ ai.loading.value ? 'Generating plan…' : '✨ Generate experience with AI' }}
            </button>
            <button
              class="btn-secondary"
              :disabled="loadingTopics || !expDraft.description.trim()"
              @click="suggestExpTopics"
            >
              {{ loadingTopics ? 'Thinking…' : '💡 Suggest topics' }}
            </button>
          </div>

          <!-- Suggested topics -->
          <div v-if="topicSuggestions.length" class="space-y-1.5 pt-2">
            <p class="text-xs font-bold text-slate-600 dark:text-slate-300">
              Select an AI curriculum topic:
            </p>
            <div class="grid gap-2 sm:grid-cols-2">
              <button
                v-for="(t, idx) in topicSuggestions"
                :key="idx"
                type="button"
                class="flex flex-col items-start p-2.5 rounded-xl border text-left transition hover:border-brand-500 hover:bg-brand-50/40 dark:hover:bg-brand-950/30"
                :class="expDraft.title === t.title ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-950/50' : 'border-slate-200 dark:border-slate-700'"
                @click="applyExpTopic(t)"
              >
                <span class="text-xs font-bold text-slate-900 dark:text-slate-100">{{ t.title }}</span>
                <span class="text-[10px] text-brand-700 dark:text-brand-300 mt-0.5">{{ t.description }}</span>
              </button>
            </div>
          </div>
        </section>

        <!-- Photo Upload (Maximum 2 photos) -->
        <section class="card space-y-3">
          <input
            ref="expFileInput"
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
                Arranged vertically on the right side with wrapped text in the curriculum layout.
              </p>
            </div>
            <button
              v-if="expDraft.photo_urls.length < 2"
              type="button"
              class="btn-secondary !py-1.5 !px-3 text-xs"
              @click="triggerAddExpPhoto"
            >
              📷 Attach photo ({{ expDraft.photo_urls.length }}/2)
            </button>
          </div>

          <div v-if="expDraft.photo_urls.length" class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="(pUrl, idx) in expDraft.photo_urls"
              :key="idx"
              class="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700"
            >
              <img
                :src="pUrl"
                :alt="`Photo ${idx + 1}`"
                class="h-20 w-24 object-cover rounded-lg border border-slate-300 shadow-xs shrink-0"
              />
              <div class="space-y-1 min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200 text-[10px] font-bold">
                    Photo {{ idx + 1 }}
                  </span>
                  <span class="text-[11px] text-slate-400">Stacked right</span>
                </div>
                <div class="flex gap-2 pt-1">
                  <button
                    type="button"
                    class="btn-secondary !py-1 !px-2.5 text-xs"
                    @click="triggerReplaceExpPhoto(idx)"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    class="btn-ghost !py-1 !px-2.5 text-xs text-rose-500"
                    @click="removeExpPhoto(idx)"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Plan Details -->
        <section class="card space-y-4">
          <div>
            <label class="field-label" for="exp-title">Experience title / Topic *</label>
            <input
              id="exp-title"
              v-model="expDraft.title"
              class="input font-bold text-base"
              placeholder="e.g. Waterway Engineering: Exploring Flow, Dams and Gravity"
            />
          </div>

          <div>
            <label class="field-label" for="exp-intentions">Learning intentions (one per line)</label>
            <textarea
              id="exp-intentions"
              v-model="expDraft.learning_intentions"
              class="textarea"
              rows="3"
              placeholder="Children will collaborate with peers to design waterway channels&#10;Children will explore scientific concepts of flow, balance and gravity"
            />
          </div>

          <div>
            <label class="field-label" for="exp-strat">Intentional teaching strategies / Educator role</label>
            <textarea
              id="exp-strat"
              v-model="expDraft.success_criteria"
              class="textarea"
              rows="3"
              placeholder="Educator models questioning ('Where is the water travelling?'), prompts problem-solving when dams overflow…"
            />
          </div>

          <div>
            <label class="field-label" for="exp-res">Environment, materials &amp; loose parts</label>
            <textarea
              id="exp-res"
              v-model="expDraft.resources"
              class="textarea"
              rows="2"
              placeholder="Sandpit, PVC piping, bamboo gutters, watering cans, buckets, water pump, shovels"
            />
          </div>

          <div>
            <label class="field-label" for="exp-ext">Extensions &amp; continuing inquiries</label>
            <textarea
              id="exp-ext"
              v-model="expDraft.extension_ideas"
              class="textarea"
              rows="2"
              placeholder="Add floating materials and water wheels tomorrow to test water current velocity."
            />
          </div>
        </section>

        <!-- Pickers -->
        <div class="grid gap-5 lg:grid-cols-2">
          <div class="card">
            <EylfOutcomePicker v-model="expDraft.eylf_outcome_ids" />
          </div>
          <div class="card">
            <TheoryPicker v-model="expDraft.theory_ids" :outcome-ids="expDraft.eylf_outcome_ids" />
          </div>
        </div>

        <div class="flex flex-wrap gap-3">
          <button class="btn-secondary flex-1 !py-3 font-bold" @click="openPrintModal()">
            🖨️ Ready to print / PDF
          </button>
          <button class="btn-primary flex-1 !py-3 font-bold text-base" @click="saveExp">
            💾 Save Programming Book entry
          </button>
        </div>
      </template>
    </div>

    <!-- ================================================================= -->
    <!-- TAB 2: CRITICAL REFLECTION & EYLF RADAR                          -->
    <!-- ================================================================= -->
    <div v-else class="space-y-6">
      <div class="card space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-display text-base font-extrabold text-slate-800 dark:text-slate-100">
              EYLF v2.0 Critical Program Reflection
            </h2>
            <p class="text-xs text-slate-500">
              Paste observations or weekly reflections to evaluate pedagogical depth and curriculum coverage.
            </p>
          </div>
          <button class="btn-secondary !py-1 !px-3 text-xs" @click="startNewAnalysis">
            ＋ New analysis
          </button>
        </div>

        <div>
          <label class="field-label" for="pa-title">Analysis label / Title</label>
          <input
            id="pa-title"
            v-model="analysisTitle"
            class="input"
            placeholder="e.g. Term 1 Week 1-4 Program Book Review"
          />
        </div>

        <div>
          <label class="field-label" for="pa-text">Paste program documentation *</label>
          <textarea
            id="pa-text"
            v-model="analysisSourceText"
            class="textarea"
            rows="7"
            placeholder="Paste your weekly program notes, reflections, or documentation snippets here…"
          />
        </div>

        <div class="flex gap-2">
          <button
            class="btn-primary"
            :disabled="ai.loading.value || !analysisSourceText.trim()"
            @click="analyse"
          >
            {{ ai.loading.value ? 'Analysing…' : '🔍 Critically analyse documentation' }}
          </button>
          <button
            v-if="analysisResult"
            class="btn-secondary"
            @click="saveAnalysis"
          >
            💾 Save analysis
          </button>
        </div>
      </div>

      <!-- Analysis Results -->
      <section v-if="analysisResult" class="grid gap-5 lg:grid-cols-2">
        <div class="card space-y-4">
          <h3 class="font-display text-base font-extrabold">EYLF v2.0 coverage radar</h3>
          <div class="space-y-3">
            <div v-for="item in coverageList" :key="item.outcome.id" class="space-y-1">
              <div class="flex justify-between text-xs">
                <span class="font-bold">Outcome {{ item.outcome.id }}: {{ item.outcome.title }}</span>
                <span class="text-slate-400">{{ item.level }}/5</span>
              </div>
              <div class="h-2.5 w-full rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  class="h-2.5 rounded-full transition-all"
                  :class="coverageBar(item.level).class"
                  :style="{ width: coverageBar(item.level).width }"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="card space-y-4">
          <h3 class="font-display text-base font-extrabold">Critical reflection summary</h3>
          <p class="text-xs leading-relaxed text-slate-700 dark:text-slate-300">
            {{ analysisResult.summary }}
          </p>

          <div v-if="analysisResult.strengths?.length" class="space-y-1">
            <h4 class="text-xs font-bold text-emerald-700 dark:text-emerald-400">Strengths noticed:</h4>
            <ul class="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
              <li v-for="(s, i) in analysisResult.strengths" :key="i">{{ s }}</li>
            </ul>
          </div>

          <div v-if="analysisResult.gaps?.length" class="space-y-1">
            <h4 class="text-xs font-bold text-amber-700 dark:text-amber-400">Gaps / Missed outcomes:</h4>
            <ul class="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
              <li v-for="(g, i) in analysisResult.gaps" :key="i">{{ g }}</li>
            </ul>
          </div>

          <div v-if="analysisResult.recommendations?.length" class="space-y-1">
            <h4 class="text-xs font-bold text-brand-700 dark:text-brand-300">Actionable recommendations:</h4>
            <ul class="list-disc pl-4 text-xs text-slate-600 dark:text-slate-300 space-y-0.5">
              <li v-for="(r, i) in analysisResult.recommendations" :key="i">{{ r }}</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Saved Analyses -->
      <section v-if="analyses.length" class="card space-y-4">
        <h3 class="font-display text-sm font-extrabold text-slate-700 dark:text-slate-200">
          Saved program analyses ({{ analyses.length }})
        </h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <article
            v-for="a in analyses"
            :key="a.id"
            class="card flex flex-col gap-2 !p-3 border border-slate-200 dark:border-slate-700"
          >
            <p class="font-bold text-xs">{{ a.title }}</p>
            <p class="text-[11px] text-slate-400">{{ a.created_at?.slice(0, 10) }}</p>
            <p class="line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{{ a.summary }}</p>
            <div class="mt-auto flex gap-2 pt-2">
              <button class="btn-secondary flex-1 !py-1 text-xs" @click="loadSavedAnalysis(a.id)">
                View
              </button>
              <button class="btn-ghost !px-2.5 !py-1 text-xs text-rose-500" @click="removeAnalysis(a.id)">
                🗑
              </button>
            </div>
          </article>
        </div>
      </section>
    </div>

    <!-- ================================================================= -->
    <!-- PRINT & PDF MODAL FOR PROGRAMMING BOOK (Teleported for 1-Page)    -->
    <!-- ================================================================= -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="printModalOpen && expToPrint"
          class="print-modal-portal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
          @click.self="closePrintModal"
        >
          <div class="print-modal-card relative w-full max-w-3xl rounded-2xl bg-white shadow-lift dark:bg-slate-900 my-auto p-4 sm:p-6 space-y-4 max-h-[94vh] flex flex-col">
            <div class="no-print flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 class="font-display text-base font-extrabold text-slate-800 dark:text-slate-100">
                  Programming Book Report Preview
                </h3>
                <p class="text-xs text-slate-500">
                  Compact 1-page layout with small edge-wrapped photos for pasting into 1/4 A3 scrapbook paper.
                </p>
              </div>
              <div class="flex items-center gap-2">
                <button class="btn-secondary !py-1.5 !px-3 text-xs" @click="downloadExpPdf">
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
                      :class="expPrintOpts.imageSize === 'tiny' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="expPrintOpts.imageSize = 'tiny'"
                    >
                      Tiny (68px)
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md transition"
                      :class="expPrintOpts.imageSize === 'small' || !expPrintOpts.imageSize ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="expPrintOpts.imageSize = 'small'"
                    >
                      Small (88px · 1/4 A3)
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md transition"
                      :class="expPrintOpts.imageSize === 'medium' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="expPrintOpts.imageSize = 'medium'"
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
                      :class="expPrintOpts.targetFormat === '1/4-a3' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="expPrintOpts.targetFormat = '1/4-a3'"
                    >
                      1/4 of A3 paper
                    </button>
                    <button
                      type="button"
                      class="px-2.5 py-1 rounded-md transition"
                      :class="expPrintOpts.targetFormat === 'a4' ? 'bg-brand-600 text-white font-bold' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'"
                      @click="expPrintOpts.targetFormat = 'a4'"
                    >
                      Full A4
                    </button>
                  </div>
                </div>
              </div>

              <!-- Section Checkboxes -->
              <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs">
                <label class="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                  <input
                    v-model="expPrintOpts.includePhotos"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Attached photos (max 2)</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-200">
                  <input
                    v-model="expPrintOpts.includeEylfInline"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Inline EYLF outcome tag</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    v-model="expPrintOpts.includeLearningIntentions"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Learning intentions</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    v-model="expPrintOpts.includeStrategies"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Teaching strategies</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    v-model="expPrintOpts.includeResources"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Environment &amp; Materials</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-600 dark:text-slate-400">
                  <input
                    v-model="expPrintOpts.includeExtensions"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Extensions &amp; Inquiries</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400">
                  <input
                    v-model="expPrintOpts.includeEducator"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Room &amp; Educator details</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400">
                  <input
                    v-model="expPrintOpts.includeCentreName"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Childcare centre header</span>
                </label>

                <label class="inline-flex items-center gap-1.5 cursor-pointer text-slate-500 dark:text-slate-400">
                  <input
                    v-model="expPrintOpts.includeFooterTags"
                    type="checkbox"
                    class="rounded text-brand-600 focus:ring-brand-500"
                  />
                  <span>Theorist tags</span>
                </label>
              </div>
            </div>

            <div class="overflow-y-auto flex-1 pr-1">
              <article
                id="printable-program-report"
                class="p-5 sm:p-7 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-xs max-w-xl mx-auto space-y-3.5"
                :class="expPrintOpts.targetFormat === '1/4-a3' ? 'border-dashed border-slate-300' : ''"
              >
                <!-- Optional Centre Banner -->
                <p
                  v-if="expPrintOpts.includeCentreName"
                  class="text-[10px] tracking-wider uppercase text-slate-400 font-bold"
                >
                  {{ auth.profile?.centre_name || 'Hadfield Early Learning Centre' }} · Programming Book
                </p>

                <!-- Header: Bold Title (left) & Bold Date (right) -->
                <div class="flex items-baseline justify-between gap-3 border-b border-slate-100 pb-2.5">
                  <h1 class="font-display text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight leading-tight">
                    {{ expToPrint.title || 'Curriculum Experience' }}
                  </h1>
                  <div class="font-display text-sm sm:text-base font-bold text-slate-900 shrink-0 whitespace-nowrap">
                    {{ formatStoryDate(expToPrint.date) }}
                  </div>
                </div>

                <!-- Optional Room / Type / Educator -->
                <div
                  v-if="expPrintOpts.includeEducator"
                  class="text-xs text-slate-500 font-medium pb-1.5 border-b border-slate-100"
                >
                  <span>Room: <strong>{{ expToPrint.room || 'General' }}</strong> · </span>
                  <span>Type: <strong>{{ (expToPrint.experience_type || 'group').toUpperCase() }}</strong></span>
                  <span v-if="expToPrint.educator_name"> · Educator: <strong>{{ expToPrint.educator_name }}</strong></span>
                </div>

                <!-- Narrative with up to 2 wrapped images on right edge -->
                <div class="story-article-flow text-slate-900 text-sm leading-relaxed">
                  <div
                    v-if="expPrintOpts.includePhotos && expDisplayPhotos.length"
                    :class="expPhotoContainerClass"
                    class="float-right ml-3 mb-1.5 flex flex-col gap-1.5 shrink-0"
                  >
                    <img
                      v-for="(photo, idx) in expDisplayPhotos"
                      :key="idx"
                      :src="photo"
                      :alt="`Photo ${idx + 1}`"
                      class="w-full aspect-[4/3] object-cover rounded border border-slate-200 shadow-2xs"
                    />
                  </div>

                  <p class="whitespace-pre-wrap">
                    {{ expToPrint.description }}
                    <span
                      v-if="expPrintOpts.includeEylfInline && expInlineOutcomeText"
                      class="font-semibold text-slate-800"
                    >
                      ({{ expInlineOutcomeText }})
                    </span>
                  </p>
                  <div class="clear-both"></div>
                </div>

                <!-- Optional: Learning intentions -->
                <section
                  v-if="expPrintOpts.includeLearningIntentions && expToPrint.learning_intentions"
                  class="space-y-1 pt-2.5 border-t border-slate-100"
                >
                  <h2 class="font-display text-xs font-extrabold text-teal-800">Learning Intentions</h2>
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {{ expToPrint.learning_intentions }}
                  </p>
                </section>

                <!-- Optional: Intentional teaching strategies -->
                <section
                  v-if="expPrintOpts.includeStrategies && expToPrint.success_criteria"
                  class="space-y-1 pt-2.5 border-t border-slate-100"
                >
                  <h2 class="font-display text-xs font-extrabold text-teal-800">
                    Intentional Teaching Strategies &amp; Educator Role
                  </h2>
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {{ expToPrint.success_criteria }}
                  </p>
                </section>

                <!-- Optional: Environment & resources -->
                <section
                  v-if="expPrintOpts.includeResources && expToPrint.resources"
                  class="space-y-1 pt-2.5 border-t border-slate-100"
                >
                  <h2 class="font-display text-xs font-extrabold text-teal-800">
                    Environment, Materials &amp; Loose Parts
                  </h2>
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {{ expToPrint.resources }}
                  </p>
                </section>

                <!-- Optional: Extensions -->
                <section
                  v-if="expPrintOpts.includeExtensions && expToPrint.extension_ideas"
                  class="space-y-1 pt-2.5 border-t border-slate-100"
                >
                  <h2 class="font-display text-xs font-extrabold text-teal-800">
                    Extensions &amp; Continuing Inquiries
                  </h2>
                  <p class="whitespace-pre-wrap text-xs leading-relaxed text-slate-700">
                    {{ expToPrint.extension_ideas }}
                  </p>
                </section>

                <!-- Optional Footer: Theorist & Outcome tags -->
                <div
                  v-if="expPrintOpts.includeFooterTags"
                  class="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5 text-[10px] text-slate-500"
                >
                  <span
                    v-for="id in (expToPrint.eylf_outcome_ids || [])"
                    :key="id"
                    class="chip !py-0.5 !px-2 bg-slate-100 text-slate-700 text-[10px]"
                  >
                    Outcome {{ id }}
                  </span>
                  <span
                    v-for="tid in (expToPrint.theory_ids || [])"
                    :key="tid"
                    class="chip !py-0.5 !px-2 bg-slate-100 text-slate-700 text-[10px]"
                  >
                    {{ tid }}
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
  #printable-program-report {
    border: none !important;
    box-shadow: none !important;
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
  }
}
</style>
