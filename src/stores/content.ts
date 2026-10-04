import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createRepo, TABLES } from '@/services/repo'
import { useAuthStore } from './auth'
import type { Newsletter, ProgramBookAnalysis, WeeklyWrapUp } from '@/types'

const newslettersRepo = createRepo<Newsletter>(TABLES.newsletters)
const analysesRepo = createRepo<ProgramBookAnalysis>(TABLES.programAnalyses)
const wrapUpsRepo = createRepo<WeeklyWrapUp>(TABLES.weeklyWrapUps)

/**
 * Persisted content that is not tied to a single project: newsletters and
 * program-book analyses.
 */
export const useContentStore = defineStore('content', () => {
  const auth = useAuthStore()

  const newsletters = ref<Newsletter[]>([])
  const analyses = ref<ProgramBookAnalysis[]>([])
  const loading = ref(false)

  const scope = () => auth.scopeId

  async function loadNewsletters() {
    loading.value = true
    try {
      newsletters.value = await newslettersRepo.list(scope())
    } finally {
      loading.value = false
    }
  }

  async function saveNewsletter(
    payload: Partial<Newsletter> & { title: string; content: string },
    id?: string,
  ) {
    if (id) {
      const updated = await newslettersRepo.update(scope(), id, payload)
      newsletters.value = newsletters.value.map(n => (n.id === id ? updated : n))
      return updated
    }
    const created = await newslettersRepo.create(scope(), {
      term: '',
      date_from: null,
      date_to: null,
      eylf_outcome_ids: [],
      highlights: [],
      ...payload,
    })
    newsletters.value = [created, ...newsletters.value]
    return created
  }

  async function deleteNewsletter(id: string) {
    await newslettersRepo.remove(scope(), id)
    newsletters.value = newsletters.value.filter(n => n.id !== id)
  }

  async function loadAnalyses() {
    loading.value = true
    try {
      analyses.value = await analysesRepo.list(scope())
    } finally {
      loading.value = false
    }
  }

  async function saveAnalysis(
    payload: Partial<ProgramBookAnalysis> & { title: string; source_text: string },
    id?: string,
  ) {
    if (id) {
      const updated = await analysesRepo.update(scope(), id, payload)
      analyses.value = analyses.value.map(a => (a.id === id ? updated : a))
      return updated
    }
    const created = await analysesRepo.create(scope(), {
      summary: '',
      strengths: [],
      gaps: [],
      recommendations: [],
      coverage: {},
      eylf_outcome_ids: [],
      ...payload,
    })
    analyses.value = [created, ...analyses.value]
    return created
  }

  async function deleteAnalysis(id: string) {
    await analysesRepo.remove(scope(), id)
    analyses.value = analyses.value.filter(a => a.id !== id)
  }

  // -------------------------------------------------------------------------
  // Weekly Wrap-Up — one draft per room + week (Mon–Fri notes + compiled text).
  // -------------------------------------------------------------------------
  const wrapUps = ref<WeeklyWrapUp[]>([])

  async function loadWrapUps() {
    loading.value = true
    try {
      wrapUps.value = await wrapUpsRepo.list(scope(), { orderBy: 'week_start' })
    } finally {
      loading.value = false
    }
  }

  function findWrapUp(room: string, weekKey: string): WeeklyWrapUp | null {
    return (
      wrapUps.value.find(w => w.room === room && w.week_start === weekKey) ?? null
    )
  }

  async function saveWrapUp(
    payload: Partial<WeeklyWrapUp> & { room: string; week_start: string },
    id?: string,
  ) {
    if (id) {
      const updated = await wrapUpsRepo.update(scope(), id, payload)
      wrapUps.value = wrapUps.value.map(w => (w.id === id ? updated : w))
      return updated
    }
    const created = await wrapUpsRepo.create(scope(), {
      days: {},
      reminders: '',
      lost_found: '',
      extra_message: '',
      result: '',
      status: 'draft',
      ...payload,
    })
    wrapUps.value = [created, ...wrapUps.value]
    return created
  }

  async function deleteWrapUp(id: string) {
    await wrapUpsRepo.remove(scope(), id)
    wrapUps.value = wrapUps.value.filter(w => w.id !== id)
  }

  return {
    newsletters,
    analyses,
    wrapUps,
    loading,
    loadNewsletters,
    saveNewsletter,
    deleteNewsletter,
    loadAnalyses,
    saveAnalysis,
    deleteAnalysis,
    loadWrapUps,
    findWrapUp,
    saveWrapUp,
    deleteWrapUp,
  }
})