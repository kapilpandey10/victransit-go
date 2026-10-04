<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import UnderDevelopmentBanner from '@/components/UnderDevelopmentBanner.vue'
import { PROMPTS } from '@/data/prompts'
import { ROOMS, roomTitle } from '@/data/rooms'
import { useAiTask } from '@/composables/useAiTask'
import { useContentStore } from '@/stores/content'
import { useUiStore } from '@/stores/ui'
import {
  cleanPlainText,
  factualOnlyPlainText,
  parseWrapUpSegments,
  removeMarkdownFormatting,
  updateSegmentInRaw,
  type WrapUpSegment,
} from '@/utils/wrapUpText'
import {
  DAY_KEYS,
  currentWeek,
  formatWeek,
  shiftWeek,
  weekFromKey,
  type DayKey,
  type WeekRange,
} from '@/utils/week'
import type { WeeklyWrapUp } from '@/types'

const content = useContentStore()
const ui = useUiStore()
const ai = useAiTask()

// --- context: room + week (defaults: Blossoms, this week) -------------------
const lastRoom = localStorage.getItem('hadfield:v1:last-wrapup-room')
const room = ref<string>(ROOMS.includes(lastRoom as never) ? lastRoom! : ROOMS[0])
const anchor = ref<Date>(new Date())
const week = computed<WeekRange>(() => formatWeek(anchor.value))

const activeDay = ref<DayKey>('mon')
const notes = reactive<Record<DayKey, string>>({
  mon: '',
  tue: '',
  wed: '',
  thu: '',
  fri: '',
})
const reminders = ref('')
const lostFound = ref('')
const message = ref('')
const result = ref('')
const editingResult = ref(false)
const copied = ref(false)

const recordId = ref<string | null>(null)
const savedLabel = ref('Not saved yet')
let saving = false
let dirty = false
let saveTimer: number | undefined

const filledDays = computed(() =>
  DAY_KEYS.filter(k => notes[k].trim()).length,
)
const hasContent = computed(
  () => filledDays.value > 0 || reminders.value.trim() || lostFound.value.trim() || message.value.trim(),
)
const isCurrentWeek = computed(
  () => week.value.weekKey === currentWeek().weekKey,
)
const resultWords = computed(() =>
  result.value.trim() ? result.value.trim().split(/\s+/).length : 0,
)

const segments = computed(() => parseWrapUpSegments(result.value))
const extraCount = computed(() => segments.value.filter(s => s.isExtra).length)

// Modal / popover state for reviewing/editing an extra segment
const activeSegment = ref<WrapUpSegment | null>(null)
const editingSegmentText = ref('')
const suggestions = ref<{ title: string; text: string }[]>([])
const loadingSuggestions = ref(false)
const suggestionError = ref<string | null>(null)

function openSegmentModal(seg: WrapUpSegment) {
  activeSegment.value = seg
  editingSegmentText.value = seg.text
  suggestions.value = []
  suggestionError.value = null
}

function closeSegmentModal() {
  activeSegment.value = null
}

function deleteCurrentSegment() {
  if (!activeSegment.value || activeSegment.value.extraIndex === undefined) return
  result.value = updateSegmentInRaw(result.value, activeSegment.value.extraIndex, {
    type: 'delete',
  })
  activeSegment.value = null
  ui.showToast('AI elaboration removed', 'info')
}

function keepSegmentAsPlain() {
  if (!activeSegment.value || activeSegment.value.extraIndex === undefined) return
  result.value = updateSegmentInRaw(result.value, activeSegment.value.extraIndex, {
    type: 'keepPlain',
    newText: editingSegmentText.value.trim(),
  })
  activeSegment.value = null
  ui.showToast('Saved as plain text', 'success')
}

function saveSegmentEdit() {
  if (!activeSegment.value || activeSegment.value.extraIndex === undefined) return
  const text = editingSegmentText.value.trim()
  if (!text) {
    deleteCurrentSegment()
    return
  }
  result.value = updateSegmentInRaw(result.value, activeSegment.value.extraIndex, {
    type: 'update',
    newText: text,
  })
  activeSegment.value = null
  ui.showToast('Elaboration updated', 'success')
}

