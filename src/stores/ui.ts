import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { readLocal, writeLocal } from '@/services/localStore'

const THEME_KEY = 'ui:theme'

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(false)
  const chatOpen = ref(false)
  const theme = ref<'light' | 'dark'>(readLocal<'light' | 'dark'>(THEME_KEY, 'light'))
  const installPrompt = ref<BeforeInstallPromptEvent | null>(null)
  const installed = ref(false)
  const toast = ref<{ message: string; tone: 'info' | 'success' | 'error' } | null>(null)

  const isDark = computed(() => theme.value === 'dark')
  const canInstall = computed(() => Boolean(installPrompt.value))

  function applyTheme() {
    const root = document.documentElement
    root.classList.toggle('dark', theme.value === 'dark')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme.value === 'dark' ? '#0f172a' : '#0f766e')
  }

  watch(theme, value => {
    writeLocal(THEME_KEY, value)
    applyTheme()
  })

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function toggleSidebar(value?: boolean) {
    sidebarOpen.value = value ?? !sidebarOpen.value
  }

  function toggleChat(value?: boolean) {
    chatOpen.value = value ?? !chatOpen.value
  }

  function showToast(message: string, tone: 'info' | 'success' | 'error' = 'info') {
    toast.value = { message, tone }
    window.setTimeout(() => {
      if (toast.value?.message === message) toast.value = null
    }, 4000)
  }

  function captureInstallPrompt(event: BeforeInstallPromptEvent) {
    installPrompt.value = event
  }

  async function promptInstall() {
    const event = installPrompt.value
    if (!event) return false
    await event.prompt()
    const choice = await event.userChoice
    installPrompt.value = null
    return choice.outcome === 'accepted'
  }

  function markInstalled() {
    installed.value = true
    installPrompt.value = null
  }

  /** Called once from main.ts. */
  function init() {
    applyTheme()
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault()
      captureInstallPrompt(e as BeforeInstallPromptEvent)
    })
    window.addEventListener('appinstalled', markInstalled)
    if (window.matchMedia('(display-mode: standalone)').matches) installed.value = true
  }

  return {
    sidebarOpen,
    chatOpen,
    theme,
    isDark,
    toast,
    installPrompt,
    canInstall,
    installed,
    init,
    toggleTheme,
    toggleSidebar,
    toggleChat,
    showToast,
    promptInstall,
    markInstalled,
  }
})

// Augment the DOM lib for the (non-standard) install prompt event.
declare global {
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[]
    readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
    prompt(): Promise<void>
  }
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent
  }
}