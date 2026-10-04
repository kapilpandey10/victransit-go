<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useRoomsStore } from '@/stores/rooms'
import { useUiStore } from '@/stores/ui'
import SupabaseConnectionCard from '@/components/SupabaseConnectionCard.vue'
import { isSupabaseConfiguredRef } from '@/services/supabase'
import type {
  CentreRecord,
  RoomRecord,
  TeacherAccess,
  TeacherAccessStatus,
  TeacherRole,
  TopicModuleStatus,
  TopicStatus,
} from '@/types'

const admin = useAdminStore()
const auth = useAuthStore()
const roomsStore = useRoomsStore()
const ui = useUiStore()

const activeTab = ref<'overview' | 'centres' | 'rooms' | 'teachers' | 'topics' | 'cloud' | 'governance'>('overview')

onMounted(async () => {
  await Promise.all([admin.init(), roomsStore.loadRooms()])
})

// ---------------------------------------------------------------------------
// Teacher Search & Filtering
// ---------------------------------------------------------------------------
const searchQuery = ref('')
const filterCentre = ref<string>('all')
const filterRoom = ref<string>('all')
const filterStatus = ref<string>('all')

const ROLES: TeacherRole[] = [
  'Educator',
  'Early Childhood Teacher',
  'Room Leader',
  'Educational Leader',
  'Centre Director',
  'Relief Educator',
  'System Administrator',
]

// Dynamic room options based on selected centre in teacher form
const teacherFormRoomOptions = computed(() => {
  const cName = teacherForm.centre_name || 'Hadfield Early Learning Centre'
  const names = roomsStore.getRoomNamesForCentre(cName)
  return ['All Rooms', ...names]
})

// Global room options for table filtering
const globalRoomOptions = computed(() => ['All Rooms', ...roomsStore.roomNames])

const filteredTeachers = computed(() => {
  return admin.teachers.filter(t => {
    const q = searchQuery.value.toLowerCase().trim()
    const matchesSearch =
      !q ||
      t.email.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.centre_name || '').toLowerCase().includes(q) ||
      t.role.toLowerCase().includes(q) ||
      t.room.toLowerCase().includes(q)

    const matchesCentre =
      filterCentre.value === 'all' ||
      (t.centre_name || 'Hadfield Early Learning Centre') === filterCentre.value

    const matchesRoom =
      filterRoom.value === 'all' ||
      (filterRoom.value === 'All Rooms' ? t.room === 'All Rooms' : t.room.includes(filterRoom.value))

    const matchesStatus = filterStatus.value === 'all' || t.status === filterStatus.value

    return matchesSearch && matchesCentre && matchesRoom && matchesStatus
  })
})

// ---------------------------------------------------------------------------
// Add / Edit Teacher Modal State (Responsive with Sticky Footer)
// ---------------------------------------------------------------------------
const showTeacherModal = ref(false)
const editingTeacherId = ref<string | null>(null)
const teacherFormSubmitting = ref(false)

const teacherForm = reactive({
  email: '',
  name: '',
  centre_name: 'Hadfield Early Learning Centre',
  password: 'Educator2026!',
  role: 'Educator' as TeacherRole,
  room: 'All Rooms',
  status: 'active' as TeacherAccessStatus,
  is_admin: false,
  notes: '',
})

function openAddTeacherModal(prefilledCentre?: string) {
  editingTeacherId.value = null
  teacherForm.email = ''
  teacherForm.name = ''
  teacherForm.centre_name = prefilledCentre || admin.centreGroups[0] || 'Hadfield Early Learning Centre'
  teacherForm.password = 'Educator2026!'
  teacherForm.role = 'Educator'
  teacherForm.room = 'All Rooms'
  teacherForm.status = 'active'
  teacherForm.is_admin = false
  teacherForm.notes = ''
  showTeacherModal.value = true
}

function openEditTeacherModal(teacher: TeacherAccess) {
  editingTeacherId.value = teacher.id
  teacherForm.email = teacher.email
  teacherForm.name = teacher.name
  teacherForm.centre_name = teacher.centre_name || 'Hadfield Early Learning Centre'
  teacherForm.password = teacher.password || 'Educator2026!'
  teacherForm.role = teacher.role
  teacherForm.room = teacher.room
  teacherForm.status = teacher.status
  teacherForm.is_admin = Boolean(teacher.is_admin || teacher.role === 'Centre Director')
  teacherForm.notes = teacher.notes || ''
  showTeacherModal.value = true
}

async function handleSaveTeacher() {
  if (!teacherForm.email.trim()) {
    ui.showToast('Please enter an educator email address.', 'error')
    return
  }
  teacherFormSubmitting.value = true
  try {
    if (editingTeacherId.value) {
      await admin.updateTeacher(editingTeacherId.value, {
        email: teacherForm.email,
        name: teacherForm.name,
        centre_name: teacherForm.centre_name,
        password: teacherForm.password,
        role: teacherForm.role,
        room: teacherForm.room,
        status: teacherForm.status,
        is_admin: teacherForm.is_admin || teacherForm.role === 'Centre Director',
        notes: teacherForm.notes,
      })
      ui.showToast('Teacher access updated successfully.', 'success')
    } else {
      await admin.addTeacher({
        email: teacherForm.email,
        name: teacherForm.name,
        centre_name: teacherForm.centre_name,
        password: teacherForm.password,
        role: teacherForm.role,
        room: teacherForm.room,
        status: teacherForm.status,
        is_admin: teacherForm.is_admin || teacherForm.role === 'Centre Director',
        notes: teacherForm.notes,
      })
      ui.showToast(`Educator ${teacherForm.name || teacherForm.email} added to ${teacherForm.centre_name}.`, 'success')
    }
    showTeacherModal.value = false
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    teacherFormSubmitting.value = false
  }
}

