import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { createRepo, TABLES } from '@/services/repo'
import { useAuthStore } from './auth'
import type {
  TeacherAccess,
  TeacherAccessStatus,
  TeacherRole,
  TopicModuleStatus,
  TopicStatus,
} from '@/types'

const teacherRepo = createRepo<TeacherAccess>(TABLES.teacherAccess, { isGlobal: true })
const topicRepo = createRepo<TopicModuleStatus>(TABLES.topicStatuses, { isGlobal: true })

export const DEFAULT_TOPICS: Array<{
  topic_key: string
  title: string
  icon: string
  route_path: string
  status: TopicStatus
  leadership_notes: string
}> = [
  {
    topic_key: 'learning-stories',
    title: 'Learning Stories',
    icon: '📖',
    route_path: '/learning-stories',
    status: 'active',
    leadership_notes:
      'Individual child documentation featuring 1/4 A3 compact photo layouts and EYLF V2.0 sub-outcomes.',
  },
  {
    topic_key: 'program-book',
    title: 'Program Book Analysis',
    icon: '🔍',
    route_path: '/program-book',
    status: 'active',
    leadership_notes:
      'Reflective inquiry cycle analysis for continuous educational improvement.',
  },
  {
    topic_key: 'weekly-wrap-up',
    title: 'Weekly Wrap-Up',
    icon: '🗓️',
    route_path: '/weekly-wrap-up',
    status: 'active',
    leadership_notes:
      'Mon–Fri educator jot notes with 1-tap Friday family newsletter and WhatsApp copy.',
  },
  {
    topic_key: 'projects',
    title: 'Inquiry Projects & Mind Map',
    icon: '🧩',
    route_path: '/projects',
    status: 'active',
    leadership_notes:
      'Emergent curriculum planning, inquiry threads, and Reggio Emilia child-led research.',
  },
  {
    topic_key: 'learning-outcomes',
    title: 'Learning Outcomes & EYLF Radar',
    icon: '🎯',
    route_path: '/learning-outcomes',
    status: 'active',
    leadership_notes:
      'Holistic curriculum coverage across all 5 Early Years Learning Framework outcomes.',
  },
  {
    topic_key: 'theories',
    title: 'Theories & Literature Library',
    icon: '📚',
    route_path: '/theories',
    status: 'under_development',
    leadership_notes:
      'Under Development: Educational leadership is currently curating additional Australian First Nations pedagogies, Vygotsky ZPD guides, and Reggio Emilia documentation templates.',
  },
  {
    topic_key: 'newsletters',
    title: 'Family Newsletters',
    icon: '📰',
    route_path: '/newsletters',
    status: 'under_development',
    leadership_notes:
      'Under Development: Layout enhancements in progress to support high-density photo collages and room calendar integrations.',
  },
  {
    topic_key: 'eylf',
    title: 'EYLF V2.0 Reference',
    icon: '🇦🇺',
    route_path: '/eylf',
    status: 'active',
    leadership_notes:
      'Official Belonging, Being and Becoming V2.0 principles, practices, and outcomes reference.',
  },
  {
    topic_key: 'ai-assistant',
    title: 'AI Reflection Assistant',
    icon: '✨',
    route_path: '/settings',
    status: 'active',
    leadership_notes:
      'On-device pedagogical coach and inquiry co-planner.',
  },
]

export const DEFAULT_TEACHERS: Array<{
  email: string
  name: string
  role: TeacherRole
  room: string
  status: TeacherAccessStatus
  centre_name?: string
  password?: string
  is_admin?: boolean
  notes: string
}> = [
  {
    email: 'kapilpandey@hadfield.edu.au',
    name: 'Kapil Pandey',
    role: 'Centre Director',
    room: 'All Rooms',
    status: 'active',
    centre_name: 'Hadfield Early Learning Centre',
    password: 'password123',
    is_admin: true,
    notes: 'Service Director and System Administrator.',
  },
  {
    email: 'jean@hadfield.edu.au',
    name: 'Jean',
    role: 'Educational Leader',
    room: 'All Rooms',
    status: 'active',
    centre_name: 'Hadfield Early Learning Centre',
    password: 'Educator2026!',
    is_admin: false,
    notes: 'Curriculum oversight, pedagogical reflection, and educator coaching.',
  },
  {
    email: 'lakshmi@hadfield.edu.au',
    name: 'Lakshmi',
    role: 'Early Childhood Teacher',
    room: 'Dandelions',
    status: 'active',
    centre_name: 'Hadfield Early Learning Centre',
    password: 'Educator2026!',
    is_admin: false,
    notes: 'Funded Kindergarten program lead and STEM investigations.',
  },
  {
    email: 'kelly.goodsir@hadfield.edu.au',
    name: 'Kelly Goodsir',
    role: 'Room Leader',
    room: 'Butter Beans',
    status: 'active',
    centre_name: 'Hadfield Early Learning Centre',
    password: 'Educator2026!',
    is_admin: false,
    notes: 'Toddler room inquiry and play schema documentation.',
  },
  {
    email: 'nikki@hadfield.edu.au',
    name: 'Nikki',
    role: 'Early Childhood Teacher',
    room: 'Rosellas',
    status: 'invited',
    centre_name: 'Hadfield Early Learning Centre',
    password: 'Educator2026!',
    is_admin: false,
    notes: 'Pre-kindergarten early literacy and transitions.',
  },
  {
    email: 'sarah.j@hadfield.edu.au',
    name: 'Sarah Jenkins',
    role: 'Educator',
    room: 'Blossoms',
    status: 'active',
    centre_name: 'Hadfield Early Learning Centre',
    password: 'Educator2026!',
    is_admin: false,
    notes: 'Nursery infant sensory play and primary caregiving.',
  },
]

