<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { EYLF_OUTCOMES, EYLF_PRACTICES, EYLF_PRINCIPLES, PLANNING_CYCLE } from '@/data/eylf'
import { theoriesForOutcome } from '@/data/theories'
import { PROMPTS } from '@/data/prompts'
import { useAiTask } from '@/composables/useAiTask'
import { transcribeAudio } from '@/services/ai'
import { recordUntilStopped } from '@/services/voice'
import { useAuthStore } from '@/stores/auth'
import { useRoomsStore } from '@/stores/rooms'
import { useUiStore } from '@/stores/ui'
import type { EylfOutcome, EylfSubOutcome } from '@/types'

const router = useRouter()
const auth = useAuthStore()
const roomsStore = useRoomsStore()
const ui = useUiStore()
const ai = useAiTask()

// ---------------------------------------------------------------------------
// Navigation Tabs & View Filters
// ---------------------------------------------------------------------------
type TabKey = 'outcomes' | 'principles' | 'cycle' | 'matcher'
const activeTab = ref<TabKey>('outcomes')

const searchQuery = ref('')
const selectedOutcomeFilter = ref<number | 'all'>('all')
const selectedTag = ref<string | null>(null)
const selectedRoom = ref<string>('All Rooms')

// Expanded state for outcomes
const expandedOutcomes = ref<Set<number>>(new Set([1]))
// Interactive checked indicators for educators while observing
const checkedLookFors = ref<Set<string>>(new Set())

// Topic tags for quick filtering
const TOPIC_TAGS = [
  { label: '#Agency', query: 'agency' },
  { label: '#Sustainability', query: 'sustainability' },
  { label: '#FirstNations', query: 'aboriginal' },
  { label: '#LooseParts', query: 'materials' },
  { label: '#STEM', query: 'experiment' },
  { label: '#Resilience', query: 'resilience' },
  { label: '#Wellbeing', query: 'wellbeing' },
  { label: '#Inquiry', query: 'inquiry' },
  { label: '#Digital', query: 'digital' },
] as const

onMounted(async () => {
  if (!roomsStore.initialised) {
    await roomsStore.loadRooms()
  }
  if (auth.roomName && auth.roomName !== 'No Room (Admin Privacy Shield)') {
    selectedRoom.value = auth.roomName
  } else if (roomsStore.roomNames.length > 0) {
    selectedRoom.value = roomsStore.roomNames[0]
  }
})

// Toggle outcome expansion
function toggleOutcome(id: number) {
  if (expandedOutcomes.value.has(id)) {
    expandedOutcomes.value.delete(id)
  } else {
    expandedOutcomes.value.add(id)
  }
}

function expandAllOutcomes() {
  expandedOutcomes.value = new Set(EYLF_OUTCOMES.map(o => o.id))
}

function collapseAllOutcomes() {
  expandedOutcomes.value = new Set()
}

function toggleLookFor(key: string) {
  if (checkedLookFors.value.has(key)) {
    checkedLookFors.value.delete(key)
  } else {
    checkedLookFors.value.add(key)
    ui.showToast('Observation indicator marked', 'success')
  }
}

function applyTag(query: string) {
  if (selectedTag.value === query) {
    selectedTag.value = null
    searchQuery.value = ''
  } else {
    selectedTag.value = query
    searchQuery.value = query
  }
}

function clearFilters() {
  searchQuery.value = ''
  selectedOutcomeFilter.value = 'all'
  selectedTag.value = null
}

// ---------------------------------------------------------------------------
// Filtered Data Lists
// ---------------------------------------------------------------------------
const filteredOutcomes = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return EYLF_OUTCOMES.filter(o => {
    if (selectedOutcomeFilter.value !== 'all' && o.id !== selectedOutcomeFilter.value) {
      return false
    }
    if (!q) return true
    const matchTitle = o.title.toLowerCase().includes(q) || o.shortTitle.toLowerCase().includes(q)
    const matchSummary = o.summary.toLowerCase().includes(q)
    const matchSub = o.subOutcomes.some(
      s => s.id.toLowerCase().includes(q) || s.text.toLowerCase().includes(q) || s.lookFor.some(l => l.toLowerCase().includes(q)),
    )
    const matchTheorists = theoriesForOutcome(o.id).some(t => t.name.toLowerCase().includes(q))
    return matchTitle || matchSummary || matchSub || matchTheorists
  })
})

const filteredPrinciples = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return EYLF_PRINCIPLES
  return EYLF_PRINCIPLES.filter(
    p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
  )
})

const filteredPractices = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  if (!q) return EYLF_PRACTICES
  return EYLF_PRACTICES.filter(
    p => p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q),
  )
})

// ---------------------------------------------------------------------------
// Outcome Visual Styling Tokens
// ---------------------------------------------------------------------------
interface OutcomeStyle {
  border: string
  bg: string
  badge: string
  text: string
  ring: string
  pill: string
}

function getOutcomeStyle(id: number): OutcomeStyle {
  switch (id) {
    case 1:
      return {
        border: 'border-rose-500/30 hover:border-rose-500/60 dark:border-rose-500/30',
        bg: 'bg-rose-500/5 dark:bg-rose-950/20',
        badge: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
        text: 'text-rose-600 dark:text-rose-400',
        ring: 'focus:ring-rose-500',
        pill: 'bg-rose-500 text-white',
      }
    case 2:
      return {
        border: 'border-sky-500/30 hover:border-sky-500/60 dark:border-sky-500/30',
        bg: 'bg-sky-500/5 dark:bg-sky-950/20',
        badge: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
        text: 'text-sky-600 dark:text-sky-400',
        ring: 'focus:ring-sky-500',
        pill: 'bg-sky-500 text-white',
      }
    case 3:
      return {
        border: 'border-amber-500/30 hover:border-amber-500/60 dark:border-amber-500/30',
        bg: 'bg-amber-500/5 dark:bg-amber-950/20',
        badge: 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/30',
        text: 'text-amber-600 dark:text-amber-400',
        ring: 'focus:ring-amber-500',
        pill: 'bg-amber-500 text-white',
      }
    case 4:
      return {
        border: 'border-violet-500/30 hover:border-violet-500/60 dark:border-violet-500/30',
        bg: 'bg-violet-500/5 dark:bg-violet-950/20',
        badge: 'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30',
        text: 'text-violet-600 dark:text-violet-400',
        ring: 'focus:ring-violet-500',
        pill: 'bg-violet-500 text-white',
      }
    case 5:
    default:
      return {
        border: 'border-emerald-500/30 hover:border-emerald-500/60 dark:border-emerald-500/30',
        bg: 'bg-emerald-500/5 dark:bg-emerald-950/20',
        badge: 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/30',
        text: 'text-emerald-600 dark:text-emerald-400',
        ring: 'focus:ring-emerald-500',
        pill: 'bg-emerald-500 text-white',
      }
  }
}

