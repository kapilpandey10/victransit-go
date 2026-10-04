import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createRepo, TABLES } from '@/services/repo'
import { useAuthStore } from './auth'
import type { Activity, EylfOutcomeId, LearningStory, MindMapNode, Project } from '@/types'

const projectsRepo = createRepo<Project>(TABLES.projects, { centreShared: true })
const nodesRepo = createRepo<MindMapNode>(TABLES.mindmapNodes, { centreShared: true })
const storiesRepo = createRepo<LearningStory>(TABLES.learningStories, { centreShared: true })
const activitiesRepo = createRepo<Activity>(TABLES.activities, { centreShared: true })

export const useProjectStore = defineStore('project', () => {
  const auth = useAuthStore()

  const projects = ref<Project[]>([])
  const activeProject = ref<Project | null>(null)
  const stories = ref<LearningStory[]>([])
  const activities = ref<Activity[]>([])
  const loading = ref(false)
  const saving = ref(false)
  const error = ref<string | null>(null)

  const recentProjects = computed(() => projects.value.slice(0, 6))
  const activeOutcomeIds = computed<EylfOutcomeId[]>(
    () => activeProject.value?.eylf_outcome_ids ?? [],
  )

  const scope = () => auth.scopeId

  async function loadProjects() {
    loading.value = true
    error.value = null
    try {
      projects.value = await projectsRepo.list(scope())
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function loadWorkspace(projectId: string) {
    error.value = null
    try {
      activeProject.value = await projectsRepo.get(scope(), projectId)
      stories.value = await storiesRepo.list(scope(), { where: { project_id: projectId } })
      activities.value = await activitiesRepo.list(scope(), {
        where: { project_id: projectId },
        orderBy: 'created_at',
      })
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  async function createProject(
    payload: Partial<Project> & { title: string },
  ): Promise<Project | null> {
    saving.value = true
    try {
      const created = await projectsRepo.create(scope(), {
        description: '',
        inquiry_question: '',
        age_group: '',
        room: auth.profile?.room ?? '',
        status: 'planning',
        eylf_outcome_ids: [],
        theory_ids: [],
        ...payload,
      })
      projects.value = [created, ...projects.value]
      activeProject.value = created
      return created
    } catch (e) {
      error.value = (e as Error).message
      return null
    } finally {
      saving.value = false
    }
  }

  async function updateProject(id: string, patch: Partial<Project>) {
    const updated = await projectsRepo.update(scope(), id, patch)
    projects.value = projects.value.map(p => (p.id === id ? updated : p))
    if (activeProject.value?.id === id) activeProject.value = updated
    return updated
  }

  function canDeleteProject(project: Project): boolean {
    if (auth.isAdmin) return true
    return project.user_id === auth.userId
  }

  async function deleteProject(id: string) {
    const existing = projects.value.find(p => p.id === id)
    if (existing && !canDeleteProject(existing)) {
      throw new Error(
        "Cannot delete: Educators in the same centre can view and update each other's projects, but only the original author or Centre Director can delete it.",
      )
    }
    await projectsRepo.remove(scope(), id, auth.isAdmin)
    projects.value = projects.value.filter(p => p.id !== id)
    if (activeProject.value?.id === id) activeProject.value = null
  }

  // ---- Mind map ----------------------------------------------------------
  async function loadNodes(projectId: string): Promise<MindMapNode[]> {
    return nodesRepo.list(scope(), {
      where: { project_id: projectId },
      orderBy: 'sort_order',
      ascending: true,
    })
  }

  async function saveNodes(projectId: string, nodes: Partial<MindMapNode>[]) {
    saving.value = true
    try {
      return await nodesRepo.replaceForParent(scope(), 'project_id', projectId, nodes)
    } finally {
      saving.value = false
    }
  }

  // ---- Learning stories --------------------------------------------------
  async function loadStories(projectId?: string) {
    stories.value = await storiesRepo.list(
      scope(),
      projectId ? { where: { project_id: projectId } } : {},
    )
  }

  async function createStory(
    payload: Partial<LearningStory> & { title: string; narrative: string },
  ) {
    const created = await storiesRepo.create(scope(), {
      project_id: activeProject.value?.id ?? null,
      child_name: '',
      setting: '',
      analysis: '',
      educator_reflection: '',
      next_steps: '',
      family_link: '',
      educator_name: auth.displayName || '',
      eylf_outcome_ids: [],
      theory_ids: [],
      photo_urls: [],
      story_date: new Date().toISOString().slice(0, 10),
      ...payload,
    })
    stories.value = [created, ...stories.value]
    return created
  }

  async function updateStory(id: string, patch: Partial<LearningStory>) {
    const updated = await storiesRepo.update(scope(), id, patch)
    stories.value = stories.value.map(s => (s.id === id ? updated : s))
    return updated
  }

  function canDeleteStory(story: LearningStory): boolean {
    if (auth.isAdmin) return true
    return story.user_id === auth.userId
  }

  async function deleteStory(id: string) {
    const existing = stories.value.find(s => s.id === id)
    if (existing && !canDeleteStory(existing)) {
      throw new Error(
        "Cannot delete: Educators in the same centre can view and update each other's learning stories, but only the original author or Centre Director can delete it.",
      )
    }
    await storiesRepo.remove(scope(), id, auth.isAdmin)
    stories.value = stories.value.filter(s => s.id !== id)
  }

  // ---- Activities (Programming Book experiences) --------------------------
  async function loadActivities(projectId?: string) {
    activities.value = await activitiesRepo.list(
      scope(),
      projectId ? { where: { project_id: projectId } } : {},
    )
  }

  async function createActivity(payload: Partial<Activity> & { title: string }) {
    const created = await activitiesRepo.create(scope(), {
      project_id: activeProject.value?.id ?? null,
      description: '',
      learning_intentions: '',
      success_criteria: '',
      extension_ideas: '',
      eylf_outcome_ids: [],
      theory_ids: [],
      resources: '',
      room: '',
      experience_type: 'group',
      date: new Date().toISOString().slice(0, 10),
      photo_urls: [],
      educator_name: '',
      ...payload,
    })
    activities.value = [created, ...activities.value]
    return created
  }

  async function updateActivity(id: string, patch: Partial<Activity>) {
    const updated = await activitiesRepo.update(scope(), id, patch)
    activities.value = activities.value.map(a => (a.id === id ? updated : a))
    return updated
  }

  function canDeleteActivity(activity: Activity): boolean {
    if (auth.isAdmin) return true
    return activity.user_id === auth.userId
  }

  async function deleteActivity(id: string) {
    const existing = activities.value.find(a => a.id === id)
    if (existing && !canDeleteActivity(existing)) {
      throw new Error(
        "Cannot delete: Educators in the same centre can view and update each other's experiences, but only the original author or Centre Director can delete them.",
      )
    }
    await activitiesRepo.remove(scope(), id, auth.isAdmin)
    activities.value = activities.value.filter(a => a.id !== id)
  }

  function clear() {
    activeProject.value = null
    stories.value = []
    activities.value = []
  }

  return {
    projects,
    activeProject,
    stories,
    activities,
    loading,
    saving,
    error,
    recentProjects,
    activeOutcomeIds,
    loadProjects,
    loadWorkspace,
    createProject,
    updateProject,
    deleteProject,
    loadNodes,
    saveNodes,
    loadStories,
    createStory,
    updateStory,
    deleteStory,
    canDeleteStory,
    canDeleteProject,
    loadActivities,
    createActivity,
    updateActivity,
    deleteActivity,
    canDeleteActivity,
    clear,
    scope,
  }
})