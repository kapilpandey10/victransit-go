<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  readVoiceSettings,
  recorderSupported,
} from '@/services/voice'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useRoomsStore } from '@/stores/rooms'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const ui = useUiStore()
const chat = useChatStore()
const roomsStore = useRoomsStore()

const voice = reactive(readVoiceSettings())

function persistVoice() {
  try {
    localStorage.setItem('hadfield:v1:voice-settings', JSON.stringify(voice))
  } catch {
    /* ignore */
  }
}

const profileForm = reactive({
  full_name: auth.profile?.full_name || auth.displayName || '',
  room: auth.profile?.room || 'All Rooms',
})

// Keep profile form in sync if auth profile updates
watch(
  () => [auth.profile?.full_name, auth.profile?.room],
  ([name, room]) => {
    if (name) profileForm.full_name = name
    if (room) profileForm.room = room
  },
)

const saving = ref(false)
const resettingPassword = ref(false)

// Dynamic room choices for the educator's centre
const availableRooms = computed(() => {
  const centre = auth.centreName || 'Hadfield Early Learning Centre'
  const names = roomsStore.getRoomNamesForCentre(centre)
  return ['All Rooms', ...(names.length > 0 ? names : roomsStore.roomNames)]
})

async function saveProfile() {
  saving.value = true
  try {
    await auth.saveProfile({
      full_name: profileForm.full_name,
      room: profileForm.room,
    })
    ui.showToast('Profile and classroom assignment updated', 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    saving.value = false
  }
}

async function handleSendPasswordReset() {
  if (!auth.userEmail) {
    ui.showToast('No signed-in email found.', 'error')
    return
  }
  resettingPassword.value = true
  try {
    await auth.resetPasswordForEmail(auth.userEmail)
    ui.showToast(`Password reset link sent to ${auth.userEmail}! Check your inbox.`, 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    resettingPassword.value = false
  }
}

function handleClearChat() {
  chat.clear()
  ui.showToast('AI conversation scratchpad cleared', 'info')
}
</script>

<template>
  <div class="space-y-6 max-w-5xl mx-auto pb-12">
    <!-- Header -->
    <div class="border-b border-slate-200/80 dark:border-slate-800 pb-4">
      <h1 class="font-display text-2xl font-black text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
        <span>⚙️</span>
        <span>Educator Preferences</span>
      </h1>
      <p class="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
        Manage your educator profile, classroom room focus, and voice dictation settings.
      </p>
    </div>

    <!-- Main Grid -->
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- 1. Educator Profile -->
      <section class="card space-y-5">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 class="font-display text-base font-extrabold flex items-center gap-2">
              <span>👩‍🏫</span>
              <span>Educator Profile</span>
            </h2>
            <p class="text-xs text-slate-500">Your classroom identity and room focus</p>
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-brand-50 text-brand-700 dark:bg-brand-950/60 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
            {{ auth.userRole }}
          </span>
        </div>

        <div class="space-y-4 text-xs">
          <!-- Full Name -->
          <div>
            <label class="field-label" for="pf-name">Educator Full Name / Preferred Name</label>
            <input
              id="pf-name"
              v-model="profileForm.full_name"
              class="input text-sm font-semibold"
              placeholder="e.g. Jane Smith"
            />
          </div>

          <!-- Email (Read-Only) -->
          <div>
            <label class="field-label">Registered Login Email</label>
            <div class="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono text-xs">
              <span>✉️</span>
              <span class="truncate">{{ auth.userEmail || 'Local Educator Account' }}</span>
              <span class="ml-auto text-[10px] font-bold text-slate-400 uppercase">Authorized</span>
            </div>
          </div>

          <!-- Centre & Role Badges (Managed by Admin) -->
          <div class="grid grid-cols-2 gap-3 pt-1">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
              <span class="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Centre Group</span>
              <p class="font-bold text-slate-800 dark:text-slate-100 text-xs mt-1 truncate" :title="auth.centreName">
                🏫 {{ auth.centreName }}
              </p>
              <span class="text-[10px] text-slate-400 block mt-0.5">Assigned by Director</span>
            </div>

            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
              <span class="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">Role</span>
              <p class="font-bold text-slate-800 dark:text-slate-100 text-xs mt-1 truncate">
                🎓 {{ auth.userRole }}
              </p>
              <span class="text-[10px] text-slate-400 block mt-0.5">Role Permission</span>
            </div>
          </div>

          <!-- Room Selector -->
          <div>
            <label class="field-label" for="pf-room">Current Assigned Learning Room</label>
            <select id="pf-room" v-model="profileForm.room" class="input text-xs font-bold">
              <option v-for="r in availableRooms" :key="r" :value="r">
                {{ r === 'All Rooms' ? '🌐 All Learning Rooms (Centre Wide)' : `🌱 ${r} Room` }}
              </option>
            </select>
            <p class="text-[11px] text-slate-400 mt-1">
              Selecting your room pre-filters learning stories, project workspace, and inquiries.
            </p>
          </div>
        </div>

        <button
          type="button"
          class="btn-primary w-full text-xs font-bold py-2.5 flex items-center justify-center gap-1.5"
          :disabled="saving"
          @click="saveProfile"
        >
          <span>{{ saving ? 'Saving Changes…' : '💾 Save Profile Preferences' }}</span>
        </button>
      </section>

      <!-- 2. Account & Password Reset -->
      <section class="card space-y-5 flex flex-col justify-between">
        <div class="space-y-5">
          <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 class="font-display text-base font-extrabold flex items-center gap-2">
                <span>🔐</span>
                <span>Account & Security</span>
              </h2>
              <p class="text-xs text-slate-500">Manage your password and sign-in status</p>
            </div>
            <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              Active
            </span>
          </div>

          <!-- Password Reset Card -->
          <div class="p-4 rounded-2xl border border-brand-500/25 bg-brand-50/60 dark:bg-brand-950/30 space-y-3">
            <div class="flex items-center gap-2">
              <span class="text-lg">🔑</span>
              <div>
                <p class="font-bold text-slate-900 dark:text-slate-100 text-xs">Password Reset</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">
                  Reset your password safely via a secure link sent directly to your registered email.
                </p>
              </div>
            </div>

            <button
              type="button"
              class="btn-secondary text-xs w-full font-bold flex items-center justify-center gap-1.5 py-2.5 shadow-sm"
              :disabled="resettingPassword"
              @click="handleSendPasswordReset"
            >
              <span>✉️</span>
              <span>{{ resettingPassword ? 'Sending Password Reset Link…' : 'Send Password Reset Email' }}</span>
            </button>
          </div>

          <!-- Privacy Guarantee for Educators -->
          <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 space-y-1.5 text-xs">
            <p class="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-[11px]">
              <span>🛡️</span>
              <span>Centre Scope & Data Privacy</span>
            </p>
            <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
              Your inquiry projects, observations, and learning stories are securely grouped under <strong>{{ auth.centreName }}</strong>. Educators within your centre can collaborate while maintaining complete data separation from other centres.
            </p>
          </div>
        </div>

        <!-- Sign Out Action -->
        <div class="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <span class="text-[11px] text-slate-400">Need to switch accounts?</span>
          <button
            type="button"
            class="btn-ghost text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
            @click="auth.signOut()"
          >
            <span>🚪</span>
            <span>Sign Out</span>
          </button>
        </div>
      </section>

      <!-- 3. Voice & Observation Tools -->
      <section class="card space-y-4">
        <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 class="font-display text-base font-extrabold flex items-center gap-2">
            <span>🎙️</span>
            <span>Hands-Free Voice Dictation</span>
          </h2>
          <p class="text-xs text-slate-500">Record classroom observations and learning reflections hands-free</p>
        </div>

        <div class="space-y-3">
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700/80 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
            <input
              v-model="voice.source"
              type="radio"
              value="groq-whisper"
              class="mt-1"
              @change="persistVoice()"
            />
            <div class="text-xs">
              <span class="block font-bold text-slate-900 dark:text-slate-100">✍️ High-Quality Audio Dictation (Whisper)</span>
              <span class="text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                Hold-to-record on iPad or computer. Automatically transcribes your classroom speech with accurate early childhood terminology and punctuation.
                {{ recorderSupported ? '' : '⚠️ Audio recording is not supported in this browser version.' }}
              </span>
            </div>
          </label>

          <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-700/80 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
            <input
              v-model="voice.source"
              type="radio"
              value="browser"
              class="mt-1"
              @change="persistVoice()"
            />
            <div class="text-xs">
              <span class="block font-bold text-slate-900 dark:text-slate-100">🎤 Browser Speech Recognition</span>
              <span class="text-slate-500 dark:text-slate-400 block mt-0.5 leading-relaxed">
                Uses standard on-device browser speech recognition without sending audio to the cloud.
              </span>
            </div>
          </label>
        </div>
      </section>

      <!-- 4. Device Experience & AI Scratchpad -->
      <section class="card space-y-4">
        <div class="border-b border-slate-100 dark:border-slate-800 pb-3">
          <h2 class="font-display text-base font-extrabold flex items-center gap-2">
            <span>📲</span>
            <span>Display & Tablet Experience</span>
          </h2>
          <p class="text-xs text-slate-500">Theme mode, iPad installation, and assistant scratchpad</p>
        </div>

        <div class="space-y-3 text-xs">
          <!-- Theme Toggle -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
            <div>
              <p class="font-bold text-slate-800 dark:text-slate-100">Visual Theme</p>
              <p class="text-[11px] text-slate-400">Switch between light and dark modes</p>
            </div>
            <button
              type="button"
              class="btn-secondary text-xs font-bold py-1.5 px-3 flex items-center gap-1.5"
              @click="ui.toggleTheme()"
            >
              <span>{{ ui.isDark ? '☀️ Light' : '🌙 Dark' }}</span>
            </button>
          </div>

          <!-- Install App -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
            <div class="pr-2">
              <p class="font-bold text-slate-800 dark:text-slate-100">Classroom Tablet App</p>
              <p class="text-[11px] text-slate-400">Install for full-screen offline-ready classroom use</p>
            </div>
            <button
              v-if="ui.canInstall"
              type="button"
              class="btn-primary text-xs font-bold py-1.5 px-3 shrink-0"
              @click="ui.promptInstall()"
            >
              ⤓ Install
            </button>
            <span v-else class="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
              {{ ui.installed ? 'Installed' : 'Ready' }}
            </span>
          </div>

          <!-- Reset AI Scratchpad -->
          <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/80">
            <div class="pr-2">
              <p class="font-bold text-slate-800 dark:text-slate-100">AI Assistant Scratchpad</p>
              <p class="text-[11px] text-slate-400">Clears current temporary conversation without affecting saved stories</p>
            </div>
            <button
              type="button"
              class="btn-ghost text-xs text-slate-600 hover:text-slate-900 dark:text-slate-300 font-bold py-1.5 px-3 shrink-0 border border-slate-200 dark:border-slate-700"
              @click="handleClearChat"
            >
              🧹 Clear Chat
            </button>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