// ---------------------------------------------------------------------------
// AI Inquiry Provocation Generator (Sub-Outcome Modal)
// ---------------------------------------------------------------------------
interface ProvocationResult {
  provocationTitle: string
  ageFocus: string
  reggioEnvironmentSetup: string
  openEndedQuestions: string[]
  intentionalTeachingRole: string
  theoristLink: {
    name: string
    concept: string
    explanation: string
  }
  learningStorySnippet: string
}

const showProvocationModal = ref(false)
const selectedSubOutcome = ref<EylfSubOutcome | null>(null)
const selectedParentOutcome = ref<EylfOutcome | null>(null)
const provocationInterest = ref('')
const provocationLoading = ref(false)
const provocationResult = ref<ProvocationResult | null>(null)

function openProvocationModal(outcome: EylfOutcome, sub: EylfSubOutcome) {
  selectedParentOutcome.value = outcome
  selectedSubOutcome.value = sub
  provocationInterest.value = ''
  provocationResult.value = null
  showProvocationModal.value = true
}

async function generateProvocation() {
  if (!selectedParentOutcome.value || !selectedSubOutcome.value) return
  provocationLoading.value = true
  provocationResult.value = null

  try {
    const prompt = PROMPTS.eylfProvocation({
      outcomeId: selectedParentOutcome.value.id,
      subOutcomeId: selectedSubOutcome.value.id,
      subOutcomeText: selectedSubOutcome.value.text,
      room: selectedRoom.value,
      ageGroup: selectedRoom.value === 'Blossoms' ? 'Nursery (0-1 yrs)' : selectedRoom.value === 'Sweet Peas' ? 'Toddlers (1-2 yrs)' : 'Pre-Kindy / Kindergarten (3-5 yrs)',
      interest: provocationInterest.value.trim() || undefined,
    })

    const res = await ai.run<ProvocationResult>(prompt)
    if (res) {
      provocationResult.value = res
      ui.showToast('AI Inquiry Provocation generated!', 'success')
    } else {
      ui.showToast('Could not generate provocation. Please check AI connection.', 'error')
    }
  } finally {
    provocationLoading.value = false
  }
}

function sendProvocationToLearningStory() {
  if (!provocationResult.value || !selectedParentOutcome.value) return
  const p = provocationResult.value
  router.push({
    path: '/learning-stories',
    query: {
      title: p.provocationTitle,
      observation: `Provocation Invitation: ${p.reggioEnvironmentSetup}\n\nQuestions Posed: ${p.openEndedQuestions.join('; ')}`,
      analysis: p.learningStorySnippet,
      next_steps: p.intentionalTeachingRole,
      outcome: String(selectedParentOutcome.value.id),
    },
  })
}

// ---------------------------------------------------------------------------
// AI Observation Matcher & Sandbox (Tab 4)
// ---------------------------------------------------------------------------
interface MatcherResult {
  primaryOutcome: {
    outcomeId: number
    outcomeTitle: string
    subOutcomeId: string
    subOutcomeText: string
    confidenceScore: number
    pedagogicalReasoning: string
  }
  secondaryOutcomes: Array<{
    outcomeId: number
    subOutcomeId: string
    subOutcomeText: string
    pedagogicalReasoning: string
  }>
  learningDispositions: string[]
  theoristPerspective: {
    theorist: string
    concept: string
    note: string
  }
  intentionalTeachingExtension: string
  learningStoryAnalysisExcerpt: string
}

const matcherObservation = ref('')
const matcherLoading = ref(false)
const matcherResult = ref<MatcherResult | null>(null)

// Voice dictation state
const isRecording = ref(false)
const isTranscribing = ref(false)
let recordingHandle: Awaited<ReturnType<typeof recordUntilStopped>> | null = null

const PRESET_OBSERVATIONS = [
  {
    title: '💧 Archimedes Water Pump & Funnels',
    room: 'Sweet Peas (Toddlers)',
    text: 'Leo (2.5yo) watched intently as water cascaded through the funnel. He tipped the measuring jug repeatedly, adjusting the height to make the water wheel spin faster, exclaiming "Look, it is racing!" when the splash reached his arm.',
  },
  {
    title: '🍂 Clay & Native Gum Leaf Imprints',
    room: 'Chamomiles (Toddlers)',
    text: 'Aria pressed fallen eucalyptus leaves and gumnuts into terracotta clay. She felt the raised veins with her fingertips, comparing the textures between dry leaves and fresh ones, carefully peeling the leaf back to preserve the pattern.',
  },
  {
    title: '⚖️ Loose Parts Balance Beam Challenge',
    room: 'Dandelions (Kindergarten)',
    text: 'Julian and Maya worked collaboratively to build a bridge across two tree stumps using long pine planks. When the plank wobbled, Julian suggested placing river stones underneath to stabilise it, testing each stone carefully before stepping across.',
  },
  {
    title: '🪞 Peek-a-boo & Mirror Exploration',
    room: 'Blossoms (Nursery)',
    text: 'Baby Chloe (9 months) smiled at her reflection in the low-lying room mirror. She patted the glass with both open palms, babbling with delight, then turned toward the educator with an expectant smile when asked "Who is that in the mirror?".',
  },
] as const

function loadPreset(preset: typeof PRESET_OBSERVATIONS[number]) {
  matcherObservation.value = preset.text
  ui.showToast(`Loaded preset: ${preset.title}`, 'info')
}

