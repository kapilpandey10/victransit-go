import { defineStore } from 'pinia'
import { ref } from 'vue'
import { createRepo, TABLES } from '@/services/repo'
import { useAuthStore } from './auth'
import type { Newsletter, ProgramBookAnalysis, WeeklyWrapUp } from '@/types'

const newslettersRepo = createRepo<Newsletter>(TABLES.newsletters, { centreShared: true })
const analysesRepo = createRepo<ProgramBookAnalysis>(TABLES.programAnalyses, { centreShared: true })
const wrapUpsRepo = createRepo<WeeklyWrapUp>(TABLES.weeklyWrapUps, { centreShared: true })

/**
 * Persisted content that is not tied to a single project: newsletters,
 * program-book analyses, and room weekly wrap-ups.
 * All educators in the same centre can access, update, and compile with AI,
 * but only the author or Admin can delete.
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

  function canDeleteNewsletter(item: Newsletter): boolean {
    if (auth.isAdmin) return true
    return item.user_id === auth.userId
  }

  async function deleteNewsletter(id: string) {
    const existing = newsletters.value.find(n => n.id === id)
    if (existing && !canDeleteNewsletter(existing)) {
      throw new Error(
        "Cannot delete: Educators in the same centre can view and edit newsletters, but only the original author or Centre Director can delete them.",
      )
    }
    await newslettersRepo.remove(scope(), id, auth.isAdmin)
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

  function canDeleteAnalysis(item: ProgramBookAnalysis): boolean {
    if (auth.isAdmin) return true
    return item.user_id === auth.userId
  }

  async function deleteAnalysis(id: string) {
    const existing = analyses.value.find(a => a.id === id)
    if (existing && !canDeleteAnalysis(existing)) {
      throw new Error(
        "Cannot delete: Educators in the same centre can view and edit program analyses, but only the original author or Centre Director can delete them.",
      )
    }
    await analysesRepo.remove(scope(), id, auth.isAdmin)
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

  function canDeleteWrapUp(item: WeeklyWrapUp): boolean {
    if (auth.isAdmin) return true
    return item.user_id === auth.userId
  }

  async function deleteWrapUp(id: string) {
    const existing = wrapUps.value.find(w => w.id === id)
    if (existing && !canDeleteWrapUp(existing)) {
      throw new Error(
        "Cannot delete: Educators in the same centre can view and update each other's weekly wrap-ups, but only the original author or Centre Director can delete them.",
      )
    }
    await wrapUpsRepo.remove(scope(), id, auth.isAdmin)
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
    canDeleteNewsletter,
    loadAnalyses,
    saveAnalysis,
    deleteAnalysis,
    canDeleteAnalysis,
    loadWrapUps,
    findWrapUp,
    saveWrapUp,
    deleteWrapUp,
    canDeleteWrapUp,
  }
})