async function fetchSuggestions() {
  if (!activeSegment.value) return
  loadingSuggestions.value = true
  suggestionError.value = null
  try {
    const activityContext = Object.entries(notes)
      .filter(([_, val]) => val.trim())
      .map(([day, val]) => `${day}: ${val}`)
      .join('\n')
    const prompt = PROMPTS.suggestAlternativeExtra({
      activity: activityContext || activeSegment.value.text,
      currentSnippet: activeSegment.value.text,
      room: room.value,
    })
    const res = await ai.run<{ suggestions: { title: string; text: string }[] }>(prompt)
    if (res?.suggestions?.length) {
      suggestions.value = res.suggestions
    } else {
      suggestionError.value = 'Could not generate suggestions. You can edit manually above.'
    }
  } catch (e) {
    suggestionError.value = (e as Error).message
  } finally {
    loadingSuggestions.value = false
  }
}

// Pick today's day tab when the current week is open.
function defaultDay() {
  const today = new Date().toISOString().slice(0, 10)
  const match = week.value.days.find(d => d.iso === today)
  activeDay.value = (match?.key as DayKey) ?? 'mon'
}

// --- persistence (draft = room + week) --------------------------------------
function snapshot() {
  return {
    room: room.value,
    week_start: week.value.weekKey,
    days: { ...notes },
    reminders: reminders.value,
    lost_found: lostFound.value,
    extra_message: message.value,
    result: result.value,
    status: (result.value.trim() ? 'generated' : 'draft') as 'draft' | 'generated',
  }
}

async function saveNow() {
  if (saving) return
  saving = true
  dirty = false
  try {
    const saved = await content.saveWrapUp(snapshot(), recordId.value ?? undefined)
    recordId.value = saved.id
    savedLabel.value = `Saved ${new Date().toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}`
  } catch (e) {
    savedLabel.value = `Save failed: ${(e as Error).message}`
  } finally {
    saving = false
  }
}

function scheduleSave() {
  dirty = true
  savedLabel.value = 'Saving…'
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => void saveNow(), 1200)
}

function resetDraft() {
  for (const k of DAY_KEYS) notes[k] = ''
  reminders.value = ''
  lostFound.value = ''
  message.value = ''
  result.value = ''
  recordId.value = null
  savedLabel.value = 'Not saved yet'
}

/** Load the draft for room + week, flushing any pending edits first. */
async function loadContext() {
  if (dirty) await saveNow()
  await content.loadWrapUps()
  const found = content.findWrapUp(room.value, week.value.weekKey)
  resetDraft()
  if (found) {
    recordId.value = found.id
    for (const k of DAY_KEYS) notes[k] = found.days?.[k] ?? ''
    reminders.value = found.reminders ?? ''
    lostFound.value = found.lost_found ?? ''
    message.value = found.extra_message ?? ''
    result.value = found.result ?? ''
    savedLabel.value = found.status === 'generated' ? 'Generated copy saved' : 'Draft loaded'
  }
  defaultDay()
  localStorage.setItem('hadfield:v1:last-wrapup-room', room.value)
}

watch(room, () => void loadContext())
watch(anchor, () => void loadContext())

// Any edit → debounced autosave.
watch(
  [() => ({ ...notes }), reminders, lostFound, message, result],
  () => scheduleSave(),
  { deep: true },
)

onMounted(async () => {
  defaultDay()
  await loadContext()
})

// --- navigation -------------------------------------------------------------
function goWeek(weeks: number) {
  anchor.value = shiftWeek(anchor.value, weeks)
}
function goThisWeek() {
  anchor.value = new Date()
}