async function handleDeleteTeacher(teacher: TeacherAccess) {
  if (!confirm(`Are you sure you want to revoke access for ${teacher.name} (${teacher.email})?`)) {
    return
  }
  try {
    await admin.deleteTeacher(teacher.id)
    ui.showToast(`Access revoked for ${teacher.email}.`, 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  }
}

async function handleToggleStatus(teacher: TeacherAccess, newStatus: TeacherAccessStatus) {
  try {
    await admin.setTeacherStatus(teacher.id, newStatus)
    ui.showToast(`Updated status for ${teacher.name} to ${newStatus}.`, 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  }
}

function copyFullCredentials(teacher: TeacherAccess) {
  const portalUrl = `${window.location.origin}/login?email=${encodeURIComponent(teacher.email)}`
  const text = `🌟 Hadfield Early Learning Inquiry Portal Login
Centre Group: ${teacher.centre_name || 'Hadfield Early Learning Centre'}
Educator Name: ${teacher.name}
Role: ${teacher.role} (Room: ${teacher.room})
Login Email: ${teacher.email}
Password: ${teacher.password || 'Educator2026!'}
Login Link: ${portalUrl}`

  navigator.clipboard.writeText(text).then(() => {
    ui.showToast(`Login credentials copied for ${teacher.name}!`, 'success')
  }).catch(() => {
    ui.showToast('Could not copy to clipboard.', 'error')
  })
}

// ---------------------------------------------------------------------------
// Centre / School Group Management State & Actions
// ---------------------------------------------------------------------------
const showCentreModal = ref(false)
const editingCentreId = ref<string | null>(null)
const centreFormSubmitting = ref(false)

const centreForm = reactive({
  name: '',
  code: '',
  address: '',
  phone: '',
  email: '',
  notes: '',
  initial_rooms: 'Nursery, Toddlers, Kindergarten',
})

function openAddCentreModal() {
  editingCentreId.value = null
  centreForm.name = ''
  centreForm.code = ''
  centreForm.address = ''
  centreForm.phone = ''
  centreForm.email = ''
  centreForm.notes = ''
  centreForm.initial_rooms = 'Nursery, Toddlers, Kindergarten'
  showCentreModal.value = true
}

function openEditCentreModal(centre: CentreRecord | { id: string; name: string; code?: string; address?: string; phone?: string; email?: string; notes?: string }) {
  editingCentreId.value = centre.id
  centreForm.name = centre.name
  centreForm.code = centre.code || ''
  centreForm.address = centre.address || ''
  centreForm.phone = centre.phone || ''
  centreForm.email = centre.email || ''
  centreForm.notes = centre.notes || ''
  centreForm.initial_rooms = ''
  showCentreModal.value = true
}

async function handleSaveCentre() {
  if (!centreForm.name.trim()) {
    ui.showToast('Please enter a centre name.', 'error')
    return
  }
  centreFormSubmitting.value = true
  try {
    if (editingCentreId.value) {
      await admin.updateCentre(editingCentreId.value, {
        name: centreForm.name,
        code: centreForm.code,
        address: centreForm.address,
        phone: centreForm.phone,
        email: centreForm.email,
        notes: centreForm.notes,
      })
      ui.showToast(`Centre "${centreForm.name}" updated.`, 'success')
    } else {
      const created = await admin.addCentre({
        name: centreForm.name,
        code: centreForm.code,
        address: centreForm.address,
        phone: centreForm.phone,
        email: centreForm.email,
        notes: centreForm.notes,
      })
      // If initial rooms specified, create them for this new Centre
      if (centreForm.initial_rooms.trim()) {
        const roomsToCreate = centreForm.initial_rooms
          .split(',')
          .map(r => r.trim())
          .filter(Boolean)
        for (const rm of roomsToCreate) {
          try {
            await roomsStore.addRoom(rm, created.name, `${rm} learning room at ${created.name}`)
          } catch {
            /* ignore individual duplicate */
          }
        }
      }
      ui.showToast(`New Centre "${created.name}" created with rooms!`, 'success')
    }
    showCentreModal.value = false
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    centreFormSubmitting.value = false
  }
}

async function handleDeleteCentre(centre: { id: string; name: string }) {
  if (!confirm(`Are you sure you want to delete Centre "${centre.name}"? Existing rooms and educators will need reassignment.`)) {
    return
  }
  try {
    await admin.deleteCentre(centre.id)
    ui.showToast(`Centre "${centre.name}" removed.`, 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  }
}

// ---------------------------------------------------------------------------
// Dynamic Room Management State & Actions (Scoped per Centre)
// ---------------------------------------------------------------------------
const showRoomModal = ref(false)
const editingRoomId = ref<string | null>(null)
const roomFormSubmitting = ref(false)
const filterRoomCentre = ref<string>('all')

const roomForm = reactive({
  centre_name: 'Hadfield Early Learning Centre',
  name: '',
  description: '',
})

const filteredRooms = computed(() => {
  if (filterRoomCentre.value === 'all') return roomsStore.rooms
  return roomsStore.getRoomsForCentre(filterRoomCentre.value)
})

function openAddRoomModal(prefilledCentre?: string) {
  editingRoomId.value = null
  roomForm.centre_name = prefilledCentre || admin.centreGroups[0] || 'Hadfield Early Learning Centre'
  roomForm.name = ''
  roomForm.description = ''
  showRoomModal.value = true
}

function openEditRoomModal(room: RoomRecord) {
  editingRoomId.value = room.id
  roomForm.centre_name = room.centre_name || 'Hadfield Early Learning Centre'
  roomForm.name = room.name
  roomForm.description = room.description || ''
  showRoomModal.value = true
}

async function handleSaveRoom() {
  if (!roomForm.name.trim()) {
    ui.showToast('Please enter a room name.', 'error')
    return
  }
  roomFormSubmitting.value = true
  try {
    if (editingRoomId.value) {
      await roomsStore.updateRoom(editingRoomId.value, {
        centre_name: roomForm.centre_name,
        name: roomForm.name,
        description: roomForm.description,
      })
      ui.showToast(`Room updated to "${roomForm.name}".`, 'success')
    } else {
      await roomsStore.addRoom(roomForm.name, roomForm.centre_name, roomForm.description)
      ui.showToast(`Room "${roomForm.name}" created for ${roomForm.centre_name}.`, 'success')
    }
    showRoomModal.value = false
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    roomFormSubmitting.value = false
  }
}

async function handleDeleteRoom(room: RoomRecord) {
  if (!confirm(`Are you sure you want to delete room "${room.name}"?`)) {
    return
  }
  try {
    await roomsStore.deleteRoom(room.id)
    ui.showToast(`Room "${room.name}" deleted.`, 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  }
}

// ---------------------------------------------------------------------------
// Topic Status Management
// ---------------------------------------------------------------------------
const editingNotes = reactive<Record<string, string>>({})
const savingNotes = reactive<Record<string, boolean>>({})

function getTopicNotes(topic: TopicModuleStatus): string {
  if (editingNotes[topic.topic_key] !== undefined) {
    return editingNotes[topic.topic_key]
  }
  return topic.leadership_notes || ''
}

function onNotesInput(topicKey: string, val: string) {
  editingNotes[topicKey] = val
}

async function handleSetTopicStatus(topic: TopicModuleStatus, status: TopicStatus) {
  try {
    await admin.setTopicStatus(topic.topic_key, status)
    ui.showToast(`${topic.title} status updated to ${status.replace('_', ' ').toUpperCase()}.`, 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  }
}

async function handleSaveTopicNotes(topic: TopicModuleStatus) {
  const notes = editingNotes[topic.topic_key]
  if (notes === undefined) return
  savingNotes[topic.topic_key] = true
  try {
    await admin.updateTopic(topic.id, { leadership_notes: notes })
    ui.showToast(`Leadership notes saved for ${topic.title}.`, 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    savingNotes[topic.topic_key] = false
  }
}
</script>

<template>
  <div class="space-y-6 pb-12">
    <!-- Header banner -->
    <header class="rounded-3xl bg-slate-900 p-6 sm:p-8 text-white shadow-lift relative overflow-hidden">
      <div class="absolute -right-8 -bottom-8 opacity-10 text-9xl pointer-events-none select-none">
        🛡️
      </div>

      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <span class="rounded-full bg-brand-500/20 text-brand-300 px-3 py-1 text-xs font-bold uppercase tracking-wider border border-brand-500/30">
              Super Admin Command Center
            </span>
            <span class="rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 text-xs font-semibold">
              ACECQA QA7 Governance
            </span>
            <button
              type="button"
              class="rounded-full px-2.5 py-0.5 text-xs font-semibold border transition flex items-center gap-1.5 cursor-pointer"
              :class="
                isSupabaseConfiguredRef
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30'
              "
              @click="activeTab = 'cloud'"
            >
              <span class="h-1.5 w-1.5 rounded-full" :class="isSupabaseConfiguredRef ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'" />
              <span>{{ isSupabaseConfiguredRef ? 'Supabase Connected 🟢' : 'Supabase Not Connected ⚪' }}</span>
            </button>
          </div>
          <h1 class="mt-2 font-display text-2xl sm:text-3xl font-black tracking-tight">
            Multi-Centre Governance & Platform Administration
          </h1>
          <p class="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
            Logged in as <span class="text-white font-bold">{{ auth.displayName }}</span> (<span class="font-mono text-xs text-brand-300">info@pandeykapil.com.np</span>). Manage multiple Early Learning Centres, learning rooms, educator accounts, and system governance.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-soft flex items-center gap-1.5 text-xs sm:text-sm"
            @click="openAddCentreModal"
          >
            <span>🏫</span>
            <span>New Centre</span>
          </button>
          <button
            type="button"
            class="btn bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-soft flex items-center gap-1.5 text-xs sm:text-sm"
            @click="openAddTeacherModal()"
          >
            <span>➕</span>
            <span>Add Educator</span>
          </button>
          <button
            type="button"
            class="btn bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 text-xs sm:text-sm"
            @click="openAddRoomModal()"
          >
            <span>🚪</span>
            <span>Add Room</span>
          </button>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          class="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4 cursor-pointer hover:bg-white/10 transition"
          @click="activeTab = 'centres'"
        >
          <p class="text-[11px] font-bold uppercase tracking-wider text-brand-400">Centres / Schools</p>
          <p class="mt-1 text-2xl font-black text-brand-300">{{ admin.systemStats.totalCentres }}</p>
          <p class="text-xs text-slate-400">Independent groups</p>
        </div>

        <div
          class="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4 cursor-pointer hover:bg-white/10 transition"
          @click="activeTab = 'rooms'"
        >
          <p class="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Learning Rooms</p>
          <p class="mt-1 text-2xl font-black text-emerald-300">{{ admin.systemStats.totalRooms }}</p>
          <p class="text-xs text-slate-400">Across all centres</p>
        </div>

        <div
          class="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4 cursor-pointer hover:bg-white/10 transition"
          @click="activeTab = 'teachers'"
        >
          <p class="text-[11px] font-bold uppercase tracking-wider text-sky-400">Registered Educators</p>
          <p class="mt-1 text-2xl font-black text-white">{{ admin.systemStats.totalEducators }}</p>
          <p class="text-xs text-slate-400">{{ admin.systemStats.activeEducators }} active staff</p>
        </div>

        <div class="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Child Privacy Shield</p>
          <p class="mt-1 text-lg font-black text-emerald-300 flex items-center gap-1.5">
            <span>🔒</span>
            <span>100% Protected</span>
          </p>
          <p class="text-[10px] text-slate-400">Admin zero-data visibility</p>
        </div>
      </div>
    </header>

    <!-- Child Privacy Notice Banner -->
    <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
      <div class="flex items-start gap-2.5">
        <span class="text-xl shrink-0">🛡️</span>
        <div class="space-y-0.5">
          <p class="font-bold text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2">
            <span>Child & Classroom Privacy Architecture</span>
            <span class="rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] px-2 py-0.5 font-bold uppercase">
              Zero Child Data Leakage
            </span>
          </p>
          <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
            As Platform Administrator, your role is purely administrative: managing Centres, Rooms, and Educator login credentials.
            You have <strong>zero access to classroom observations, learning stories, photos, or child notes</strong>, protecting educator-child confidentiality across every school.
          </p>
        </div>
      </div>
    </div>

    <!-- Navigation Tabs -->
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition"
        :class="
          activeTab === 'overview'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        "
        @click="activeTab = 'overview'"
      >
        <span>📊</span>
        <span>Overview & Stats</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition"
        :class="
          activeTab === 'centres'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        "
        @click="activeTab = 'centres'"
      >
        <span>🏫</span>
        <span>Centres & Schools ({{ admin.systemStats.totalCentres }})</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition"
        :class="
          activeTab === 'rooms'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        "
        @click="activeTab = 'rooms'"
      >
        <span>🚪</span>
        <span>Rooms ({{ admin.systemStats.totalRooms }})</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition"
        :class="
          activeTab === 'teachers'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        "
        @click="activeTab = 'teachers'"
      >
        <span>👩‍🏫</span>
        <span>Educators ({{ admin.systemStats.totalEducators }})</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition"
        :class="
          activeTab === 'topics'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        "
        @click="activeTab = 'topics'"
      >
        <span>🚧</span>
        <span>Curriculum Modules</span>
        <span
          v-if="admin.underDevTopics.length > 0"
          class="rounded-full bg-amber-500 text-slate-950 px-2 py-0.5 text-[10px] font-extrabold"
        >
          {{ admin.underDevTopics.length }} WIP
        </span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition"
        :class="
          activeTab === 'cloud'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        "
        @click="activeTab = 'cloud'"
      >
        <span>☁️</span>
        <span>Supabase Sync</span>
      </button>

      <button
        type="button"
        class="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition"
        :class="
          activeTab === 'governance'
            ? 'bg-brand-600 text-white shadow-sm'
            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
        "
        @click="activeTab = 'governance'"
      >
        <span>🏛️</span>
        <span>NQF Governance</span>
      </button>
    </div>

    <!-- ===================================================================== -->
    <!-- TAB 0: OVERVIEW & STATS SNAPSHOT -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'overview'" class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-slate-100">
            Multi-Centre Operational Status
          </h2>
          <p class="text-xs text-slate-500">
            Real-time status of all early learning centres, rooms, and registered educators.
          </p>
        </div>
        <button
          type="button"
          class="btn-primary text-xs flex items-center gap-1.5"
          @click="openAddCentreModal"
        >
          <span>➕</span>
          <span>Register New Centre</span>
        </button>
      </div>

      <!-- Centre Cards Grid with Detailed Breakdown -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="stat in admin.centreStats"
          :key="stat.name"
          class="card p-5 space-y-4 hover:shadow-soft transition border border-slate-200 dark:border-slate-800"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-2xl">🏫</span>
                <h3 class="font-display font-extrabold text-base text-slate-900 dark:text-slate-100">
                  {{ stat.name }}
                </h3>
              </div>
              <p class="text-xs text-slate-500">
                {{ stat.address || 'Australian Early Learning Centre' }}
              </p>
            </div>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              :class="stat.is_active ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-600'"
            >
              {{ stat.is_active ? 'Active' : 'Archived' }}
            </span>
          </div>

          <!-- Quick Stats Pills -->
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Learning Rooms</p>
              <p class="text-lg font-black text-brand-600 dark:text-brand-400">{{ stat.roomCount }}</p>
            </div>
            <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Educators</p>
              <p class="text-lg font-black text-emerald-600 dark:text-emerald-400">{{ stat.educatorCount }}</p>
            </div>
          </div>

          <!-- Rooms in this Centre -->
          <div class="space-y-2">
            <p class="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
              <span>Rooms & Assigned Staff</span>
              <button
                type="button"
                class="text-[11px] font-bold text-brand-600 hover:underline"
                @click="openAddRoomModal(stat.name)"
              >
                + Add Room
              </button>
            </p>
            <div v-if="stat.rooms.length > 0" class="flex flex-wrap gap-1.5">
              <div
                v-for="rm in stat.rooms"
                :key="rm.id"
                class="rounded-lg bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5"
              >
                <span>🚪 {{ rm.name }}</span>
                <span class="rounded bg-brand-500/20 text-brand-700 dark:text-brand-300 text-[10px] px-1 font-bold">
                  {{ rm.educators?.length || 0 }} staff
                </span>
              </div>
            </div>
            <p v-else class="text-xs text-slate-400 italic">
              No rooms created yet. Click "+ Add Room" to create one.
            </p>
          </div>

          <!-- Card Actions -->
          <div class="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              class="btn-secondary text-xs py-1.5 px-3"
              @click="openAddTeacherModal(stat.name)"
            >
              ➕ Add Educator
            </button>
            <button
              type="button"
              class="btn-ghost text-xs py-1.5 px-3"
              @click="openAddRoomModal(stat.name)"
            >
              🚪 Add Room
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 1: CENTRES & SCHOOLS MANAGEMENT -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'centres'" class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-slate-100">
            Registered Early Learning Centres & Schools
          </h2>
          <p class="text-xs text-slate-500">
            Each centre maintains isolated child records, learning stories, and room-specific inquiry cycles.
          </p>
        </div>
        <button
          type="button"
          class="btn-primary text-xs flex items-center gap-1.5 self-start sm:self-auto"
          @click="openAddCentreModal"
        >
          <span>➕</span>
          <span>Register New Centre</span>
        </button>
      </div>

      <!-- Centre List Table / Cards -->
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-3 px-4">Centre / School Name</th>
                <th class="py-3 px-4">Code / Address</th>
                <th class="py-3 px-4">Rooms</th>
                <th class="py-3 px-4">Educators</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr
                v-for="centre in admin.centreStats"
                :key="centre.name"
                class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
              >
                <td class="py-3.5 px-4 font-bold text-slate-900 dark:text-slate-100">
                  <div class="flex items-center gap-2">
                    <span>🏫</span>
                    <span>{{ centre.name }}</span>
                  </div>
                </td>
                <td class="py-3.5 px-4 text-xs text-slate-500">
                  {{ centre.address || '—' }}
                </td>
                <td class="py-3.5 px-4">
                  <span class="rounded bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 px-2 py-0.5 text-xs font-bold">
                    {{ centre.roomCount }} rooms
                  </span>
                </td>
                <td class="py-3.5 px-4">
                  <span class="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 text-xs font-bold">
                    {{ centre.educatorCount }} educators
                  </span>
                </td>
                <td class="py-3.5 px-4">
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Active
                  </span>
                </td>
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      class="btn-ghost p-1.5 text-xs font-bold text-brand-600"
                      title="Add Room to this Centre"
                      @click="openAddRoomModal(centre.name)"
                    >
                      + Room
                    </button>
                    <button
                      type="button"
                      class="btn-ghost p-1.5 text-xs font-bold text-emerald-600"
                      title="Add Educator to this Centre"
                      @click="openAddTeacherModal(centre.name)"
                    >
                      + Staff
                    </button>
                    <button
                      type="button"
                      class="btn-ghost p-1.5 text-xs"
                      title="Edit Centre Details"
                      @click="openEditCentreModal(centre)"
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      class="btn-ghost p-1.5 text-xs text-rose-600 hover:bg-rose-50"
                      title="Delete Centre"
                      @click="handleDeleteCentre(centre)"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 2: ROOM MANAGEMENT (PER CENTRE) -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'rooms'" class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black text-slate-900 dark:text-slate-100">
            Learning Rooms & Age Cohorts
          </h2>
          <p class="text-xs text-slate-500">
            Rooms are assigned to a Centre and group children by inquiry level and age cohort.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Filter by Centre -->
          <select v-model="filterRoomCentre" class="select text-xs font-semibold">
            <option value="all">All Centres ({{ roomsStore.rooms.length }} rooms)</option>
            <option v-for="c in admin.centreGroups" :key="c" :value="c">
              🏫 {{ c }}
            </option>
          </select>

          <button
            type="button"
            class="btn-primary text-xs flex items-center gap-1.5"
            @click="openAddRoomModal(filterRoomCentre !== 'all' ? filterRoomCentre : undefined)"
          >
            <span>➕</span>
            <span>Add Room</span>
          </button>
        </div>
      </div>

      <!-- Rooms Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="room in filteredRooms"
          :key="room.id"
          class="card p-5 space-y-3 border border-slate-200 dark:border-slate-800 hover:shadow-soft transition"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="space-y-0.5">
              <span class="rounded bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 px-2 py-0.5 text-[10px] font-bold uppercase">
                {{ room.centre_name || 'Hadfield Early Learning Centre' }}
              </span>
              <h3 class="font-display font-extrabold text-base text-slate-900 dark:text-slate-100 pt-1">
                {{ room.name }}
              </h3>
              <p class="text-xs text-slate-500">
                {{ room.description || 'Active early learning environment' }}
              </p>
            </div>

            <div class="flex items-center gap-1">
              <button
                type="button"
                class="btn-ghost p-1.5 text-xs"
                title="Edit room"
                @click="openEditRoomModal(room)"
              >
                ✏️
              </button>
              <button
                type="button"
                class="btn-ghost p-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                title="Delete room"
                @click="handleDeleteRoom(room)"
              >
                🗑️
              </button>
            </div>
          </div>

          <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-500 text-[11px]">Assigned Staff:</span>
              <span class="rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1.5 py-0.2 text-[10px] font-bold">
                {{ admin.teachers.filter(t => t.room === room.name || t.room === 'All Rooms').length }} educators
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 3: TEACHER ACCESS CONTROL -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'teachers'" class="space-y-4">
      <!-- Search and filter toolbar -->
      <div class="card p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div class="flex-1 relative">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search educator by name, email, centre, or role..."
            class="input pl-9 w-full"
          />
          <span class="absolute left-3 top-2.5 text-slate-400">🔍</span>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Centre Group Filter -->
          <select v-model="filterCentre" class="select text-xs font-semibold">
            <option value="all">All Centres ({{ admin.centreGroups.length }})</option>
            <option v-for="centre in admin.centreGroups" :key="centre" :value="centre">
              🏢 {{ centre }}
            </option>
          </select>

          <select v-model="filterRoom" class="select text-xs">
            <option value="all">All Rooms</option>
            <option v-for="room in globalRoomOptions" :key="room" :value="room">{{ room }}</option>
          </select>

          <select v-model="filterStatus" class="select text-xs">
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="invited">Invited</option>
            <option value="suspended">Suspended</option>
          </select>

          <button
            type="button"
            class="btn-primary text-xs flex items-center gap-1.5"
            @click="openAddTeacherModal()"
          >
            <span>➕</span>
            <span>Add Educator</span>
          </button>
        </div>
      </div>

      <!-- Teachers List / Table -->
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-800/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th class="py-3 px-4">Educator / Contact</th>
                <th class="py-3 px-4">Centre Group</th>
                <th class="py-3 px-4">Assigned Room</th>
                <th class="py-3 px-4">Role</th>
                <th class="py-3 px-4">Initial Password</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr
                v-for="teacher in filteredTeachers"
                :key="teacher.id"
                class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
              >
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div class="h-9 w-9 rounded-full bg-brand-600/10 text-brand-700 dark:text-brand-300 font-bold flex items-center justify-center text-sm shrink-0">
                      {{ teacher.name ? teacher.name.charAt(0).toUpperCase() : '?' }}
                    </div>
                    <div>
                      <p class="font-bold text-slate-900 dark:text-slate-100">{{ teacher.name }}</p>
                      <p class="text-xs text-slate-500 font-mono">{{ teacher.email }}</p>
                    </div>
                  </div>
                </td>
                <td class="py-3.5 px-4 font-semibold text-xs text-slate-700 dark:text-slate-300">
                  <span class="rounded bg-brand-50 text-brand-800 dark:bg-brand-950 dark:text-brand-300 px-2 py-0.5">
                    {{ teacher.centre_name || 'Hadfield Early Learning Centre' }}
                  </span>
                </td>
                <td class="py-3.5 px-4 font-semibold text-xs text-slate-700 dark:text-slate-300">
                  {{ teacher.room }}
                </td>
                <td class="py-3.5 px-4">
                  <span
                    class="rounded-full px-2.5 py-0.5 text-xs font-bold"
                    :class="
                      teacher.is_admin || teacher.role === 'System Administrator'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
                    "
                  >
                    {{ teacher.role }}
                  </span>
                </td>
                <td class="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {{ teacher.password || '—' }}
                </td>
                <td class="py-3.5 px-4">
                  <button
                    type="button"
                    class="rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider transition hover:opacity-80 cursor-pointer"
                    :class="
                      teacher.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : teacher.status === 'invited'
                        ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    "
                    title="Click to toggle active / suspended status"
                    @click="handleToggleStatus(teacher, teacher.status === 'active' ? 'suspended' : 'active')"
                  >
                    {{ teacher.status }}
                  </button>
                </td>
                <td class="py-3.5 px-4 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      class="btn-secondary text-[11px] py-1 px-2 font-bold"
                      title="Copy login details to clipboard"
                      @click="copyFullCredentials(teacher)"
                    >
                      📋 Copy
                    </button>
                    <button
                      type="button"
                      class="btn-ghost p-1.5 text-xs"
                      title="Edit teacher"
                      @click="openEditTeacherModal(teacher)"
                    >
                      ✏️
                    </button>
                    <button
                      v-if="!teacher.is_admin && teacher.email !== 'info@pandeykapil.com.np'"
                      type="button"
                      class="btn-ghost p-1.5 text-xs text-rose-600 hover:bg-rose-50"
                      title="Revoke access"
                      @click="handleDeleteTeacher(teacher)"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 4: CURRICULUM TOPICS & MODULE ACCESS STATUS -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'topics'" class="space-y-5">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div
          v-for="topic in admin.topicStatuses"
          :key="topic.id"
          class="card p-5 space-y-4 border transition hover:shadow-soft"
          :class="
            topic.status === 'under_development'
              ? 'border-amber-300 dark:border-amber-700 bg-amber-500/5'
              : topic.status === 'beta'
              ? 'border-violet-300 dark:border-violet-700 bg-violet-500/5'
              : 'border-slate-200 dark:border-slate-800'
          "
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div
                class="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl shadow-soft"
                :class="
                  topic.status === 'under_development'
                    ? 'bg-amber-500 text-white'
                    : topic.status === 'beta'
                    ? 'bg-violet-600 text-white'
                    : 'bg-brand-600 text-white'
                "
              >
                {{ topic.icon }}
              </div>
              <div>
                <h3 class="font-display font-extrabold text-base text-slate-900 dark:text-slate-100">
                  {{ topic.title }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {{ topic.route_path }}
                </p>
              </div>
            </div>

            <span
              class="rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1"
              :class="
                topic.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                  : topic.status === 'under_development'
                  ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                  : 'bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200'
              "
            >
              {{ topic.status.replace('_', ' ') }}
            </span>
          </div>

          <div class="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              class="py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
              :class="topic.status === 'active' ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm' : 'text-slate-600 dark:text-slate-400'"
              @click="handleSetTopicStatus(topic, 'active')"
            >
              🟢 Active
            </button>
            <button
              type="button"
              class="py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
              :class="topic.status === 'under_development' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'"
              @click="handleSetTopicStatus(topic, 'under_development')"
            >
              🚧 WIP
            </button>
            <button
              type="button"
              class="py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
              :class="topic.status === 'beta' ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'"
              @click="handleSetTopicStatus(topic, 'beta')"
            >
              🧪 Beta
            </button>
            <button
              type="button"
              class="py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
              :class="topic.status === 'disabled' ? 'bg-slate-400 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400'"
              @click="handleSetTopicStatus(topic, 'disabled')"
            >
              ⏸️ Pause
            </button>
          </div>

          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Educational Leadership Note
              </label>
              <button
                type="button"
                class="text-xs font-bold text-brand-600 hover:underline disabled:opacity-50"
                :disabled="savingNotes[topic.topic_key]"
                @click="handleSaveTopicNotes(topic)"
              >
                {{ savingNotes[topic.topic_key] ? 'Saving...' : 'Save Note' }}
              </button>
            </div>
            <textarea
              :value="getTopicNotes(topic)"
              rows="2"
              class="textarea text-xs w-full"
              @input="e => onNotesInput(topic.topic_key, (e.target as HTMLTextAreaElement).value)"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 5: SUPABASE CLOUD CONNECTION -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'cloud'" class="space-y-4">
      <SupabaseConnectionCard />
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 6: NQF GOVERNANCE -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'governance'" class="space-y-4">
      <div class="card p-5 space-y-3">
        <h3 class="font-display font-extrabold text-base flex items-center gap-2">
          <span>🏛️</span>
          <span>ACECQA Quality Area 7 Governance</span>
        </h3>
        <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          The service operates under the National Quality Standard QA7. Super Administrator manages multiple centres with pure separation of duties.
        </p>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- RESPONSIVE MODAL: ADD / EDIT TEACHER (STICKY FOOTER FIX) -->
    <!-- ===================================================================== -->
    <div
      v-if="showTeacherModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-hidden"
      @click.self="showTeacherModal = false"
    >
      <div class="card max-w-xl w-full max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-lift border border-slate-200 dark:border-slate-800">
        <!-- Sticky Header -->
        <div class="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ editingTeacherId ? '✏️' : '➕' }}</span>
            <h3 class="font-display font-black text-lg">
              {{ editingTeacherId ? 'Edit Educator Access' : 'Grant New Teacher Login Email' }}
            </h3>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
            @click="showTeacherModal = false"
          >
            ✕
          </button>
        </div>

        <!-- Scrollable Form Body -->
        <form id="teacher-form" class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4" @submit.prevent="handleSaveTeacher">
          <!-- Centre Group Name -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Centre Group Name *
              </label>
              <button
                type="button"
                class="text-xs font-bold text-brand-600 hover:underline flex items-center gap-1"
                @click="openAddCentreModal"
              >
                <span>➕</span>
                <span>New Centre</span>
              </button>
            </div>
            <select v-model="teacherForm.centre_name" class="select w-full" required>
              <option v-for="c in admin.centreGroups" :key="c" :value="c">{{ c }}</option>
            </select>
            <p class="text-[11px] text-slate-500">
              Data isolation scope: Educator can only see documents in this Centre.
            </p>
          </div>

          <!-- Educator Full Name -->
          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Educator Full Name *
            </label>
            <input
              v-model="teacherForm.name"
              type="text"
              required
              placeholder="e.g. Sanoj"
              class="input w-full"
            />
          </div>

          <!-- Email -->
          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Teacher Email Address *
            </label>
            <input
              v-model="teacherForm.email"
              type="email"
              required
              placeholder="e.g. Sanoj@gmail.com"
              class="input w-full"
            />
            <p class="text-[11px] text-slate-500">
              Authorized login email. Public self-signup is disabled.
            </p>
          </div>

          <!-- Password -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Assigned Login Password *
              </label>
              <span class="text-[11px] text-slate-400 font-mono">Master-assigned</span>
            </div>
            <input
              v-model="teacherForm.password"
              type="text"
              required
              placeholder="e.g. Educator2026!"
              class="input w-full font-mono text-sm"
            />
          </div>

          <!-- Role & Room Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Staff Role
              </label>
              <select v-model="teacherForm.role" class="select w-full">
                <option v-for="r in ROLES" :key="r" :value="r">{{ r }}</option>
              </select>
            </div>

            <div class="space-y-1">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Assigned Room
                </label>
                <button
                  type="button"
                  class="text-[11px] font-bold text-brand-600 hover:underline"
                  @click="openAddRoomModal(teacherForm.centre_name)"
                >
                  + Add Room
                </button>
              </div>
              <select v-model="teacherForm.room" class="select w-full">
                <option v-for="rm in teacherFormRoomOptions" :key="rm" :value="rm">{{ rm }}</option>
              </select>
            </div>
          </div>

          <!-- Status -->
          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Access Status
            </label>
            <select v-model="teacherForm.status" class="select w-full">
              <option value="active">Active (Immediate platform access)</option>
              <option value="invited">Invited (Awaiting first login)</option>
              <option value="suspended">Suspended (Access blocked)</option>
            </select>
          </div>

          <!-- Notes -->
          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Leadership Notes / Certifications (Optional)
            </label>
            <textarea
              v-model="teacherForm.notes"
              rows="2"
              placeholder="e.g. Master of Teaching, WWCC verified, First Aid current."
              class="textarea text-xs w-full"
            />
          </div>
        </form>

        <!-- Sticky Fixed Footer: Save and Cancel ALWAYS Accessible -->
        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            class="btn-ghost text-xs"
            @click="showTeacherModal = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="teacher-form"
            class="btn-primary text-xs flex items-center gap-2 font-bold px-5"
            :disabled="teacherFormSubmitting"
          >
            <span>{{ editingTeacherId ? 'Save Changes' : 'Grant Login Access' }}</span>
            <span v-if="teacherFormSubmitting">⏳</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- RESPONSIVE MODAL: ADD / EDIT CENTRE -->
    <!-- ===================================================================== -->
    <div
      v-if="showCentreModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-hidden"
      @click.self="showCentreModal = false"
    >
      <div class="card max-w-lg w-full max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-lift border border-slate-200 dark:border-slate-800">
        <div class="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏫</span>
            <h3 class="font-display font-black text-lg">
              {{ editingCentreId ? 'Edit Centre Details' : 'Register New Centre / School' }}
            </h3>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
            @click="showCentreModal = false"
          >
            ✕
          </button>
        </div>

        <form id="centre-form" class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4" @submit.prevent="handleSaveCentre">
          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Centre Name *
            </label>
            <input
              v-model="centreForm.name"
              type="text"
              required
              placeholder="e.g. South St Early Learning Centre"
              class="input w-full"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Centre Code
              </label>
              <input
                v-model="centreForm.code"
                type="text"
                placeholder="e.g. SSELC"
                class="input w-full"
              />
            </div>
            <div class="space-y-1">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Phone Number
              </label>
              <input
                v-model="centreForm.phone"
                type="tel"
                placeholder="e.g. 03 9123 4567"
                class="input w-full"
              />
            </div>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Address / Suburb
            </label>
            <input
              v-model="centreForm.address"
              type="text"
              placeholder="e.g. 120 South Street, Hadfield VIC 3046"
              class="input w-full"
            />
          </div>

          <div v-if="!editingCentreId" class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Initial Learning Rooms (Comma separated)
            </label>
            <input
              v-model="centreForm.initial_rooms"
              type="text"
              placeholder="e.g. Nursery, Toddlers, Kindergarten"
              class="input w-full"
            />
            <p class="text-[11px] text-slate-500">
              These rooms will automatically be created and linked to this Centre.
            </p>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Notes / Governance Summary
            </label>
            <textarea
              v-model="centreForm.notes"
              rows="2"
              placeholder="e.g. Approved provider, service licence number, or leadership details."
              class="textarea text-xs w-full"
            />
          </div>
        </form>

        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            class="btn-ghost text-xs"
            @click="showCentreModal = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="centre-form"
            class="btn-primary text-xs flex items-center gap-2 font-bold px-5"
            :disabled="centreFormSubmitting"
          >
            <span>{{ editingCentreId ? 'Save Changes' : 'Create Centre' }}</span>
            <span v-if="centreFormSubmitting">⏳</span>
          </button>
        </div>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- RESPONSIVE MODAL: ADD / EDIT ROOM -->
    <!-- ===================================================================== -->
    <div
      v-if="showRoomModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm overflow-hidden"
      @click.self="showRoomModal = false"
    >
      <div class="card max-w-md w-full max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-lift border border-slate-200 dark:border-slate-800">
        <div class="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div class="flex items-center gap-2">
            <span class="text-xl">🚪</span>
            <h3 class="font-display font-black text-lg">
              {{ editingRoomId ? 'Edit Room' : 'Add Learning Room' }}
            </h3>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-lg"
            @click="showRoomModal = false"
          >
            ✕
          </button>
        </div>

        <form id="room-form" class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4" @submit.prevent="handleSaveRoom">
          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Centre Group *
            </label>
            <select v-model="roomForm.centre_name" class="select w-full" required>
              <option v-for="c in admin.centreGroups" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Room Name *
            </label>
            <input
              v-model="roomForm.name"
              type="text"
              required
              placeholder="e.g. Koalas Room, Nursery, Dandelions"
              class="input w-full"
            />
          </div>

          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Description / Age Cohort
            </label>
            <textarea
              v-model="roomForm.description"
              rows="2"
              placeholder="e.g. 3-year old kindergarten inquiry, infant nursery."
              class="textarea text-xs w-full"
            />
          </div>
        </form>

        <div class="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            class="btn-ghost text-xs"
            @click="showRoomModal = false"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="room-form"
            class="btn-primary text-xs flex items-center gap-2 font-bold px-5"
            :disabled="roomFormSubmitting"
          >
            <span>{{ editingRoomId ? 'Save Room' : 'Create Room' }}</span>
            <span v-if="roomFormSubmitting">⏳</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
