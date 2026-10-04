<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import EylfOutcomePicker from '@/components/EylfOutcomePicker.vue'
import UnderDevelopmentBanner from '@/components/UnderDevelopmentBanner.vue'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'
import type { EylfOutcomeId } from '@/types'

const projects = useProjectStore()
const ui = useUiStore()
const router = useRouter()

const showForm = ref(false)
const creating = ref(false)
const form = reactive({
  title: '',
  inquiry_question: '',
  age_group: '3-5 years',
  room: '',
  description: '',
  eylf_outcome_ids: [] as EylfOutcomeId[],
})

const AGE_GROUPS = ['0-2 years', '2-3 years', '3-5 years', 'Mixed ages', 'Outside school hours']

async function create() {
  if (!form.title.trim()) return
  creating.value = true
  const created = await projects.createProject({ ...form, title: form.title.trim() })
  creating.value = false
  if (created) {
    ui.showToast('Project created', 'success')
    showForm.value = false
    Object.assign(form, {
      title: '',
      inquiry_question: '',
      age_group: '3-5 years',
      room: '',
      description: '',
      eylf_outcome_ids: [],
    })
    router.push(`/projects/${created.id}`)
  }
}

async function remove(id: string, title: string) {
  if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return
  await projects.deleteProject(id)
  ui.showToast('Project deleted', 'info')
}

onMounted(() => projects.loadProjects())
</script>

<template>
  <div class="space-y-5">
    <UnderDevelopmentBanner topic-key="projects" />

    <div class="flex items-center justify-between gap-3">
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Each project holds a mind map, experiences and EYLF links.
      </p>
      <button class="btn-primary" @click="showForm = !showForm">
        {{ showForm ? '✕ Cancel' : '＋ New project' }}
      </button>
    </div>

    <form v-if="showForm" class="card space-y-4" @submit.prevent="create">
      <div>
        <label class="field-label" for="p-title">Project title *</label>
        <input
          id="p-title"
          v-model="form.title"
          class="input"
          placeholder="e.g. Where does water go?"
          required
        />
      </div>

      <div>
        <label class="field-label" for="p-q">Inquiry question</label>
        <input
          id="p-q"
          v-model="form.inquiry_question"
          class="input"
          placeholder="e.g. What happens to rain when it lands?"
        />
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="field-label" for="p-age">Age group</label>
          <select id="p-age" v-model="form.age_group" class="input">
            <option v-for="age in AGE_GROUPS" :key="age" :value="age">{{ age }}</option>
          </select>
        </div>
        <div>
          <label class="field-label" for="p-room">Room / setting</label>
          <input id="p-room" v-model="form.room" class="input" placeholder="Kinder Room" />
        </div>
      </div>

      <div>
        <label class="field-label" for="p-desc">Notes / provocation</label>
        <textarea
          id="p-desc"
          v-model="form.description"
          class="textarea"
          rows="3"
          placeholder="What sparked this inquiry? What have you noticed?"
        />
      </div>

      <EylfOutcomePicker v-model="form.eylf_outcome_ids" :detailed="false" />

      <button class="btn-primary w-full sm:w-auto" type="submit" :disabled="creating">
        {{ creating ? 'Creating…' : 'Create project' }}
      </button>
    </form>

    <div v-if="projects.loading" class="card text-center text-sm text-slate-500">Loading…</div>

    <div v-else-if="projects.projects.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <article
        v-for="project in projects.projects"
        :key="project.id"
        class="card flex flex-col gap-3"
      >
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-bold">{{ project.title }}</p>
            <p class="text-xs text-slate-400">
              {{ project.age_group || '—' }} · {{ project.room || 'No room' }}
            </p>
          </div>
          <span class="chip shrink-0 bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200">
            {{ project.status }}
          </span>
        </div>

        <p class="line-clamp-3 text-xs text-slate-500 dark:text-slate-400">
          {{ project.inquiry_question || project.description || 'No description yet.' }}
        </p>

        <div v-if="project.eylf_outcome_ids.length" class="flex flex-wrap gap-1">
          <span
            v-for="id in project.eylf_outcome_ids"
            :key="id"
            class="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            O{{ id }}
          </span>
        </div>

        <div class="mt-auto flex gap-2">
          <RouterLink :to="`/projects/${project.id}`" class="btn-primary flex-1 !py-2 text-xs">
            Open workspace
          </RouterLink>
          <button class="btn-ghost !px-3 !py-2 text-xs" @click="remove(project.id, project.title)">
            🗑
          </button>
        </div>
      </article>
    </div>

    <div v-else class="card text-center text-sm text-slate-500 dark:text-slate-400">
      No projects yet — create one to get started.
    </div>
  </div>
</template>