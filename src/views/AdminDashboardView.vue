<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { roomTitle, roomTeam } from '@/data/rooms'
import { useAdminStore } from '@/stores/admin'
import { useAuthStore } from '@/stores/auth'
import { useRoomsStore } from '@/stores/rooms'
import { useUiStore } from '@/stores/ui'
import SupabaseConnectionCard from '@/components/SupabaseConnectionCard.vue'
import { isSupabaseConfiguredRef } from '@/services/supabase'
import type { RoomRecord, TeacherAccess, TeacherAccessStatus, TeacherRole, TopicModuleStatus, TopicStatus } from '@/types'

const admin = useAdminStore()
const auth = useAuthStore()
const roomsStore = useRoomsStore()
const ui = useUiStore()

const activeTab = ref<'teachers' | 'rooms' | 'topics' | 'governance' | 'cloud'>('teachers')

onMounted(async () => {
  await Promise.all([admin.init(), roomsStore.loadRooms()])
})

// ---------------------------------------------------------------------------
// Teacher Search & Filtering
// ---------------------------------------------------------------------------
// Teacher Search & Filtering
// ---------------------------------------------------------------------------
const searchQuery = ref('')
const filterCentre = ref<string>('all')
const filterRoom = ref<string>('all')
const filterStatus = ref<string>('all')

const ROLES: TeacherRole[] = [
  'Centre Director',
  'Educational Leader',
  'Early Childhood Teacher',
  'Room Leader',
  'Educator',
  'Relief Educator',
]

const roomOptions = computed(() => ['All Rooms', ...roomsStore.roomNames])

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
// Add / Edit Teacher Modal State
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

function openAddTeacherModal() {
  editingTeacherId.value = null
  teacherForm.email = ''
  teacherForm.name = ''
  teacherForm.centre_name = auth.centreName || 'Hadfield Early Learning Centre'
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

function copyInviteLink(email: string) {
  const url = `${window.location.origin}/login?email=${encodeURIComponent(email)}`
  navigator.clipboard.writeText(url)
  ui.showToast(`Login link copied for ${email}`, 'success')
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
// Dynamic Room Management State & Actions
// ---------------------------------------------------------------------------
const showRoomModal = ref(false)
const editingRoomId = ref<string | null>(null)
const roomFormSubmitting = ref(false)

const roomForm = reactive({
  name: '',
  description: '',
})

function openAddRoomModal() {
  editingRoomId.value = null
  roomForm.name = ''
  roomForm.description = ''
  showRoomModal.value = true
}

function openEditRoomModal(room: RoomRecord) {
  editingRoomId.value = room.id
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
        name: roomForm.name,
        description: roomForm.description,
      })
      ui.showToast(`Room updated to "${roomForm.name}".`, 'success')
    } else {
      await roomsStore.addRoom(roomForm.name, roomForm.description)
      ui.showToast(`Room "${roomForm.name}" created.`, 'success')
    }
    showRoomModal.value = false
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    roomFormSubmitting.value = false
  }
}