// --- AI compilation ---------------------------------------------------------
async function generate() {
  if (!hasContent.value || ai.loading.value) return
  const prompt = PROMPTS.weeklyWrapUp({
    room: room.value,
    weekLabel: week.value.label,
    closed: `${week.value.closed[0].label} ${week.value.closed[0].iso} & ${week.value.closed[1].label} ${week.value.closed[1].iso} (centre closed)`,
    days: week.value.days.map(d => ({
      label: d.label,
      date: d.date.toLocaleDateString('en-AU', { day: 'numeric', month: 'long' }),
      notes: notes[d.key],
    })),
    reminders: reminders.value,
    lostFound: lostFound.value,
    message: message.value,
  })

  const text = await ai.runText(prompt, { maxTokens: 2600, temperature: 0.6 })
  if (text) {
    result.value = removeMarkdownFormatting(text)
    editingResult.value = false
    await saveNow()
    ui.showToast('Weekly wrap-up compiled — review AI highlights', 'success')
  }
}

// --- copy functions (pure plain text, no bold asterisks) --------------------
async function copyResult(mode: 'full' | 'factual' = 'full') {
  const text = mode === 'factual'
    ? factualOnlyPlainText(result.value)
    : cleanPlainText(result.value)
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Fallback for older Safari / non-secure contexts.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
  copied.value = true
  ui.showToast(
    mode === 'factual'
      ? 'Factual notes copied (plain text, no AI elaborations)'
      : 'Wrap-up copied (clean plain text, no bold)',
    'success',
  )
  window.setTimeout(() => (copied.value = false), 2500)
}

