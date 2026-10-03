<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { PLANNING_CYCLE } from '@/data/eylf'
import { CHAT_STARTERS } from '@/data/prompts'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useContentStore } from '@/stores/content'
import { useProjectStore } from '@/stores/project'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const projects = useProjectStore()
const content = useContentStore()
const chat = useChatStore()
const ui = useUiStore()
const router = useRouter()

const TOOLS = [
  { path: '/projects', icon: '🗺️', title: 'Inquiry mind map', text: 'Brainstorm lines of inquiry and questions.' },
  { path: '/learning-outcomes', icon: '🎯', title: 'Learning outcomes', text: 'Map any activity to EYLF outcomes + theories.' },
  { path: '/learning-stories', icon: '📖', title: 'Learning stories', text: 'Write a warm, EYLF-linked story from your notes.' },
  { path: '/newsletters', icon: '📰', title: 'Newsletter', text: 'Draft a family newsletter from your highlights.' },
  { path: '/program-book', icon: '🔍', title: 'Program analysis', text: 'Critically reflect on your program documentation.' },
  { path: '/theories', icon: '📚', title: 'Theories & Reggio', text: 'Browse theorists and the Reggio Emilia lens.' },
]

const TIPS = [
  'Follow the child: start from a question you have documented, not a theme calendar.',
  'Name the disposition you saw — curiosity, persistence, cooperation — not just the activity.',
  'One strong observation beats five shallow ones.',
  'Ask "what can this child nearly do?" to plan inside their zone of proximal development.',
  'Let the environment do some teaching: light, mirrors, natural materials, open shelves.',
  'Keep documentation visible, and revisit it with the children.',
  'Reference EYLF sub-outcomes explicitly — it makes planning and assessment sharper.',
  'Invite families into the inquiry: their knowledge is a resource, not a nice-to-have.',
]

const todayTip = computed(() => TIPS[new Date().getDate() % TIPS.length])

const stats = computed(() => [
  { label: 'Projects', value: projects.projects.length, icon: '🧩' },
  { label: 'Stories', value: projects.stories.length, icon: '📖' },
  { label: 'Newsletters', value: content.newsletters.length, icon: '📰' },
  { label: 'Analyses', value: content.analyses.length, icon: '🔍' },
])

function askAi(index = 0) {
  ui.toggleChat(true)
  void chat.send(CHAT_STARTERS[index]?.prompt ?? 'Help me plan an inquiry.')
}

onMounted(() => {
  void projects.loadProjects()
  void projects.loadStories()
  void content.loadNewsletters()
  void content.loadAnalyses()
})
</script>