async function toggleVoiceRecording() {
  if (isRecording.value) {
    isRecording.value = false
    isTranscribing.value = true
    try {
      if (recordingHandle) {
        const audioBlob = await recordingHandle.stop()
        const text = await transcribeAudio(audioBlob)
        if (text) {
          matcherObservation.value = matcherObservation.value
            ? `${matcherObservation.value.trim()} ${text}`
            : text
          ui.showToast('Voice transcribed into observation!', 'success')
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
      ui.showToast('Recording voice… Speak your child observation naturally', 'info')
    } catch {
      ui.showToast('Microphone access was denied or not available.', 'error')
    }
  }
}

async function analyzeObservation() {
  if (!matcherObservation.value.trim()) {
    ui.showToast('Please type or dictate an observation first.', 'error')
    return
  }
  matcherLoading.value = true
  matcherResult.value = null

  try {
    const prompt = PROMPTS.eylfAnalyseObservation({
      observation: matcherObservation.value.trim(),
      room: selectedRoom.value,
      ageGroup: selectedRoom.value === 'Blossoms' ? 'Nursery (0-1 yrs)' : 'Toddlers / Kindy (2-5 yrs)',
    })
    const res = await ai.run<MatcherResult>(prompt)
    if (res) {
      matcherResult.value = res
      ui.showToast('Observation analyzed against EYLF V2.0!', 'success')
    } else {
      ui.showToast('Analysis could not be completed. Check AI connection.', 'error')
    }
  } finally {
    matcherLoading.value = false
  }
}

function sendAnalysisToLearningStory() {
  if (!matcherResult.value) return
  const r = matcherResult.value
  router.push({
    path: '/learning-stories',
    query: {
      title: `${r.primaryOutcome.outcomeTitle} Inquiry`,
      observation: matcherObservation.value.trim(),
      analysis: `${r.primaryOutcome.pedagogicalReasoning}\n\n${r.learningStoryAnalysisExcerpt}`,
      next_steps: r.intentionalTeachingExtension,
      outcome: String(r.primaryOutcome.outcomeId),
    },
  })
}

// ---------------------------------------------------------------------------
// Team Reflection Generator (Tab 2)
// ---------------------------------------------------------------------------
interface ReflectionResult {
  title: string
  nqsLink: string
  criticalReflectionQuestions: string[]
  roomActionIdeas: string[]
  leadershipTip: string
}

const showReflectionModal = ref(false)
const reflectionTarget = ref<{ type: 'principle' | 'practice'; title: string; description: string } | null>(null)
const reflectionLoading = ref(false)
const reflectionResult = ref<ReflectionResult | null>(null)

async function openReflectionModal(type: 'principle' | 'practice', item: { title: string; description: string }) {
  reflectionTarget.value = { type, title: item.title, description: item.description }
  showReflectionModal.value = true
  reflectionLoading.value = true
  reflectionResult.value = null

  try {
    const prompt = PROMPTS.eylfReflectivePracticePrompt({
      type,
      title: item.title,
      description: item.description,
    })
    const res = await ai.run<ReflectionResult>(prompt)
    if (res) {
      reflectionResult.value = res
      ui.showToast('Team critical reflection questions generated!', 'success')
    }
  } finally {
    reflectionLoading.value = false
  }
}

// Copy helper
async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    ui.showToast(`${label} copied to clipboard!`, 'success')
  } catch {
    ui.showToast('Could not copy text to clipboard.', 'error')
  }
}

function printFramework() {
  window.print()
}
</script>