export const useAdminStore = defineStore('admin', () => {
  const auth = useAuthStore()
  const teachers = ref<TeacherAccess[]>(
    DEFAULT_TEACHERS.map((t, idx) => ({
      ...t,
      id: `default-teacher-${idx}`,
      user_id: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
  )
  const topicStatuses = ref<TopicModuleStatus[]>(
    DEFAULT_TOPICS.map((t, idx) => ({
      ...t,
      id: `default-topic-${idx}`,
      user_id: '',
      affected_rooms: [],
      target_release_date: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
  )
  const loading = ref(false)
  const initialised = ref(false)

  const scope = () => auth.scopeId

  const activeTeachers = computed(() => teachers.value.filter(t => t.status === 'active'))
  const invitedTeachers = computed(() => teachers.value.filter(t => t.status === 'invited'))
  const suspendedTeachers = computed(() => teachers.value.filter(t => t.status === 'suspended'))

  /** All distinct Centre Groups configured in the system */
  const centreGroups = computed(() => {
    const set = new Set<string>()
    for (const t of teachers.value) {
      if (t.centre_name?.trim()) set.add(t.centre_name.trim())
    }
    if (set.size === 0) set.add('Hadfield Early Learning Centre')
    return Array.from(set).sort()
  })

  const underDevTopics = computed(() =>
    topicStatuses.value.filter(t => t.status === 'under_development'),
  )

  /** Lookup map by topic key */
  const topicsByKey = computed(() => {
    const map = new Map<string, TopicModuleStatus>()
    for (const t of topicStatuses.value) {
      map.set(t.topic_key, t)
    }
    return map
  })

  /** Lookup map by route path */
  const topicsByPath = computed(() => {
    const map = new Map<string, TopicModuleStatus>()
    for (const t of topicStatuses.value) {
      map.set(t.route_path, t)
    }
    return map
  })

  async function loadTeachers() {
    try {
      const list = await teacherRepo.list(scope(), { orderBy: 'created_at', ascending: true })
      if (list.length === 0) {
        // Try remote seed if database allows it
        try {
          const seeded: TeacherAccess[] = []
          for (const t of DEFAULT_TEACHERS) {
            const item = await teacherRepo.create(scope(), {
              ...t,
              invited_at: new Date().toISOString(),
              last_active_at: t.status === 'active' ? new Date().toISOString() : undefined,
            })
            seeded.push(item)
          }
          if (seeded.length > 0) teachers.value = seeded
        } catch {
          // If RLS prevents anonymous seeding, retain built-in defaults
        }
      } else {
        teachers.value = list
      }
    } catch {
      // Retain defaults if remote query fails
    }
  }

  async function loadTopics() {
    try {
      const list = await topicRepo.list(scope(), { orderBy: 'created_at', ascending: true })
      if (list.length === 0) {
        // Try remote seed if database allows it
        try {
          const seeded: TopicModuleStatus[] = []
          for (const t of DEFAULT_TOPICS) {
            const item = await topicRepo.create(scope(), {
              ...t,
              affected_rooms: [],
              target_release_date: '',
            })
            seeded.push(item)
          }
          if (seeded.length > 0) topicStatuses.value = seeded
        } catch {
          // If RLS prevents anonymous seeding, retain built-in defaults
        }
      } else {
        // Ensure any newly introduced topic in DEFAULT_TOPICS exists
        const existingKeys = new Set(list.map(t => t.topic_key))
        const missing = DEFAULT_TOPICS.filter(d => !existingKeys.has(d.topic_key))
        if (missing.length > 0) {
          try {
            for (const m of missing) {
              const item = await topicRepo.create(scope(), {
                ...m,
                affected_rooms: [],
                target_release_date: '',
              })
              list.push(item)
            }
          } catch {
            for (const m of missing) {
              list.push({
                ...m,
                id: `default-topic-${m.topic_key}`,
                user_id: '',
                affected_rooms: [],
                target_release_date: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
            }
          }
        }
        topicStatuses.value = list
      }
    } catch {
      // Retain defaults if remote query fails
    }
  }

  async function init() {
    if (initialised.value) return
    loading.value = true
    try {
      await Promise.allSettled([loadTeachers(), loadTopics()])
      initialised.value = true
    } catch {
      initialised.value = true
    } finally {
      loading.value = false
    }
  }

  async function addTeacher(payload: {
    email: string
    name: string
    role: TeacherRole
    room: string
    centre_name?: string
    password?: string
    status?: TeacherAccessStatus
    is_admin?: boolean
    notes?: string
  }) {
    const emailNorm = payload.email.trim().toLowerCase()
    if (!emailNorm) throw new Error('Email address is required.')
    const existing = teachers.value.find(t => t.email.toLowerCase() === emailNorm)
    if (existing) {
      throw new Error(`Teacher with email ${emailNorm} is already registered.`)
    }

    const isAdmin = payload.is_admin ?? (payload.role === 'Centre Director')
    const created = await teacherRepo.create(scope(), {
      email: emailNorm,
      name: payload.name.trim() || emailNorm.split('@')[0],
      role: payload.role,
      room: payload.room || 'All Rooms',
      centre_name: payload.centre_name?.trim() || 'Hadfield Early Learning Centre',
      password: payload.password?.trim() || 'Educator2026!',
      status: payload.status ?? 'active',
      is_admin: isAdmin,
      notes: payload.notes?.trim() ?? '',
      invited_at: new Date().toISOString(),
      last_active_at: payload.status === 'active' ? new Date().toISOString() : undefined,
    })
    teachers.value = [created, ...teachers.value]
    return created
  }

  async function updateTeacher(id: string, patch: Partial<TeacherAccess>) {
    if (patch.email) {
      patch.email = patch.email.trim().toLowerCase()
    }
    if (patch.centre_name) {
      patch.centre_name = patch.centre_name.trim()
    }
    if (patch.password !== undefined) {
      patch.password = patch.password.trim()
    }
    const updated = await teacherRepo.update(scope(), id, patch)
    teachers.value = teachers.value.map(t => (t.id === id ? updated : t))
    return updated
  }

  async function deleteTeacher(id: string) {
    await teacherRepo.remove(scope(), id)
    teachers.value = teachers.value.filter(t => t.id !== id)
  }

  async function setTeacherStatus(id: string, status: TeacherAccessStatus) {
    return updateTeacher(id, {
      status,
      last_active_at: status === 'active' ? new Date().toISOString() : undefined,
    })
  }

  async function setTopicStatus(
    topicKey: string,
    status: TopicStatus,
    leadershipNotes?: string,
  ) {
    const target = topicStatuses.value.find(t => t.topic_key === topicKey)
    if (!target) return
    const patch: Partial<TopicModuleStatus> = { status }
    if (leadershipNotes !== undefined) {
      patch.leadership_notes = leadershipNotes
    }
    const updated = await topicRepo.update(scope(), target.id, patch)
    topicStatuses.value = topicStatuses.value.map(t => (t.id === target.id ? updated : t))
    return updated
  }

  async function updateTopic(id: string, patch: Partial<TopicModuleStatus>) {
    const updated = await topicRepo.update(scope(), id, patch)
    topicStatuses.value = topicStatuses.value.map(t => (t.id === id ? updated : t))
    return updated
  }

  function isTopicUnderDevelopment(topicKeyOrPath: string): boolean {
    const byKey = topicsByKey.value.get(topicKeyOrPath)
    if (byKey) return byKey.status === 'under_development'
    const byPath = topicsByPath.value.get(topicKeyOrPath)
    if (byPath) return byPath.status === 'under_development'
    return false
  }

  function getTopic(topicKeyOrPath: string): TopicModuleStatus | undefined {
    return topicsByKey.value.get(topicKeyOrPath) || topicsByPath.value.get(topicKeyOrPath)
  }

  function getTeacherByEmail(email: string): TeacherAccess | undefined {
    const norm = email.trim().toLowerCase()
    return teachers.value.find(t => t.email.toLowerCase() === norm)
  }

  function isEmailAdmin(email: string): boolean {
    const norm = email.trim().toLowerCase()
    if (!norm) return false
    if (norm === 'kapilpandey@hadfield.edu.au') return true
    const teacher = getTeacherByEmail(norm)
    if (!teacher) return false
    return Boolean(teacher.is_admin || teacher.role === 'Centre Director')
  }

  function isEmailAuthorized(email: string): boolean {
    const norm = email.trim().toLowerCase()
    if (!norm) return false
    if (norm === 'kapilpandey@hadfield.edu.au') return true
    const teacher = getTeacherByEmail(norm)
    if (!teacher) return false
    return teacher.status === 'active' || teacher.status === 'invited'
  }

  return {
    teachers,
    topicStatuses,
    loading,
    initialised,
    activeTeachers,
    invitedTeachers,
    suspendedTeachers,
    centreGroups,
    underDevTopics,
    topicsByKey,
    topicsByPath,
    init,
    loadTeachers,
    loadTopics,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    setTeacherStatus,
    setTopicStatus,
    updateTopic,
    isTopicUnderDevelopment,
    getTopic,
    getTeacherByEmail,
    isEmailAdmin,
    isEmailAuthorized,
  }
})