<template>
  <div class="space-y-6">
    <section
      class="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-5 text-white shadow-lift sm:p-7"
    >
      <p class="text-xs font-bold uppercase tracking-wider text-brand-100">
        {{
          new Date().toLocaleDateString('en-AU', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })
        }}
      </p>
      <h2 class="mt-1 font-display text-2xl font-extrabold sm:text-3xl">
        Welcome back, {{ auth.displayName }} 👋
      </h2>
      <p class="mt-2 max-w-2xl text-sm text-brand-50">
        Plan inquiry-based learning, write EYLF-aligned learning stories, reflect on
        your program, and ask the AI assistant — all from one place.
      </p>

      <div class="mt-4 flex flex-wrap gap-2">
        <button
          class="btn bg-white text-brand-800 hover:bg-brand-50"
          @click="ui.toggleChat(true)"
        >
          ✨ Ask the assistant
        </button>
        <RouterLink
          to="/projects"
          class="btn border border-white/40 bg-white/10 text-white hover:bg-white/20"
        >
          🧩 Start a project
        </RouterLink>
        <RouterLink
          to="/learning-stories"
          class="btn border border-white/40 bg-white/10 text-white hover:bg-white/20"
        >
          📖 New learning story
        </RouterLink>
      </div>
    </section>

    <section class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div v-for="s in stats" :key="s.label" class="card text-center">
        <div class="text-2xl">{{ s.icon }}</div>
        <div class="mt-1 font-display text-2xl font-extrabold">{{ s.value }}</div>
        <div class="text-xs font-bold text-slate-500 dark:text-slate-400">
          {{ s.label }}
        </div>
      </div>
    </section>

    <div class="grid gap-5 lg:grid-cols-3">
      <section class="lg:col-span-2">
        <h3 class="mb-3 font-display text-lg font-extrabold">Planning tools</h3>
        <div class="grid gap-3 sm:grid-cols-2">
          <button
            v-for="tool in TOOLS"
            :key="tool.path"
            class="card flex items-start gap-3 text-left transition hover:-translate-y-0.5 hover:shadow-lift"
            @click="router.push(tool.path)"
          >
            <span
              class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl dark:bg-slate-800"
            >
              {{ tool.icon }}
            </span>
            <span class="min-w-0">
              <span class="block text-sm font-bold">{{ tool.title }}</span>
              <span class="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                {{ tool.text }}
              </span>
            </span>
          </button>
        </div>
      </section>

      <section class="space-y-5">
        <div class="card border-brand-200 bg-brand-50 dark:border-brand-900 dark:bg-brand-950/40">
          <p class="text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-300">
            💡 Tip of the day
          </p>
          <p class="mt-2 text-sm font-semibold text-brand-900 dark:text-brand-100">
            {{ todayTip }}
          </p>
        </div>

        <div class="card">
          <h4 class="mb-3 font-display text-sm font-extrabold">The planning cycle</h4>
          <ol class="space-y-2">
            <li
              v-for="(step, i) in PLANNING_CYCLE"
              :key="step.step"
              class="flex gap-3 text-xs"
            >
              <span
                class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-700 text-[11px] font-bold text-white"
              >
                {{ i + 1 }}
              </span>
              <span>
                <span class="block font-bold">{{ step.step }}</span>
                <span class="text-slate-500 dark:text-slate-400">
                  {{ step.description }}
                </span>
              </span>
            </li>
          </ol>
        </div>
      </section>
    </div>

    <section>
      <div class="mb-3 flex items-center justify-between">
        <h3 class="font-display text-lg font-extrabold">Recent inquiry projects</h3>
        <RouterLink
          to="/projects"
          class="text-sm font-bold text-brand-700 underline dark:text-brand-300"
        >
          View all
        </RouterLink>
      </div>

      <div v-if="projects.projects.length" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <RouterLink
          v-for="project in projects.recentProjects"
          :key="project.id"
          :to="`/projects/${project.id}`"
          class="card transition hover:-translate-y-0.5 hover:shadow-lift"
        >
          <div class="flex items-center gap-2">
            <span
              class="chip bg-brand-100 text-brand-800 dark:bg-brand-950 dark:text-brand-200"
            >
              {{ project.status }}
            </span>
            <span v-if="project.age_group" class="text-xs text-slate-400">
              {{ project.age_group }}
            </span>
          </div>
          <p class="mt-2 font-bold">{{ project.title }}</p>
          <p class="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
            {{
              project.inquiry_question ||
              project.description ||
              'No inquiry question yet.'
            }}
          </p>
        </RouterLink>
      </div>

      <div v-else class="card text-center text-sm text-slate-500 dark:text-slate-400">
        No projects yet.
        <RouterLink
          to="/projects"
          class="font-bold text-brand-700 underline dark:text-brand-300"
        >
          Create your first inquiry
        </RouterLink>
      </div>
    </section>

    <section class="card">
      <h3 class="font-display text-sm font-extrabold">Quick asks</h3>
      <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Opens the temporary AI chat with the question ready to send.
      </p>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="(starter, i) in CHAT_STARTERS"
          :key="starter.label"
          class="chip border border-slate-200 bg-white text-slate-700 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          @click="askAi(i)"
        >
          💬 {{ starter.label }}
        </button>
      </div>
    </section>
  </div>
</template>