<template>
  <div class="space-y-6 max-w-7xl mx-auto pb-20 print:p-0 print:space-y-4">
    <!-- ===================================================================== -->
    <!-- 1. HERO BANNER: AUSTRALIAN EYLF V2.0 & INQUIRY CONTEXT                -->
    <!-- ===================================================================== -->
    <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-brand-950 to-slate-900 border border-brand-500/20 p-6 sm:p-8 text-white shadow-soft print:bg-white print:text-black print:border-none print:p-0">
      <div class="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div class="space-y-3 max-w-3xl">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-500/20 text-brand-300 border border-brand-500/30 text-xs font-bold font-mono tracking-wide">
              <span>🇦🇺</span>
              <span>EYLF V2.0 (2022/2023)</span>
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
              <span>🌿</span>
              <span>Wominjeka · First Nations &amp; Reggio Integrated</span>
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>AI Pedagogical Assistant Active</span>
            </span>
          </div>

          <h1 class="font-display text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white print:text-black">
            Belonging, Being &amp; Becoming
          </h1>

          <p class="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl print:text-slate-700">
            Australia’s Early Years Learning Framework V2.0 interactive reference. Explore the 5 Learning Outcomes,
            embed updated Principles and Practices, navigate the 6-stage Planning Cycle, and use AI to map raw observations directly into rich pedagogical documentation.
          </p>
        </div>

        <!-- Room Selector & Quick Actions -->
        <div class="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 print:hidden">
          <div class="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3 text-xs space-y-1">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Room Context:
            </label>
            <select
              v-model="selectedRoom"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-brand-300 font-bold focus:ring-2 focus:ring-brand-500 outline-none"
            >
              <option value="All Rooms">All Rooms (General)</option>
              <option v-for="rName in roomsStore.roomNames" :key="rName" :value="rName">
                {{ rName }}
              </option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn-primary text-xs py-2 px-3 flex-1 font-bold shadow-soft flex items-center justify-center gap-1.5"
              @click="activeTab = 'matcher'"
            >
              <span>⚡</span>
              <span>AI Observation Matcher</span>
            </button>
            <button
              type="button"
              class="btn-secondary text-xs py-2 px-3 font-bold flex items-center justify-center gap-1.5"
              title="Print framework summary for classroom wall"
              @click="printFramework"
            >
              <span>🖨️</span>
              <span class="hidden sm:inline">Print Guide</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 2. INTERACTIVE TABS & TOPICAL SEARCH BAR                               -->
    <!-- ===================================================================== -->
    <div class="space-y-4 print:hidden">
      <!-- Tab Buttons -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all"
          :class="activeTab === 'outcomes' ? 'bg-brand-600 text-white shadow-soft' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'"
          @click="activeTab = 'outcomes'"
        >
          <span>🎯</span>
          <span>5 Learning Outcomes</span>
          <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full" :class="activeTab === 'outcomes' ? 'bg-white/20' : 'bg-slate-200 dark:bg-slate-700'">
            20 Sub-outcomes
          </span>
        </button>

        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all"
          :class="activeTab === 'principles' ? 'bg-brand-600 text-white shadow-soft' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'"
          @click="activeTab = 'principles'"
        >
          <span>🧭</span>
          <span>Principles &amp; Practices</span>
          <span class="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-mono">
            V2.0 Core
          </span>
        </button>

        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all"
          :class="activeTab === 'cycle' ? 'bg-brand-600 text-white shadow-soft' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'"
          @click="activeTab = 'cycle'"
        >
          <span>🔄</span>
          <span>6-Stage Planning Cycle</span>
        </button>

        <button
          type="button"
          class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold whitespace-nowrap transition-all relative"
          :class="activeTab === 'matcher' ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-soft' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-300'"
          @click="activeTab = 'matcher'"
        >
          <span>✨</span>
          <span>AI Observation Matcher</span>
          <span class="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
        </button>
      </div>

      <!-- Live Search & Fast Filter Pill Bar (for Outcomes & Principles) -->
      <div v-if="activeTab === 'outcomes' || activeTab === 'principles'" class="card p-3.5 space-y-3">
        <div class="flex flex-col sm:flex-row items-center gap-3">
          <div class="relative flex-1 w-full">
            <span class="absolute left-3 top-2.5 text-slate-400 text-sm">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by keyword, sub-outcome, concept, or theorist (e.g. agency, risk, Vygotsky)…"
              class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
            <button
              v-if="searchQuery"
              class="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-200"
              @click="searchQuery = ''"
            >
              ✕
            </button>
          </div>

          <!-- Outcome Selector Filter -->
          <div v-if="activeTab === 'outcomes'" class="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto scrollbar-none">
            <button
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap"
              :class="selectedOutcomeFilter === 'all' ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'"
              @click="selectedOutcomeFilter = 'all'"
            >
              All (5)
            </button>
            <button
              v-for="o in EYLF_OUTCOMES"
              :key="o.id"
              type="button"
              class="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1"
              :class="selectedOutcomeFilter === o.id ? getOutcomeStyle(o.id).pill : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'"
              @click="selectedOutcomeFilter = o.id"
            >
              <span>{{ o.emoji }}</span>
              <span>O{{ o.id }}</span>
            </button>
          </div>
        </div>

        <!-- Topical Filter Chips & Quick Actions -->
        <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-[11px]">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-slate-400 font-bold uppercase tracking-wider text-[10px]">Quick Tags:</span>
            <button
              v-for="t in TOPIC_TAGS"
              :key="t.label"
              type="button"
              class="px-2 py-0.5 rounded-full border transition-all"
              :class="selectedTag === t.query ? 'bg-brand-500/20 text-brand-300 border-brand-500' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-500'"
              @click="applyTag(t.query)"
            >
              {{ t.label }}
            </button>
            <button
              v-if="searchQuery || selectedOutcomeFilter !== 'all' || selectedTag"
              type="button"
              class="text-rose-500 hover:underline font-bold ml-1"
              @click="clearFilters"
            >
              Reset filters
            </button>
          </div>

          <div v-if="activeTab === 'outcomes'" class="flex items-center gap-2">
            <button
              type="button"
              class="text-slate-400 hover:text-slate-200 font-bold"
              @click="expandAllOutcomes"
            >
              Expand All
            </button>
            <span class="text-slate-600">·</span>
            <button
              type="button"
              class="text-slate-400 hover:text-slate-200 font-bold"
              @click="collapseAllOutcomes"
            >
              Collapse All
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 3. TAB 1: 5 LEARNING OUTCOMES WITH INTERACTIVE PROVOCATIONS           -->
    <!-- ===================================================================== -->
    <div v-if="activeTab === 'outcomes'" class="space-y-4">
      <div v-if="filteredOutcomes.length === 0" class="card text-center p-8 space-y-2">
        <p class="text-2xl">🔍</p>
        <p class="font-bold text-slate-300">No matching outcomes or sub-outcomes found</p>
        <p class="text-xs text-slate-400">Try clearing your search query or selecting "All (5)".</p>
        <button type="button" class="btn-secondary text-xs mt-2" @click="clearFilters">Clear Search</button>
      </div>

      <article
        v-for="outcome in filteredOutcomes"
        :key="outcome.id"
        class="card p-5 sm:p-6 transition-all duration-200 border-2"
        :class="[getOutcomeStyle(outcome.id).border, getOutcomeStyle(outcome.id).bg]"
      >
        <!-- Outcome Header Bar -->
        <div class="flex items-start justify-between gap-4 cursor-pointer select-none" @click="toggleOutcome(outcome.id)">
          <div class="flex items-start gap-3.5 min-w-0">
            <div class="w-12 h-12 rounded-2xl grid place-items-center text-2xl shrink-0 border" :class="getOutcomeStyle(outcome.id).badge">
              {{ outcome.emoji }}
            </div>
            <div class="space-y-1 min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border font-mono" :class="getOutcomeStyle(outcome.id).badge">
                  Outcome {{ outcome.id }}
                </span>
                <span class="text-xs font-bold text-slate-400">
                  {{ outcome.shortTitle }} · {{ outcome.subOutcomes.length }} Sub-outcomes
                </span>
              </div>
              <h2 class="font-display text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                {{ outcome.title }}
              </h2>
              <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
                {{ outcome.summary }}
              </p>
            </div>
          </div>

          <button
            type="button"
            class="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 shrink-0 transition-transform"
            :class="expandedOutcomes.has(outcome.id) ? 'rotate-180' : ''"
            :aria-label="expandedOutcomes.has(outcome.id) ? 'Collapse' : 'Expand'"
          >
            ▾
          </button>
        </div>

        <!-- Sub-outcomes & Observation Evidence List -->
        <div v-if="expandedOutcomes.has(outcome.id)" class="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-4">
          <div class="grid gap-3 sm:grid-cols-2">
            <div
              v-for="sub in outcome.subOutcomes"
              :key="sub.id"
              class="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/80 p-4 space-y-3 shadow-soft flex flex-col justify-between"
            >
              <div class="space-y-2">
                <div class="flex items-start justify-between gap-2">
                  <span class="inline-flex px-2 py-0.5 rounded-md font-mono text-[11px] font-bold" :class="getOutcomeStyle(outcome.id).badge">
                    {{ sub.id }}
                  </span>
                  <button
                    type="button"
                    class="btn-secondary text-[11px] py-1 px-2.5 font-bold flex items-center gap-1 hover:border-brand-500"
                    title="Generate an inquiry provocation setup and questions for this sub-outcome"
                    @click.stop="openProvocationModal(outcome, sub)"
                  >
                    <span>✨</span>
                    <span>AI Provocation</span>
                  </button>
                </div>

                <p class="text-xs font-extrabold text-slate-900 dark:text-slate-100 leading-snug">
                  {{ sub.text }}
                </p>

                <!-- Look For Observation Prompts -->
                <div class="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                  <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                    <span>Look For (Observation Prompts):</span>
                    <span class="text-[9px] text-slate-500 font-normal">Click to check</span>
                  </p>
                  <ul class="space-y-1">
                    <li
                      v-for="(prompt, idx) in sub.lookFor"
                      :key="idx"
                      class="text-xs flex items-start gap-2 cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                      @click="toggleLookFor(`${sub.id}-${idx}`)"
                    >
                      <span
                        class="w-3.5 h-3.5 rounded border grid place-items-center text-[9px] shrink-0 mt-0.5 transition-all"
                        :class="checkedLookFors.has(`${sub.id}-${idx}`) ? 'bg-brand-500 border-brand-500 text-white' : 'border-slate-400 dark:border-slate-600'"
                      >
                        <span v-if="checkedLookFors.has(`${sub.id}-${idx}`)">✓</span>
                      </span>
                      <span
                        class="leading-tight select-none"
                        :class="checkedLookFors.has(`${sub.id}-${idx}`) ? 'text-brand-400 font-semibold' : 'text-slate-600 dark:text-slate-300'"
                      >
                        {{ prompt }}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>

              <!-- Quick Provocation Footer -->
              <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                <span class="flex items-center gap-1">
                  <span>Room:</span>
                  <strong class="text-slate-300">{{ selectedRoom }}</strong>
                </span>
                <button
                  type="button"
                  class="text-brand-400 hover:underline font-bold"
                  @click="openProvocationModal(outcome, sub)"
                >
                  Reggio Setup &rarr;
                </button>
              </div>
            </div>
          </div>

          <!-- Theoretical Bridges -->
          <div class="rounded-2xl bg-slate-100/80 dark:bg-slate-850 p-3.5 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div class="space-y-1">
              <span class="font-bold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                <span>📚</span>
                <span>Theorist Connections for Outcome {{ outcome.id }}:</span>
              </span>
              <p class="text-slate-600 dark:text-slate-400 text-[11px]">
                {{ theoriesForOutcome(outcome.id).map(t => `${t.name.split('—')[0].trim()} (${t.tradition})`).join(' · ') }}
              </p>
            </div>
            <RouterLink
              to="/theories"
              class="btn-secondary text-[11px] py-1 px-2.5 font-bold whitespace-nowrap shrink-0"
            >
              Literature Library &rarr;
            </RouterLink>
          </div>
        </div>
      </article>
    </div>

    <!-- ===================================================================== -->
    <!-- 4. TAB 2: PRINCIPLES & PRACTICES (V2.0 UPDATES)                       -->
    <!-- ===================================================================== -->
    <div v-else-if="activeTab === 'principles'" class="space-y-6">
      <div class="grid gap-6 lg:grid-cols-2">
        <!-- 8 Principles -->
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div>
              <h2 class="font-display text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>🌱</span>
                <span>8 Core Principles</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Foundations that guide early childhood pedagogical decision making.
              </p>
            </div>
            <span class="text-xs font-mono font-bold bg-brand-500/20 text-brand-300 px-2 py-0.5 rounded-full">
              {{ filteredPrinciples.length }} / 8
            </span>
          </div>

          <div class="grid gap-3">
            <article
              v-for="(p, i) in filteredPrinciples"
              :key="p.title"
              class="card p-4 space-y-2 border hover:border-brand-500/40 transition-all bg-white dark:bg-slate-900"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-mono text-xs font-black text-brand-500">
                  P{{ i + 1 }}
                </span>
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="p.title.includes('Aboriginal') || p.title.includes('Sustainability') || p.title.includes('Collaborative')"
                    class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-black"
                  >
                    ⭐ V2.0 Enhanced
                  </span>
                  <button
                    type="button"
                    class="btn-secondary text-[10px] py-1 px-2 font-bold"
                    @click="openReflectionModal('principle', p)"
                  >
                    ✨ Team Reflection
                  </button>
                </div>
              </div>

              <h3 class="font-display text-sm font-black text-slate-900 dark:text-white">
                {{ p.title }}
              </h3>
              <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {{ p.description }}
              </p>
            </article>
          </div>
        </div>

        <!-- 7 Practices -->
        <div class="space-y-4">
          <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div>
              <h2 class="font-display text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <span>🎨</span>
                <span>7 Essential Practices</span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">
                Holistic curriculum approaches and everyday room actions.
              </p>
            </div>
            <span class="text-xs font-mono font-bold bg-sky-500/20 text-sky-300 px-2 py-0.5 rounded-full">
              {{ filteredPractices.length }} / 7
            </span>
          </div>

          <div class="grid gap-3">
            <article
              v-for="(pr, i) in filteredPractices"
              :key="pr.title"
              class="card p-4 space-y-2 border hover:border-sky-500/40 transition-all bg-white dark:bg-slate-900"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-mono text-xs font-black text-sky-500">
                  PR{{ i + 1 }}
                </span>
                <div class="flex items-center gap-1.5">
                  <span
                    v-if="pr.title.includes('Cultural responsiveness') || pr.title.includes('Play-based')"
                    class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[10px] font-black"
                  >
                    ⭐ V2.0 Enhanced
                  </span>
                  <button
                    type="button"
                    class="btn-secondary text-[10px] py-1 px-2 font-bold"
                    @click="openReflectionModal('practice', pr)"
                  >
                    ✨ Team Reflection
                  </button>
                </div>
              </div>

              <h3 class="font-display text-sm font-black text-slate-900 dark:text-white">
                {{ pr.title }}
              </h3>
              <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {{ pr.description }}
              </p>
            </article>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 5. TAB 3: THE 6-STAGE PLANNING CYCLE                                  -->
    <!-- ===================================================================== -->
    <div v-else-if="activeTab === 'cycle'" class="space-y-6">
      <div class="card p-5 sm:p-6 bg-gradient-to-r from-brand-900/40 via-slate-900 to-indigo-950/40 border border-brand-500/20 space-y-2">
        <h2 class="font-display text-lg font-black text-white flex items-center gap-2">
          <span>🔄</span>
          <span>The Ongoing Planning &amp; Inquiry Cycle</span>
        </h2>
        <p class="text-xs sm:text-sm text-slate-300 leading-relaxed">
          Educators at Hadfield engage in continuous critical inquiry. Every tool in this portal seamlessly maps
          to one of these 6 stages, keeping documentation authentic, manageable, and child-centred.
        </p>
      </div>

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="(step, idx) in PLANNING_CYCLE"
          :key="step.step"
          class="card p-5 space-y-3 relative overflow-hidden border border-slate-200 dark:border-slate-800 hover:border-brand-500/40 transition-all flex flex-col justify-between"
        >
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="w-8 h-8 rounded-xl bg-brand-500/20 text-brand-400 font-mono font-black text-sm grid place-items-center">
                0{{ idx + 1 }}
              </span>
              <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cycle Stage {{ idx + 1 }}
              </span>
            </div>

            <h3 class="font-display text-base font-black text-slate-900 dark:text-white">
              {{ step.step }}
            </h3>

            <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {{ step.description }}
            </p>
          </div>

          <div class="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
            <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-2.5 text-[11px] text-slate-400 flex items-start gap-1.5">
              <span>💡</span>
              <span>{{ step.outcomeHint }}</span>
            </div>

            <!-- Contextual Link to App Module -->
            <RouterLink
              v-if="idx === 0"
              to="/learning-stories"
              class="btn-secondary text-[11px] w-full py-1.5 text-center font-bold block"
            >
              Open Quick Capture &rarr;
            </RouterLink>
            <RouterLink
              v-else-if="idx === 1"
              to="/learning-outcomes"
              class="btn-secondary text-[11px] w-full py-1.5 text-center font-bold block"
            >
              View Outcomes Coverage Radar &rarr;
            </RouterLink>
            <RouterLink
              v-else-if="idx === 2"
              to="/projects"
              class="btn-secondary text-[11px] w-full py-1.5 text-center font-bold block"
            >
              Inquiry Mind Map &amp; Setup &rarr;
            </RouterLink>
            <RouterLink
              v-else-if="idx === 3"
              to="/learning-stories"
              class="btn-secondary text-[11px] w-full py-1.5 text-center font-bold block"
            >
              Learning Stories Studio &rarr;
            </RouterLink>
            <RouterLink
              v-else-if="idx === 4"
              to="/program-book"
              class="btn-secondary text-[11px] w-full py-1.5 text-center font-bold block"
            >
              Program Book Reflection &rarr;
            </RouterLink>
            <RouterLink
              v-else
              to="/weekly-wrap-up"
              class="btn-secondary text-[11px] w-full py-1.5 text-center font-bold block"
            >
              Weekly Wrap-Up &amp; Newsletters &rarr;
            </RouterLink>
          </div>
        </article>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 6. TAB 4: AI OBSERVATION MATCHER & SANDBOX                            -->
    <!-- ===================================================================== -->
    <div v-else-if="activeTab === 'matcher'" class="space-y-6">
      <div class="grid gap-6 lg:grid-cols-12">
        <!-- Input Panel (Left Column) -->
        <div class="lg:col-span-6 space-y-4">
          <div class="card p-5 sm:p-6 space-y-4">
            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <h2 class="font-display text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>⚡</span>
                  <span>AI Observation &amp; Outcome Matcher</span>
                </h2>
                <span class="text-xs font-mono text-brand-400 font-bold">
                  {{ selectedRoom }}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Paste or speak a raw observation. The AI analyzes it against all 5 EYLF V2.0 outcomes, identifies learning dispositions, recommends a theorist, and writes a draft learning story analysis.
              </p>
            </div>

            <!-- 1-Click Preset Observation Chips -->
            <div class="space-y-1.5">
              <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Load Sample Observation Presets:
              </label>
              <div class="grid grid-cols-2 gap-1.5">
                <button
                  v-for="preset in PRESET_OBSERVATIONS"
                  :key="preset.title"
                  type="button"
                  class="text-left p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 hover:border-brand-500/50 transition-all text-[11px] space-y-0.5"
                  @click="loadPreset(preset)"
                >
                  <p class="font-bold text-slate-900 dark:text-slate-200 truncate">{{ preset.title }}</p>
                  <p class="text-[10px] text-slate-400">{{ preset.room }}</p>
                </button>
              </div>
            </div>

            <!-- Observation Textarea & Voice Input -->
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Raw Child Observation / Play Scenario:
                </label>

                <!-- Voice Dictate Button -->
                <button
                  type="button"
                  class="btn-secondary text-[11px] py-1 px-2.5 font-bold flex items-center gap-1.5 transition-all"
                  :class="isRecording ? 'border-rose-500 bg-rose-500/20 text-rose-300 animate-pulse' : ''"
                  @click="toggleVoiceRecording"
                >
                  <span>{{ isRecording ? '⏹ Stop' : isTranscribing ? '⏳' : '🎤' }}</span>
                  <span>{{ isRecording ? 'Recording (Click to Stop)' : isTranscribing ? 'Transcribing…' : 'Voice Dictate' }}</span>
                </button>
              </div>

              <textarea
                v-model="matcherObservation"
                rows="6"
                placeholder="What did the child do, say, explore, or build? Mention loose parts, interactions with peers, problem-solving, or emotional cues…"
                class="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-brand-500 outline-none leading-relaxed"
              ></textarea>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center gap-2 pt-1">
              <button
                type="button"
                :disabled="matcherLoading || isTranscribing || !matcherObservation.trim()"
                class="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-soft"
                @click="analyzeObservation"
              >
                <span v-if="matcherLoading">⏳ Evaluating against EYLF V2.0…</span>
                <template v-else>
                  <span>⚡</span>
                  <span>AI Analyze &amp; Map to EYLF V2.0</span>
                </template>
              </button>

              <button
                v-if="matcherObservation"
                type="button"
                class="btn-ghost text-xs px-3 py-2 text-slate-400 hover:text-rose-400"
                @click="matcherObservation = ''; matcherResult = null"
              >
                Clear
              </button>
            </div>
          </div>
        </div>

        <!-- Output Panel (Right Column) -->
        <div class="lg:col-span-6 space-y-4">
          <!-- Placeholder state -->
          <div
            v-if="!matcherResult && !matcherLoading"
            class="card p-8 text-center space-y-3 border-dashed border-2 border-slate-200 dark:border-slate-800 grid place-content-center min-h-[360px]"
          >
            <div class="w-16 h-16 rounded-3xl bg-brand-500/10 text-3xl grid place-items-center mx-auto text-brand-400">
              🎯
            </div>
            <div class="space-y-1 max-w-sm mx-auto">
              <h3 class="font-display text-base font-bold text-slate-300">
                Awaiting Observation Notes
              </h3>
              <p class="text-xs text-slate-500 leading-relaxed">
                Click a sample preset on the left or dictate your own observation notes. The AI will cross-reference the Early Years Learning Framework V2.0 and generate complete pedagogical mappings.
              </p>
            </div>
          </div>

          <!-- Loading state -->
          <div
            v-else-if="matcherLoading"
            class="card p-8 text-center space-y-4 border border-brand-500/30 grid place-content-center min-h-[360px]"
          >
            <div class="w-12 h-12 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin mx-auto"></div>
            <p class="text-xs font-bold text-brand-300">Cross-referencing 5 Outcomes &amp; Theorists…</p>
          </div>

          <!-- AI Analysis Result Card -->
          <div v-else-if="matcherResult" class="card p-5 sm:p-6 space-y-4 border-2 border-brand-500/40 bg-slate-900/90 shadow-soft">
            <div class="flex items-center justify-between pb-3 border-b border-slate-800">
              <div class="flex items-center gap-2">
                <span class="text-xl">🏆</span>
                <span class="font-display text-sm font-black text-white">Pedagogical Analysis</span>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-xs font-black bg-brand-500/20 text-brand-300 border border-brand-500/40">
                {{ matcherResult.primaryOutcome.confidenceScore }}% Confidence Match
              </span>
            </div>

            <!-- Primary Outcome Card -->
            <div class="rounded-2xl p-4 border" :class="[getOutcomeStyle(matcherResult.primaryOutcome.outcomeId).border, getOutcomeStyle(matcherResult.primaryOutcome.outcomeId).bg]">
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-mono font-black uppercase tracking-wider" :class="getOutcomeStyle(matcherResult.primaryOutcome.outcomeId).text">
                  Primary: Outcome {{ matcherResult.primaryOutcome.outcomeId }} · Sub {{ matcherResult.primaryOutcome.subOutcomeId }}
                </span>
              </div>
              <h3 class="font-display text-sm font-black text-white mt-1">
                {{ matcherResult.primaryOutcome.subOutcomeText }}
              </h3>
              <p class="text-xs text-slate-300 mt-2 leading-relaxed">
                {{ matcherResult.primaryOutcome.pedagogicalReasoning }}
              </p>
            </div>

            <!-- Dispositions & Theorist Grid -->
            <div class="grid sm:grid-cols-2 gap-3 text-xs">
              <!-- Dispositions -->
              <div class="rounded-xl bg-slate-800/80 p-3 border border-slate-700 space-y-1.5">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Learning Dispositions:
                </p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="d in matcherResult.learningDispositions"
                    :key="d"
                    class="px-2 py-0.5 rounded-md bg-brand-500/20 text-brand-300 font-semibold text-[11px]"
                  >
                    {{ d }}
                  </span>
                </div>
              </div>

              <!-- Theorist Perspective -->
              <div class="rounded-xl bg-slate-800/80 p-3 border border-slate-700 space-y-1">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Theorist Lens:
                </p>
                <p class="font-bold text-white text-[11px]">
                  {{ matcherResult.theoristPerspective.theorist }}
                </p>
                <p class="text-[10px] text-slate-300">
                  {{ matcherResult.theoristPerspective.concept }}
                </p>
              </div>
            </div>

            <!-- Intentional Extension Provocation -->
            <div class="rounded-xl bg-indigo-950/30 border border-indigo-500/30 p-3.5 space-y-1">
              <p class="text-[10px] font-bold uppercase tracking-wider text-indigo-400">
                Intentional Teaching Extension:
              </p>
              <p class="text-xs text-slate-200 leading-relaxed">
                {{ matcherResult.intentionalTeachingExtension }}
              </p>
            </div>

            <!-- Learning Story Analysis Paragraph -->
            <div class="rounded-xl bg-slate-800/90 border border-slate-700 p-3.5 space-y-2">
              <div class="flex items-center justify-between">
                <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Learning Story Analysis Excerpt:
                </p>
                <button
                  type="button"
                  class="text-[10px] text-brand-400 hover:underline font-bold"
                  @click="copyText(matcherResult.learningStoryAnalysisExcerpt, 'Analysis paragraph')"
                >
                  📋 Copy
                </button>
              </div>
              <p class="text-xs text-slate-300 italic leading-relaxed">
                "{{ matcherResult.learningStoryAnalysisExcerpt }}"
              </p>
            </div>

            <!-- Export to Learning Stories Studio Button -->
            <button
              type="button"
              class="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-soft"
              @click="sendAnalysisToLearningStory"
            >
              <span>📖</span>
              <span>Open in Learning Stories Studio</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 7. SUB-OUTCOME AI PROVOCATION MODAL                                    -->
    <!-- ===================================================================== -->
    <div
      v-if="showProvocationModal && selectedParentOutcome && selectedSubOutcome"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div class="card max-w-2xl w-full p-6 sm:p-7 space-y-5 bg-slate-900 border-slate-700 shadow-lift max-h-[90vh] overflow-y-auto">
        <!-- Modal Header -->
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold" :class="getOutcomeStyle(selectedParentOutcome.id).badge">
                Outcome {{ selectedParentOutcome.id }} · Sub {{ selectedSubOutcome.id }}
              </span>
              <span class="text-xs text-slate-400 font-bold">{{ selectedRoom }}</span>
            </div>
            <h2 class="font-display text-base sm:text-lg font-black text-white">
              {{ selectedSubOutcome.text }}
            </h2>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-white p-1 text-lg"
            @click="showProvocationModal = false"
          >
            ✕
          </button>
        </div>

        <!-- Generator Controls -->
        <div class="space-y-3 bg-slate-800/80 rounded-2xl p-4 border border-slate-700">
          <div class="space-y-1">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-300">
              Optional Children's Current Interest / Context:
            </label>
            <input
              v-model="provocationInterest"
              type="text"
              placeholder="e.g. building tall bridges, mixing colours with pipettes, collecting gumnuts outdoors…"
              class="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-brand-500 outline-none"
            />
          </div>

          <button
            type="button"
            :disabled="provocationLoading"
            class="btn-primary w-full py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-soft"
            @click="generateProvocation"
          >
            <span v-if="provocationLoading">⏳ Designing Reggio Provocation…</span>
            <span v-else>✨ Generate Inquiry Provocation Setup</span>
          </button>
        </div>

        <!-- Provocation Output -->
        <div v-if="provocationResult" class="space-y-4 pt-2">
          <!-- Title & Setup -->
          <div class="rounded-2xl border border-brand-500/40 bg-brand-950/30 p-4 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-brand-400">Inquiry Provocation:</span>
              <span class="text-[10px] text-slate-400">{{ provocationResult.ageFocus }}</span>
            </div>
            <h3 class="font-display text-base font-black text-white">
              {{ provocationResult.provocationTitle }}
            </h3>
            <p class="text-xs text-slate-200 leading-relaxed">
              <strong>Environment as 3rd Teacher:</strong> {{ provocationResult.reggioEnvironmentSetup }}
            </p>
          </div>

          <!-- Open-ended Questions -->
          <div class="rounded-2xl bg-slate-800/80 p-4 border border-slate-700 space-y-2 text-xs">
            <p class="text-[10px] font-bold uppercase tracking-wider text-amber-400">
              Open-Ended Provocation Questions for Educators:
            </p>
            <ul class="list-disc pl-4 space-y-1 text-slate-300">
              <li v-for="(q, idx) in provocationResult.openEndedQuestions" :key="idx">
                {{ q }}
              </li>
            </ul>
          </div>

          <!-- Theorist Bridge -->
          <div class="rounded-xl bg-slate-800/80 p-3.5 border border-slate-700 text-xs space-y-1">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Pedagogical &amp; Theorist Bridge:
            </p>
            <p class="font-bold text-white">
              {{ provocationResult.theoristLink.name }} — {{ provocationResult.theoristLink.concept }}
            </p>
            <p class="text-slate-300 text-[11px]">
              {{ provocationResult.theoristLink.explanation }}
            </p>
          </div>

          <!-- Ready-to-use Observation Snippet -->
          <div class="rounded-xl bg-slate-800/80 p-3.5 border border-slate-700 text-xs space-y-1">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Exemplar Observation Snippet:
            </p>
            <p class="text-slate-300 italic text-[11px]">
              "{{ provocationResult.learningStorySnippet }}"
            </p>
          </div>

          <!-- Modal Action Buttons -->
          <div class="flex items-center gap-2 pt-2">
            <button
              type="button"
              class="btn-primary flex-1 py-2 text-xs font-bold"
              @click="sendProvocationToLearningStory"
            >
              📖 Create Learning Story from this Setup
            </button>
            <button
              type="button"
              class="btn-secondary py-2 px-3 text-xs font-bold"
              @click="copyText(`${provocationResult.provocationTitle}\n\nSetup: ${provocationResult.reggioEnvironmentSetup}\n\nQuestions:\n- ${provocationResult.openEndedQuestions.join('\n- ')}`, 'Provocation plan')"
            >
              📋 Copy
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- 8. TEAM CRITICAL REFLECTION MODAL (Tab 2)                              -->
    <!-- ===================================================================== -->
    <div
      v-if="showReflectionModal && reflectionTarget"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
    >
      <div class="card max-w-xl w-full p-6 space-y-4 bg-slate-900 border-slate-700 shadow-lift max-h-[85vh] overflow-y-auto">
        <div class="flex items-start justify-between gap-4">
          <div class="space-y-1">
            <span class="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-brand-500/20 text-brand-300">
              Staff Meeting Critical Reflection Provocation
            </span>
            <h2 class="font-display text-base font-black text-white">
              {{ reflectionTarget.title }}
            </h2>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-white p-1 text-lg"
            @click="showReflectionModal = false"
          >
            ✕
          </button>
        </div>

        <div v-if="reflectionLoading" class="text-center py-8 space-y-3">
          <div class="w-10 h-10 rounded-full border-4 border-brand-500/20 border-t-brand-500 animate-spin mx-auto"></div>
          <p class="text-xs text-brand-300">Generating NQS-aligned critical reflection questions…</p>
        </div>

        <div v-else-if="reflectionResult" class="space-y-4 text-xs">
          <!-- NQS Alignment -->
          <div class="rounded-xl bg-slate-800/80 p-3 border border-slate-700 flex items-center justify-between">
            <span class="text-slate-400 font-bold text-[11px]">NQS Quality Area Link:</span>
            <span class="text-brand-300 font-bold text-[11px]">{{ reflectionResult.nqsLink }}</span>
          </div>

          <!-- 3 Reflection Questions -->
          <div class="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <span>💬</span>
              <span>Questions for Team Discussion:</span>
            </p>
            <ul class="space-y-2">
              <li
                v-for="(q, idx) in reflectionResult.criticalReflectionQuestions"
                :key="idx"
                class="text-xs text-slate-200 leading-relaxed pl-2 border-l-2 border-amber-500/50"
              >
                {{ q }}
              </li>
            </ul>
          </div>

          <!-- Classroom Actions -->
          <div class="rounded-2xl bg-slate-800/80 p-4 border border-slate-700 space-y-2">
            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Immediate Room Actions to Implement This Week:
            </p>
            <ul class="list-disc pl-4 space-y-1 text-slate-300">
              <li v-for="(act, idx) in reflectionResult.roomActionIdeas" :key="idx">
                {{ act }}
              </li>
            </ul>
          </div>

          <!-- Leadership Tip -->
          <div class="rounded-xl bg-slate-800 p-3 border border-slate-700 text-slate-300 space-y-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-brand-400">Educational Leadership Tip:</span>
            <p class="text-[11px] leading-relaxed">{{ reflectionResult.leadershipTip }}</p>
          </div>

          <div class="flex items-center gap-2 pt-2">
            <button
              type="button"
              class="btn-primary flex-1 py-2 text-xs font-bold"
              @click="copyText(`Topic: ${reflectionResult.title}\n\nQuestions:\n- ${reflectionResult.criticalReflectionQuestions.join('\n- ')}\n\nActions:\n- ${reflectionResult.roomActionIdeas.join('\n- ')}`, 'Team reflection plan')"
            >
              📋 Copy for Staff Meeting Notes
            </button>
            <button
              type="button"
              class="btn-secondary py-2 px-3 text-xs font-bold"
              @click="showReflectionModal = false"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@media print {
  /* Clean, high-contrast, professional print stylesheet for wall reference */
  body {
    background: white !important;
    color: black !important;
  }
}
</style>