async function handleDeleteRoom(room: RoomRecord) {
  if (roomsStore.rooms.length <= 1) {
    ui.showToast('You must keep at least one room in the service.', 'error')
    return
  }
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
              Service Leadership & Administration
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
            Hadfield ELC — Admin Dashboard
          </h1>
          <p class="mt-1 text-sm text-slate-300 max-w-2xl leading-relaxed">
            Logged in as <span class="text-white font-bold">{{ auth.displayName }}</span>. Authorize teacher login emails, configure early learning rooms, and set pedagogical modules to
            <span class="text-amber-300 font-bold underline">Under Development</span> with live guidance notes.
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <button
            type="button"
            class="btn bg-brand-600 hover:bg-brand-500 text-white font-bold shadow-soft flex items-center gap-1.5"
            @click="openAddTeacherModal"
          >
            <span>➕</span>
            <span>Grant Teacher Email</span>
          </button>
          <button
            type="button"
            class="btn bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5"
            @click="openAddRoomModal"
          >
            <span>🏫</span>
            <span>Add Room</span>
          </button>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Authorized Teachers</p>
          <p class="mt-1 text-2xl font-black text-white">{{ admin.teachers.length }}</p>
          <p class="text-xs text-slate-400">Master-registered staff</p>
        </div>

        <div class="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-brand-400">Centre Groups</p>
          <p class="mt-1 text-2xl font-black text-brand-300">{{ admin.centreGroups.length }}</p>
          <p class="text-xs text-slate-400">Isolated centre scopes</p>
        </div>

        <div class="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Learning Rooms</p>
          <p class="mt-1 text-2xl font-black text-emerald-300">{{ roomsStore.rooms.length }}</p>
          <p class="text-xs text-slate-400">Active rooms</p>
        </div>

        <div class="rounded-2xl bg-white/5 border border-white/10 p-3 sm:p-4">
          <p class="text-[11px] font-bold uppercase tracking-wider text-amber-400">Under Development</p>
          <p class="mt-1 text-2xl font-black text-amber-300">{{ admin.underDevTopics.length }}</p>
          <p class="text-xs text-slate-400">Modules marked WIP</p>
        </div>
      </div>
    </header>

    <!-- Navigation Tabs -->
    <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
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
        <span>👥</span>
        <span>Teacher Access Control ({{ admin.teachers.length }})</span>
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
        <span>🏫</span>
        <span>Rooms ({{ roomsStore.rooms.length }})</span>
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
        <span>Module Status ({{ admin.topicStatuses.length }})</span>
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
        <span>Supabase Cloud & Sync</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-extrabold"
          :class="isSupabaseConfiguredRef ? 'bg-emerald-500/20 text-emerald-400 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-500 dark:text-amber-300'"
        >
          {{ isSupabaseConfiguredRef ? 'Connected' : 'Offline' }}
        </span>
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
    <!-- TAB 1: TEACHER ACCESS CONTROL -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'teachers'" class="space-y-4">
      <!-- Master Policy Banner -->
      <div class="p-4 rounded-2xl bg-brand-500/10 border border-brand-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div class="flex items-start gap-2.5">
          <span class="text-xl shrink-0">🛡️</span>
          <div class="space-y-0.5">
            <p class="font-bold text-slate-900 dark:text-slate-100 text-sm">
              Master Access & Centre Group Isolation
            </p>
            <p class="text-slate-600 dark:text-slate-300 leading-relaxed">
              Public self-signup is disabled. Only Master Director <strong class="text-brand-600 dark:text-brand-400">Kapil Pandey</strong> can register educators into a Centre Group.
              Educators in each group can only view documentation within their assigned Centre. Within their group, educators can edit and compile together with AI, while deletions are strictly protected.
            </p>
          </div>
        </div>
      </div>

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
            <option v-for="room in roomOptions" :key="room" :value="room">{{ room }}</option>
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
            @click="openAddTeacherModal"
          >
            <span>➕</span>
            <span>Add Educator to Group</span>
          </button>
        </div>
      </div>

      <!-- Teachers List / Table -->
      <div class="card overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
              <tr>
                <th class="py-3.5 px-4">Educator / Email</th>
                <th class="py-3.5 px-4">Centre Group</th>
                <th class="py-3.5 px-4">Role</th>
                <th class="py-3.5 px-4">Room</th>
                <th class="py-3.5 px-4">Password</th>
                <th class="py-3.5 px-4">Status</th>
                <th class="py-3.5 px-4">Admin Privileges</th>
                <th class="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800/80">
              <tr
                v-for="t in filteredTeachers"
                :key="t.id"
                class="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition"
              >
                <!-- Name & Email -->
                <td class="py-3.5 px-4">
                  <div class="flex items-center gap-3">
                    <div
                      class="grid h-10 w-10 shrink-0 place-items-center rounded-xl font-bold text-white shadow-soft"
                      :class="
                        t.role === 'Centre Director' || t.is_admin
                          ? 'bg-rose-600'
                          : t.role === 'Educational Leader'
                          ? 'bg-brand-600'
                          : t.role === 'Early Childhood Teacher'
                          ? 'bg-indigo-600'
                          : 'bg-emerald-600'
                      "
                    >
                      {{ t.name.charAt(0).toUpperCase() }}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <p class="font-bold text-slate-900 dark:text-slate-100 truncate">
                          {{ t.name }}
                        </p>
                        <span
                          v-if="t.is_admin || t.role === 'Centre Director'"
                          class="rounded bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 text-[9px] font-black uppercase px-1 py-0.2"
                        >
                          Admin
                        </span>
                      </div>
                      <div class="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <span class="truncate">{{ t.email }}</span>
                        <button
                          type="button"
                          class="hover:text-brand-600 dark:hover:text-brand-400"
                          title="Copy login link"
                          @click="copyInviteLink(t.email)"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                  </div>
                </td>

                <!-- Centre Group -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span class="inline-flex items-center gap-1 rounded-lg bg-brand-50 dark:bg-brand-950/60 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 px-2.5 py-1 text-xs font-bold">
                    <span>🏢</span>
                    <span>{{ t.centre_name || 'Hadfield Early Learning Centre' }}</span>
                  </span>
                </td>

                <!-- Role -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span
                    class="rounded-lg px-2.5 py-1 text-xs font-bold"
                    :class="
                      t.role === 'Centre Director'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : t.role === 'Educational Leader'
                        ? 'bg-brand-100 text-brand-800 dark:bg-brand-950/60 dark:text-brand-300'
                        : t.role === 'Early Childhood Teacher'
                        ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300'
                        : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                    "
                  >
                    {{ t.role }}
                  </span>
                </td>

                <!-- Room Assignment -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span class="rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">
                    {{ t.room }}
                  </span>
                </td>

                <!-- Password -->
                <td class="py-3.5 px-4 whitespace-nowrap font-mono text-xs">
                  <span class="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {{ t.password || 'Educator2026!' }}
                  </span>
                </td>

                <!-- Status -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <div class="flex items-center gap-1.5">
                    <span
                      class="h-2 w-2 rounded-full"
                      :class="
                        t.status === 'active'
                          ? 'bg-emerald-500 ring-2 ring-emerald-200'
                          : t.status === 'invited'
                          ? 'bg-amber-500 ring-2 ring-amber-200'
                          : 'bg-slate-400'
                      "
                    />
                    <span
                      class="text-xs font-bold uppercase tracking-wider"
                      :class="
                        t.status === 'active'
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : t.status === 'invited'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-slate-500'
                      "
                    >
                      {{ t.status }}
                    </span>
                  </div>
                </td>

                <!-- Admin Status -->
                <td class="py-3.5 px-4 whitespace-nowrap">
                  <span
                    v-if="t.is_admin || t.role === 'Centre Director'"
                    class="inline-flex items-center gap-1 text-xs font-bold text-rose-600 dark:text-rose-400"
                  >
                    <span>🛡️</span>
                    <span>Admin Access</span>
                  </span>
                  <span v-else class="text-xs text-slate-400">
                    Educator Access
                  </span>
                </td>

                <!-- Actions -->
                <td class="py-3.5 px-4 text-right whitespace-nowrap">
                  <div class="flex items-center justify-end gap-1">
                    <button
                      v-if="t.status !== 'active'"
                      type="button"
                      class="btn-ghost p-1.5 text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      title="Activate educator"
                      @click="handleToggleStatus(t, 'active')"
                    >
                      ✅ Activate
                    </button>
                    <button
                      v-if="t.status === 'active'"
                      type="button"
                      class="btn-ghost p-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Suspend access"
                      @click="handleToggleStatus(t, 'suspended')"
                    >
                      ⏸️ Suspend
                    </button>

                    <button
                      type="button"
                      class="btn-ghost p-1.5 text-xs text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/50"
                      title="Copy full educator login credentials"
                      @click="copyFullCredentials(t)"
                    >
                      📋 Copy Login
                    </button>

                    <button
                      type="button"
                      class="btn-ghost p-1.5 text-xs"
                      title="Edit teacher details"
                      @click="openEditTeacherModal(t)"
                    >
                      ✏️
                    </button>

                    <button
                      type="button"
                      class="btn-ghost p-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      title="Revoke access"
                      @click="handleDeleteTeacher(t)"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>

              <tr v-if="filteredTeachers.length === 0">
                <td colspan="6" class="py-12 text-center text-slate-500">
                  <p class="text-3xl mb-2">🔍</p>
                  <p class="font-bold text-slate-800 dark:text-slate-200">No teachers found</p>
                  <p class="text-xs mt-1">Try refining your search query or room filter.</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 2: DYNAMIC ROOM MANAGEMENT -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'rooms'" class="space-y-4">
      <div class="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-brand-200 dark:border-brand-900 bg-brand-50/40 dark:bg-brand-950/20">
        <div>
          <h2 class="font-display font-extrabold text-base text-slate-900 dark:text-slate-100">
            Early Learning Rooms Management
          </h2>
          <p class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Create and edit room names. Any changes made here dynamically populate throughout the entire service: Weekly Wrap-Ups, Program Book, Learning Stories, and teacher assignments.
          </p>
        </div>

        <button
          type="button"
          class="btn-primary flex items-center gap-1.5 text-xs font-bold shrink-0 self-start sm:self-auto"
          @click="openAddRoomModal"
        >
          <span>➕</span>
          <span>Add New Room</span>
        </button>
      </div>

      <!-- Rooms Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="room in roomsStore.rooms"
          :key="room.id"
          class="card p-5 space-y-3 border border-slate-200 dark:border-slate-800 hover:shadow-soft transition"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-3">
              <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 text-lg font-bold">
                🏫
              </div>
              <div>
                <h3 class="font-display font-extrabold text-base text-slate-900 dark:text-slate-100">
                  {{ room.name }}
                </h3>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ room.description || 'Active early learning environment' }}
                </p>
              </div>
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

          <!-- Room Badges & Previews -->
          <div class="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between">
              <span class="text-slate-500 text-[11px]">Wrap-Up Signature:</span>
              <span class="font-bold text-slate-700 dark:text-slate-200">{{ roomTeam(room.name) }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 text-[11px]">Newsletter Title:</span>
              <span class="font-bold text-slate-700 dark:text-slate-200">{{ roomTitle(room.name) }}</span>
            </div>
            <div class="flex items-center justify-between pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <span class="text-slate-500 text-[11px]">Assigned Staff:</span>
              <span class="rounded bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-300 px-1.5 py-0.2 text-[10px] font-bold">
                {{ admin.teachers.filter(t => t.room === room.name || t.room === 'All Rooms').length }} educators
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 3: TOPIC & MODULE STATUS MANAGEMENT -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'topics'" class="space-y-5">
      <!-- Leadership guidance banner -->
      <div class="card bg-amber-500/10 border-amber-300 dark:border-amber-700/60 p-4 sm:p-5 flex items-start gap-4">
        <div class="text-3xl">🚧</div>
        <div class="space-y-1">
          <h2 class="font-display font-extrabold text-amber-950 dark:text-amber-200 text-base">
            Pedagogical Module Development Control
          </h2>
          <p class="text-xs sm:text-sm text-amber-900/90 dark:text-amber-200/90 leading-relaxed">
            When you switch a module status to <strong>Under Development</strong>, the app instantly displays a
            <span class="rounded bg-amber-200/80 dark:bg-amber-900/60 px-1.5 py-0.5 font-bold">🚧 WIP</span>
            chip in the navigation sidebar, and presents your leadership notes as an advisory banner directly to teachers on that screen.
          </p>
        </div>
      </div>

      <!-- Modules Grid -->
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
          <!-- Card Header -->
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
                <div class="flex items-center gap-2">
                  <h3 class="font-display font-extrabold text-base text-slate-900 dark:text-slate-100">
                    {{ topic.title }}
                  </h3>
                  <RouterLink
                    :to="topic.route_path"
                    class="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:underline"
                    target="_blank"
                    title="Open view in new tab"
                  >
                    View ↗
                  </RouterLink>
                </div>
                <p class="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  Route: {{ topic.route_path }}
                </p>
              </div>
            </div>

            <!-- Current status badge -->
            <div>
              <span
                class="rounded-full px-2.5 py-1 text-xs font-black uppercase tracking-wider inline-flex items-center gap-1"
                :class="
                  topic.status === 'active'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : topic.status === 'under_development'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200'
                    : topic.status === 'beta'
                    ? 'bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200'
                    : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                "
              >
                <span v-if="topic.status === 'active'">🟢 Active</span>
                <span v-else-if="topic.status === 'under_development'">🚧 Under Dev</span>
                <span v-else-if="topic.status === 'beta'">🧪 Beta</span>
                <span v-else>⏸️ Disabled</span>
              </span>
            </div>
          </div>

          <!-- Status Switcher Pill Bar -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Module Access Status
            </label>
            <div class="grid grid-cols-4 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
              <button
                type="button"
                class="py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                :class="
                  topic.status === 'active'
                    ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                "
                @click="handleSetTopicStatus(topic, 'active')"
              >
                <span>🟢</span>
                <span>Active</span>
              </button>

              <button
                type="button"
                class="py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                :class="
                  topic.status === 'under_development'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                "
                @click="handleSetTopicStatus(topic, 'under_development')"
              >
                <span>🚧</span>
                <span>Under Dev</span>
              </button>

              <button
                type="button"
                class="py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                :class="
                  topic.status === 'beta'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                "
                @click="handleSetTopicStatus(topic, 'beta')"
              >
                <span>🧪</span>
                <span>Beta</span>
              </button>

              <button
                type="button"
                class="py-1.5 px-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1"
                :class="
                  topic.status === 'disabled'
                    ? 'bg-slate-400 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                "
                @click="handleSetTopicStatus(topic, 'disabled')"
              >
                <span>⏸️</span>
                <span>Pause</span>
              </button>
            </div>
          </div>

          <!-- Leadership Notes / Instructions to Educators -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Educational Leadership Note (Shown to Teachers)
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
              class="textarea text-xs w-full leading-relaxed"
              placeholder="e.g. Currently reviewing with educational leader. Focus on EYLF V2.0 sub-outcome 4.2."
              @input="e => onNotesInput(topic.topic_key, (e.target as HTMLTextAreaElement).value)"
            />
          </div>

          <!-- Preview chip for educators -->
          <div
            v-if="topic.status === 'under_development'"
            class="rounded-xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1"
          >
            <div class="flex items-center gap-1.5 font-bold">
              <span>👁️ Teacher Preview Banner:</span>
            </div>
            <p class="italic text-[11px] opacity-90">
              "{{ getTopicNotes(topic) || 'This module is currently under active development.' }}"
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 4: NQF GOVERNANCE & CENTRE DETAILS -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'governance'" class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Quality Area 7 Oversight -->
        <div class="card p-5 space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🏛️</span>
            <div>
              <h3 class="font-display font-extrabold text-base">Quality Area 7 — Governance & Leadership</h3>
              <p class="text-xs text-slate-500">ACECQA National Quality Standard compliance</p>
            </div>
          </div>
          <ul class="space-y-2 text-xs text-slate-600 dark:text-slate-300">
            <li class="flex items-start gap-2">
              <span class="text-emerald-500">✓</span>
              <span><strong>Standard 7.1:</strong> Governance arrangements facilitate effective operation (educator credentials & email auth).</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-emerald-500">✓</span>
              <span><strong>Standard 7.2:</strong> Educational leadership establishes a culture of continuous reflection and pedagogical enquiry.</span>
            </li>
            <li class="flex items-start gap-2">
              <span class="text-emerald-500">✓</span>
              <span><strong>Quality Improvement Plan (QIP):</strong> Under development module notes align with our centre goals for 2026.</span>
            </li>
          </ul>
        </div>

        <!-- Room Allocation Matrix -->
        <div class="card p-5 space-y-3">
          <div class="flex items-center gap-2">
            <span class="text-2xl">🏫</span>
            <div>
              <h3 class="font-display font-extrabold text-base">Room Allocation Overview</h3>
              <p class="text-xs text-slate-500">Staff distribution across rooms</p>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2 text-xs">
            <div
              v-for="room in roomsStore.roomNames"
              :key="room"
              class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between"
            >
              <span class="font-semibold">{{ room }}</span>
              <span class="rounded-full bg-brand-100 dark:bg-brand-950 text-brand-800 dark:text-brand-300 font-bold px-2 py-0.5 text-[10px]">
                {{ admin.teachers.filter(t => t.room === room || t.room === 'All Rooms').length }} staff
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===================================================================== -->
    <!-- TAB 5: SUPABASE CLOUD & SYNC -->
    <!-- ===================================================================== -->
    <section v-if="activeTab === 'cloud'" class="space-y-4">
      <SupabaseConnectionCard />
    </section>

    <!-- ===================================================================== -->
    <!-- ADD / EDIT TEACHER MODAL -->
    <!-- ===================================================================== -->
    <div
      v-if="showTeacherModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      @click.self="showTeacherModal = false"
    >
      <div class="card max-w-lg w-full p-6 space-y-5 bg-white dark:bg-slate-900 shadow-lift">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">{{ editingTeacherId ? '✏️' : '➕' }}</span>
            <h3 class="font-display font-black text-lg">
              {{ editingTeacherId ? 'Edit Educator Access' : 'Grant New Teacher Login Email' }}
            </h3>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="showTeacherModal = false"
          >
            ✕
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSaveTeacher">
          <!-- Centre Group Name -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Centre Group Name *
              </label>
              <span class="text-[11px] font-semibold text-brand-600 dark:text-brand-400">
                Data Isolation Scope
              </span>
            </div>
            <input
              v-model="teacherForm.centre_name"
              type="text"
              required
              list="admin-centre-groups-list"
              placeholder="e.g. Hadfield Early Learning Centre"
              class="input w-full"
            />
            <datalist id="admin-centre-groups-list">
              <option v-for="g in admin.centreGroups" :key="g" :value="g" />
            </datalist>
            <p class="text-[11px] text-slate-500">
              Only educators within this Centre Group will have access to its inquiry projects, stories, and wrap-ups.
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
              placeholder="e.g. Lakshmi"
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
              placeholder="e.g. lakshmi@hadfield.edu.au"
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
            <p class="text-[11px] text-slate-500">
              The educator will enter this password when logging into their account.
            </p>
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
              <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Assigned Room
              </label>
              <select v-model="teacherForm.room" class="select w-full">
                <option v-for="rm in roomOptions" :key="rm" :value="rm">{{ rm }}</option>
              </select>
            </div>
          </div>

          <!-- Admin Privileges Checkbox -->
          <label class="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 cursor-pointer">
            <input
              v-model="teacherForm.is_admin"
              type="checkbox"
              class="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            <div class="space-y-0.5">
              <p class="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Grant Administrator Privileges</span>
              </p>
              <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                Allows this educator to access the Admin Dashboard, authorize emails, and manage rooms.
              </p>
            </div>
          </label>

          <!-- Initial Status -->
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
              placeholder="e.g. Master of Teaching (Early Childhood), WWCC verified, First Aid current."
              class="textarea text-xs w-full"
            />
          </div>

          <!-- Modal Actions -->
          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="btn-ghost"
              @click="showTeacherModal = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-primary flex items-center gap-2"
              :disabled="teacherFormSubmitting"
            >
              <span>{{ editingTeacherId ? 'Save Changes' : 'Grant Login Access' }}</span>
              <span v-if="teacherFormSubmitting">⏳</span>
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- ADD / EDIT ROOM MODAL -->
    <!-- ===================================================================== -->
    <div
      v-if="showRoomModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
      @click.self="showRoomModal = false"
    >
      <div class="card max-w-md w-full p-6 space-y-5 bg-white dark:bg-slate-900 shadow-lift">
        <div class="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div class="flex items-center gap-2">
            <span class="text-xl">🏫</span>
            <h3 class="font-display font-black text-lg">
              {{ editingRoomId ? 'Edit Room' : 'Add Early Learning Room' }}
            </h3>
          </div>
          <button
            type="button"
            class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            @click="showRoomModal = false"
          >
            ✕
          </button>
        </div>

        <form class="space-y-4" @submit.prevent="handleSaveRoom">
          <div class="space-y-1">
            <label class="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Room Name *
            </label>
            <input
              v-model="roomForm.name"
              type="text"
              required
              placeholder="e.g. Sunflowers Room, Koalas Room"
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
              placeholder="e.g. 3-year old kindergarten, infant nursery, toddler exploration."
              class="textarea text-xs w-full"
            />
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              class="btn-ghost"
              @click="showRoomModal = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn-primary flex items-center gap-2"
              :disabled="roomFormSubmitting"
            >
              <span>{{ editingRoomId ? 'Save Room' : 'Create Room' }}</span>
              <span v-if="roomFormSubmitting">⏳</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
