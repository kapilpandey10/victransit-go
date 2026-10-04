import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: 'Dashboard', icon: '🏠' },
  },
  {
    path: '/projects',
    name: 'projects',
    component: () => import('@/views/ProjectsView.vue'),
    meta: { title: 'Projects', icon: '🧩' },
  },
  {
    path: '/projects/:id',
    name: 'project-workspace',
    component: () => import('@/views/ProjectWorkspaceView.vue'),
    meta: { title: 'Inquiry workspace', icon: '🗺️' },
  },
  {
    path: '/learning-outcomes',
    name: 'learning-outcomes',
    component: () => import('@/views/LearningOutcomesView.vue'),
    meta: { title: 'Learning outcomes', icon: '🎯' },
  },
  {
    path: '/learning-stories',
    name: 'learning-stories',
    component: () => import('@/views/LearningStoriesView.vue'),
    meta: { title: 'Learning stories', icon: '📖' },
  },
  {
    path: '/weekly-wrap-up',
    name: 'weekly-wrap-up',
    component: () => import('@/views/WeeklyWrapUpView.vue'),
    meta: { title: 'Weekly wrap-up', icon: '🗓️' },
  },
  {
    path: '/newsletters',
    name: 'newsletters',
    component: () => import('@/views/NewsletterView.vue'),
    meta: { title: 'Newsletters', icon: '📰' },
  },
  {
    path: '/program-book',
    name: 'program-book',
    component: () => import('@/views/ProgramBookView.vue'),
    meta: { title: 'Program book analysis', icon: '🔍' },
  },
  {
    path: '/theories',
    name: 'theories',
    component: () => import('@/views/TheoryLibraryView.vue'),
    meta: { title: 'Theories & literature', icon: '📚' },
  },
  {
    path: '/eylf',
    name: 'eylf',
    component: () => import('@/views/EylfView.vue'),
    meta: { title: 'EYLF reference', icon: '🇦🇺' },
  },
  {
    path: '/admin',
    name: 'admin',
    component: () => import('@/views/AdminDashboardView.vue'),
    meta: { title: 'Admin dashboard', icon: '🛡️' },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: 'Settings', icon: '⚙️' },
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/',
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

export const NAV_ITEMS = routes
  .filter(r => r.meta?.title && r.name !== 'project-workspace' && r.path !== '/:pathMatch(.*)*')
  .map(r => ({
    name: r.name as string,
    path: r.path,
    title: r.meta!.title as string,
    icon: r.meta!.icon as string,
  }))

export default router