// --- saved drafts -----------------------------------------------------------
async function selectDraft(w: WeeklyWrapUp) {
  const targetAnchor = weekFromKey(w.week_start).monday
  const roomChanged = room.value !== w.room
  const weekChanged = week.value.weekKey !== w.week_start
  room.value = w.room
  anchor.value = targetAnchor
  if (!roomChanged && !weekChanged) {
    await loadContext()
  }
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function deleteDraft(id: string) {
  if (!window.confirm('Delete this saved wrap-up draft?')) return
  await content.deleteWrapUp(id)
  if (recordId.value === id) {
    recordId.value = null
    result.value = ''
    savedLabel.value = 'Not saved yet'
  }
  ui.showToast('Draft deleted', 'info')
}
</script>

<template>
  <div class="space-y-5">
    <UnderDevelopmentBanner topic-key="weekly-wrap-up" />

    <!-- ===== Header: room + week ===== -->
    <header class="card space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="wu-room">Room</label>
          <select id="wu-room" v-model="room" class="input font-bold">
            <option v-for="r in ROOMS" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>

        <div>
          <span class="field-label">Week (Mon–Fri)</span>
          <div class="flex items-center gap-2">
            <button class="btn-secondary !px-3" aria-label="Previous week" @click="goWeek(-1)">◀</button>
            <div class="min-w-0 flex-1 text-center">
              <p class="truncate text-sm font-extrabold">{{ week.label }}</p>
              <p class="text-[11px] text-slate-400">
                {{ isCurrentWeek ? 'This week' : 'Other week' }} · due Friday
              </p>
            </div>
            <button class="btn-secondary !px-3" aria-label="Next week" @click="goWeek(1)">▶</button>
            <button
              class="btn-ghost !px-2.5 text-xs"
              :disabled="isCurrentWeek"
              @click="goThisWeek()"
            >
              Today
            </button>
          </div>
        </div>
      </div>

      <!-- Working week + closed weekend -->
      <div class="flex flex-wrap items-center gap-1.5">
        <span
          v-for="d in week.days"
          :key="d.key"
          class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
        >
          {{ d.short }} {{ d.date.getDate() }} {{ d.date.toLocaleDateString('en-AU', { month: 'short' }) }}
        </span>
        <span
          v-for="c in week.closed"
          :key="c.iso"
          class="chip bg-slate-200 text-slate-500 line-through dark:bg-slate-800 dark:text-slate-400"
          title="Centre closed"
        >
          {{ c.label }} {{ c.iso.slice(8) }} · Closed
        </span>
        <span class="ml-auto text-[11px] text-slate-400">{{ savedLabel }}</span>
      </div>
    </header>

    <!-- ===== Daily notes ===== -->
    <section class="card space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-display text-base font-extrabold">Daily notes</h2>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Jot as you go each day — the AI merges everything into one wrap-up on
          Friday. {{ filledDays }}/5 days written.
        </p>
      </div>

      <nav class="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
        <button
          v-for="d in week.days"
          :key="d.key"
          class="flex-1 rounded-lg px-2 py-2 text-xs font-bold transition sm:text-sm"
          :class="
            activeDay === d.key
              ? 'bg-white text-brand-800 shadow-soft dark:bg-slate-900 dark:text-brand-200'
              : 'text-slate-500'
          "
          @click="activeDay = d.key"
        >
          {{ d.short }} {{ d.date.getDate() }}
          <span v-if="notes[d.key].trim()" class="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle" />
        </button>
        <span
          class="flex-1 cursor-not-allowed rounded-lg px-2 py-2 text-center text-xs font-bold text-slate-400"
          title="Centre closed"
        >
          Sat–Sun
        </span>
      </nav>

      <div>
        <label class="field-label" :for="`wu-${activeDay}`">
          {{ week.days.find(d => d.key === activeDay)?.label }} notes
        </label>
        <textarea
          :id="`wu-${activeDay}`"
          v-model="notes[activeDay]"
          class="textarea"
          rows="7"
          placeholder="e.g. Clay mark-making with natural materials — children explored textures and patterns. Watering plants in the garden. Reading board books outside."
        />
        <p class="mt-1 text-[11px] text-slate-400">
          Write like you're telling families at the gate. One thought per line is
          plenty — the AI expands it.
        </p>
      </div>
    </section>

    <!-- ===== Reminders / Lost & Found / Message ===== -->
    <section class="grid gap-4 lg:grid-cols-3">
      <div class="card">
        <label class="field-label" for="wu-rem">Reminders</label>
        <textarea
          id="wu-rem"
          v-model="reminders"
          class="textarea"
          rows="5"
          placeholder="Sun Protection: Please send a labelled sunhat each day&#10;Public Holiday: Centre closed Friday"
        />
        <p class="mt-1 text-[11px] text-slate-400">One per line — a bold label is added for you.</p>
      </div>

      <div class="card">
        <label class="field-label" for="wu-lost">Lost &amp; Found</label>
        <textarea
          id="wu-lost"
          v-model="lostFound"
          class="textarea"
          rows="5"
          placeholder="Blue rain jacket (size 3)&#10;Water bottle with dinosaurs"
        />
        <p class="mt-1 text-[11px] text-slate-400">One item per line.</p>
      </div>

      <div class="card">
        <label class="field-label" for="wu-msg">Any message / announcement</label>
        <textarea
          id="wu-msg"
          v-model="message"
          class="textarea"
          rows="5"
          placeholder="Bush Kinder starts Term 4 every Friday…"
        />
        <p class="mt-1 text-[11px] text-slate-400">Included in the wrap-up as its own note.</p>
      </div>
    </section>

    <!-- ===== Compile wrap-up ===== -->
    <section class="card space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-display text-base font-extrabold">Compile wrap-up</h2>
        <span
          v-if="resultWords"
          class="text-[11px] text-slate-400"
        >
          {{ resultWords }} words
        </span>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          class="btn-primary"
          :disabled="ai.loading.value || !hasContent"
          @click="generate"
        >
          {{ ai.loading.value ? 'Compiling…' : '✨ Compile wrap-up' }}
        </button>
        <button
          v-if="result"
          class="btn-secondary"
          @click="editingResult = !editingResult"
        >
          {{ editingResult ? '👁 Interactive preview' : '✏️ Raw text' }}
        </button>
        <button
          v-if="result"
          class="btn-secondary"
          :class="copied ? '!border-emerald-400 !text-emerald-700' : ''"
          @click="copyResult('full')"
        >
          {{ copied ? '✓ Copied' : '📋 Copy plain text' }}
        </button>
        <button
          v-if="result && extraCount > 0"
          class="btn-ghost !px-3 text-xs"
          title="Copies only the factual notes, removing all AI elaborations"
          @click="copyResult('factual')"
        >
          📄 Copy factual only
        </button>
      </div>

      <p v-if="ai.error.value" class="rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
        {{ ai.error.value }}
      </p>

      <!-- Result: edit or preview -->
      <div v-if="result">
        <div v-if="editingResult">
          <label class="field-label" for="wu-result">Edit raw wrap-up (plain text)</label>
          <textarea
            id="wu-result"
            v-model="result"
            class="textarea font-mono text-sm leading-relaxed"
            rows="18"
          />
          <p class="mt-1 text-[11px] text-slate-400">
            Edit freely — changes autosave. You can wrap any developmental text inside &lt;extra&gt;...&lt;/extra&gt; to highlight it.
          </p>
        </div>
        <div v-else class="rounded-xl border border-slate-200 p-5 dark:border-slate-700 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div class="flex items-center gap-2">
              <span class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
                {{ roomTitle(room) }}
              </span>
              <span class="text-[11px] text-slate-400">{{ week.label }}</span>
            </div>
            <div v-if="extraCount > 0" class="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1.5 font-medium">
              <span class="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span>{{ extraCount }} AI {{ extraCount === 1 ? 'elaboration' : 'elaborations' }} highlighted</span>
            </div>
          </div>

          <div
            v-if="extraCount > 0"
            class="rounded-lg bg-amber-50/80 border border-amber-200/90 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:border-amber-800/60 dark:text-amber-200 flex items-start gap-2.5"
          >
            <span class="text-base select-none">✨</span>
            <div class="space-y-0.5">
              <p class="font-bold">AI Developmental Elaborations Highlighted</p>
              <p class="text-amber-800 dark:text-amber-300">
                The highlighted sections show pedagogical links added beyond your raw notes. <strong>Click any highlight</strong> to delete it, edit it, or ask the AI for alternative suggestions.
              </p>
            </div>
          </div>

          <div class="wrapup-preview whitespace-pre-wrap font-sans text-sm sm:text-base leading-relaxed text-slate-800 dark:text-slate-200 select-text">
            <template v-for="seg in segments" :key="seg.id">
              <span v-if="!seg.isExtra">{{ seg.text }}</span>
              <span
                v-else
                class="inline rounded px-1.5 py-0.5 font-medium transition cursor-pointer select-text bg-amber-100 text-amber-950 border border-amber-300/80 hover:bg-amber-200 hover:border-amber-400 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700/80 dark:hover:bg-amber-900/80 mx-0.5 group"
                title="AI added elaboration — click to delete, edit, or get suggestions"
                @click="openSegmentModal(seg)"
              ><span class="text-amber-600 dark:text-amber-400 text-xs mr-0.5 select-none font-bold">✨</span>{{ seg.text }}</span>
            </template>
          </div>
        </div>
      </div>

      <p
        v-else
        class="text-center text-sm text-slate-400 dark:text-slate-500"
      >
        Fill in the daily notes above, then tap <strong>Compile wrap-up</strong> to
        generate a family-ready newsletter using the {{ room }} house style.
      </p>
    </section>

    <!-- ===== Saved wrap-ups ===== -->
    <section v-if="content.wrapUps.length" class="card space-y-4">
      <h2 class="font-display text-base font-extrabold">
        Saved wrap-ups
        <span class="ml-1 text-xs font-normal text-slate-400">{{ content.wrapUps.length }}</span>
      </h2>

      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <article
          v-for="w in content.wrapUps"
          :key="w.id"
          class="flex flex-col gap-2 rounded-xl border border-slate-200 p-4 transition dark:border-slate-700"
          :class="w.id === recordId ? 'border-brand-400 ring-2 ring-brand-200 dark:ring-brand-900' : ''"
        >
          <div class="flex items-center gap-2">
            <span class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
              {{ w.room }}
            </span>
            <span
              class="chip"
              :class="w.status === 'generated'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'"
            >
              {{ w.status === 'generated' ? '✓ Generated' : 'Draft' }}
            </span>
          </div>
          <p class="text-sm font-bold">Week of {{ w.week_start }}</p>
          <p class="line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {{ w.result?.slice(0, 120) || 'No compiled copy yet.' }}
          </p>
          <div class="mt-auto flex gap-2 pt-1">
            <button class="btn-secondary flex-1 !py-1.5 text-xs" @click="selectDraft(w)">
              ✏️ Open
            </button>
            <button class="btn-ghost !px-3 !py-1.5 text-xs" title="Delete draft" @click="deleteDraft(w.id)">
              🗑
            </button>
          </div>
        </article>
      </div>
    </section>

    <!-- ===== Segment Inspector & Suggestions Modal ===== -->
    <Transition name="fade">
      <div
        v-if="activeSegment"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
        @click.self="closeSegmentModal"
      >
        <div class="card w-full max-w-lg space-y-4 shadow-lift dark:bg-slate-900">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex items-center gap-1.5">
                <span class="text-amber-500 text-base">✨</span>
                <h3 class="font-display text-base font-extrabold text-slate-800 dark:text-slate-100">
                  Review AI Elaboration
                </h3>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                This developmental reflection was added by the AI. Review, rephrase, or remove it.
              </p>
            </div>
            <button
              class="btn-ghost !px-2 !py-1 text-slate-400 hover:text-slate-600 text-lg"
              aria-label="Close modal"
              @click="closeSegmentModal"
            >
              ✕
            </button>
          </div>

          <div>
            <label class="field-label" for="edit-seg">Edit or rephrase reflection</label>
            <textarea
              id="edit-seg"
              v-model="editingSegmentText"
              class="textarea font-sans text-sm"
              rows="3"
            />
          </div>

          <!-- Suggestions area -->
          <div v-if="suggestions.length || loadingSuggestions || suggestionError" class="space-y-2">
            <p class="text-xs font-bold text-slate-600 dark:text-slate-300">
              Alternative pedagogical angles:
            </p>
            <div v-if="loadingSuggestions" class="text-xs text-brand-600 dark:text-brand-400 animate-pulse">
              ✨ Thinking of alternative pedagogical perspectives…
            </div>
            <p v-else-if="suggestionError" class="text-xs text-rose-500">
              {{ suggestionError }}
            </p>
            <div v-else class="space-y-2 max-h-48 overflow-y-auto pr-1">
              <div
                v-for="(sug, idx) in suggestions"
                :key="idx"
                class="rounded-lg border border-slate-200 p-2.5 hover:border-brand-400 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-800/50 text-xs transition space-y-1.5 cursor-pointer"
                @click="editingSegmentText = sug.text"
              >
                <div class="flex items-center justify-between">
                  <span class="font-bold text-brand-700 dark:text-brand-300">{{ sug.title }}</span>
                  <span class="text-[10px] text-slate-400">Click to use</span>
                </div>
                <p class="text-slate-700 dark:text-slate-300">{{ sug.text }}</p>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div class="flex gap-1.5">
              <button
                class="btn-ghost !px-3 !py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                title="Completely remove this reflection from the wrap-up"
                @click="deleteCurrentSegment"
              >
                🗑 Delete
              </button>
              <button
                class="btn-secondary !px-3 !py-1.5 text-xs"
                :disabled="loadingSuggestions"
                @click="fetchSuggestions"
              >
                💡 {{ suggestions.length ? 'Re-suggest' : 'Ask for suggestions' }}
              </button>
            </div>

            <div class="flex gap-1.5">
              <button
                class="btn-ghost !px-3 !py-1.5 text-xs"
                title="Convert to normal text without the highlight"
                @click="keepSegmentAsPlain"
              >
                ✓ Keep plain
              </button>
              <button
                class="btn-primary !px-3 !py-1.5 text-xs"
                @click="saveSegmentEdit"
              >
                Save update
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>
