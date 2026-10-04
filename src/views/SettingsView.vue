<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { AI_MODELS } from '@/services/ai'
import { listLocalKeys, removeLocal } from '@/services/localStore'
import {
  DEFAULT_VOICE_SETTINGS,
  loadPuter,
  readVoiceSettings,
  recorderSupported,
} from '@/services/voice'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import SupabaseConnectionCard from '@/components/SupabaseConnectionCard.vue'

const auth = useAuthStore()
const ui = useUiStore()
const chat = useChatStore()

const voice = reactive(readVoiceSettings())
const puterStatus = ref<'off' | 'loading' | 'ready' | 'error'>('off')
const puterError = ref<string | null>(null)

function persistVoice() {
  try {
    localStorage.setItem('hadfield:v1:voice-settings', JSON.stringify(voice))
  } catch {
    /* ignore */
  }
}

async function togglePuter(enabled: boolean) {
  voice.puterEnabled = enabled
  puterError.value = null
  if (!enabled) {
    puterStatus.value = 'off'
    if (!['groq-whisper', 'browser'].includes(voice.source)) voice.source = 'groq-whisper'
    persistVoice()
    return
  }
  puterStatus.value = 'loading'
  try {
    await loadPuter()
    puterStatus.value = 'ready'
    ui.showToast('Puter.js ready — free AI enabled', 'success')
  } catch (e) {
    puterStatus.value = 'error'
    puterError.value = (e as Error).message
    voice.puterEnabled = false
  }
  persistVoice()
}

const localKeyCount = computed(() => listLocalKeys().length)

const profileForm = reactive({
  full_name: auth.profile?.full_name ?? '',
  centre_name: auth.profile?.centre_name ?? '',
  room: auth.profile?.room ?? '',
  role: auth.profile?.role ?? '',
})

const saving = ref(false)
const resettingPassword = ref(false)

async function saveProfile() {
  saving.value = true
  try {
    await auth.saveProfile({
      full_name: profileForm.full_name,
      centre_name: profileForm.centre_name,
      room: profileForm.room,
      role: profileForm.role,
    })
    ui.showToast('Profile saved', 'success')
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
    ui.showToast(`Password reset email sent to ${auth.userEmail}! Check your inbox.`, 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    resettingPassword.value = false
  }
}

function clearLocalData() {
  if (!window.confirm('Remove ALL local data on this device, including drafts?')) return
  listLocalKeys().forEach(removeLocal)
  chat.clear()
  ui.showToast('Local data cleared', 'info')
}
</script>

<template>
  <div class="space-y-5">
    <!-- Admin Shortcut Banner (Admin Only) -->
    <div
      v-if="auth.isAdmin"
      class="rounded-2xl border border-brand-200 dark:border-brand-900 bg-brand-50/70 dark:bg-brand-950/40 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
    >
      <div class="space-y-1">
        <p class="font-display font-extrabold text-sm sm:text-base text-brand-950 dark:text-brand-100 flex items-center gap-2">
          <span>🛡️</span>
          <span>Educational Leadership & Admin Dashboard</span>
        </p>
        <p class="text-xs text-brand-800/90 dark:text-brand-300">
          Grant educator email access, manage room assignments, and configure module Under Development statuses.
        </p>
      </div>
      <RouterLink to="/admin" class="btn-primary text-xs shrink-0 self-start sm:self-auto flex items-center gap-1.5 font-bold">
        <span>Open Admin Dashboard</span>
        <span>&rarr;</span>
      </RouterLink>
    </div>

    <!-- Supabase Cloud Connection Manager -->
    <SupabaseConnectionCard />

    <div class="grid gap-5 lg:grid-cols-2">
      <section class="card space-y-4">
        <h2 class="font-display text-base font-extrabold">👩‍🏫 Your profile</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="field-label" for="pf-name">Full name</label>
            <input id="pf-name" v-model="profileForm.full_name" class="input" />
          </div>
          <div>
            <label class="field-label" for="pf-centre">Centre</label>
            <input id="pf-centre" v-model="profileForm.centre_name" class="input" />
          </div>
          <div>
            <label class="field-label" for="pf-room">Room</label>
            <input id="pf-room" v-model="profileForm.room" class="input" />
          </div>
          <div>
            <label class="field-label" for="pf-role">Role</label>
            <input id="pf-role" v-model="profileForm.role" class="input" placeholder="Educator, ECT, Director…" />
          </div>
        </div>
        <button class="btn-primary" :disabled="saving" @click="saveProfile">
          {{ saving ? 'Saving…' : 'Save profile' }}
        </button>
      </section>

      <!-- Account & Security / Supabase Password Reset -->
      <section class="card space-y-4">
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h2 class="font-display text-base font-extrabold flex items-center gap-2">
              <span>🔐</span>
              <span>Account & Security</span>
            </h2>
            <p class="text-xs text-slate-500">Supabase Cloud Authentication & Password Reset</p>
          </div>
          <span
            class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider"
            :class="auth.isAdmin ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'"
          >
            {{ auth.isAdmin ? '👑 Master Director' : '👩‍🏫 Educator' }}
          </span>
        </div>

        <div class="space-y-3 text-xs">
          <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Signed-In Account</span>
              <span class="font-mono text-slate-800 dark:text-slate-200 font-bold">{{ auth.userEmail || 'Local Session' }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Assigned Centre Group</span>
              <span class="font-bold text-brand-600 dark:text-brand-400">{{ auth.centreName }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Assigned Room</span>
              <span class="font-semibold text-slate-700 dark:text-slate-300">{{ auth.profile?.room || 'All Rooms' }}</span>
            </div>
          </div>

          <div class="p-3.5 rounded-xl border border-brand-500/20 bg-brand-500/10 space-y-2">
            <p class="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
              <span>✉️</span>
              <span>Supabase Password Reset</span>
            </p>
            <p class="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
              Educators can reset their password anytime. Clicking below triggers an official Supabase recovery email sent directly to <strong>{{ auth.userEmail }}</strong>.
            </p>
            <button
              type="button"
              class="btn-secondary text-xs w-full font-bold flex items-center justify-center gap-1.5 py-2"
              :disabled="resettingPassword"
              @click="handleSendPasswordReset"
            >
              <span>🔑</span>
              <span>{{ resettingPassword ? 'Sending Supabase Reset Link…' : 'Send Password Reset Email' }}</span>
            </button>
          </div>

          <div class="flex items-center justify-between pt-2">
            <span class="text-[11px] text-slate-400">Master account: info@pandeykapil.com.np</span>
            <button
              type="button"
              class="btn-ghost text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold"
              @click="auth.signOut()"
            >
              🚪 Sign Out
            </button>
          </div>
        </div>
      </section>

    <section class="card space-y-4">
      <h2 class="font-display text-base font-extrabold">🎙️ Voice & AI usage</h2>

      <div class="rounded-xl bg-slate-50 p-3 text-xs dark:bg-slate-800">
        <p class="font-bold">Pinned models (cheapest verified on your Groq key)</p>
        <ul class="mt-1 list-disc space-y-0.5 pl-4 text-slate-600 dark:text-slate-300">
          <li><span class="font-mono">{{ AI_MODELS.chat }}</span> — chat, ~1000 tps, lowest text price</li>
          <li><span class="font-mono">{{ AI_MODELS.transcribe }}</span> — transcription, $0.04/hr (cheaper than whisper-large-v3)</li>
          <li>Tools cap history (20 turns), truncate long pastes, and limit tokens — small replies cost small credits.</li>
        </ul>
      </div>

      <div>
        <span class="field-label">Default voice input</span>
        <div class="grid gap-2">
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <input
              v-model="voice.source"
              type="radio"
              value="groq-whisper"
              class="mt-1"
              @change="persistVoice()"
            />
            <span class="text-xs">
              <span class="block font-bold">✍️ Record + Groq Whisper (recommended)</span>
              <span class="text-slate-500 dark:text-slate-400">
                Hold-to-record works on iPad Safari; accurate, punctuated text.
                {{ recorderSupported ? '' : '⚠️ This browser cannot record — use Free instead.' }}
              </span>
            </span>
          </label>
          <label class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <input
              v-model="voice.source"
              type="radio"
              value="browser"
              class="mt-1"
              @change="persistVoice()"
            />
            <span class="text-xs">
              <span class="block font-bold">🎤 Free on-device speech — zero credits</span>
              <span class="text-slate-500 dark:text-slate-400">
                Browser speech recognition. Free forever, but less accurate than Whisper.
              </span>
            </span>
          </label>
          <label
            v-if="voice.puterEnabled"
            class="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
          >
            <input
              v-model="voice.source"
              type="radio"
              value="puter"
              class="mt-1"
              @change="persistVoice()"
            />
            <span class="text-xs">
              <span class="block font-bold">🆓 Puter transcription — zero Groq credit</span>
              <span class="text-slate-500 dark:text-slate-400">
                Free user-pays transcription through Puter.js.
              </span>
            </span>
          </label>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <label class="flex cursor-pointer items-start gap-3">
          <input
            :checked="voice.puterEnabled"
            type="checkbox"
            class="mt-1 h-5 w-5"
            @change="togglePuter(($event.target as HTMLInputElement).checked)"
          />
          <span class="text-xs">
            <span class="block font-bold">🆓 Enable Puter.js free AI (lowest usage)</span>
            <span class="text-slate-500 dark:text-slate-400">
              Routes chat replies and (optionally) transcription through Puter's free
              user-pays models — your Groq key is not billed at all. Loads
              <span class="font-mono">js.puter.com/v2</span> only when switched on.
              {{ puterStatus === 'loading' ? 'Loading…' : '' }}
              {{ puterStatus === 'ready' ? '✅ Ready.' : '' }}
            </span>
          </span>
        </label>
        <p v-if="puterError" class="mt-2 text-xs text-rose-600">{{ puterError }}</p>
        <div v-if="voice.puterEnabled" class="mt-3">
          <label class="field-label" for="puter-model">Puter chat model</label>
          <input
            id="puter-model"
            v-model="voice.puterModel"
            class="input font-mono text-sm"
            :placeholder="DEFAULT_VOICE_SETTINGS.puterModel"
            @change="persistVoice()"
          />
          <p class="mt-1 text-[11px] text-slate-400">
            Default <span class="font-mono">{{ DEFAULT_VOICE_SETTINGS.puterModel }}</span>
            (nano-class, cheapest + fastest). Any Puter-supported id works.
          </p>
        </div>
      </div>
    </section>

    <section class="card space-y-3">
      <h2 class="font-display text-base font-extrabold">📲 Install this app</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Install it for a full-screen, offline-capable experience on iPad or computer.
      </p>
      <button v-if="ui.canInstall" class="btn-primary" @click="ui.promptInstall()">
        ⤓ Install now
      </button>
      <p v-else class="text-xs text-slate-400">
        {{
          ui.installed
            ? '✅ Already installed — you are running the installed app.'
            : 'On iPad: tap Share → “Add to Home Screen”. On desktop Chrome/Edge: use the install icon in the address bar.'
        }}
      </p>
      <button class="btn-secondary" @click="ui.toggleTheme()">
        {{ ui.isDark ? '☀️ Use light mode' : '🌙 Use dark mode' }}
      </button>
    </section>

    <section class="card space-y-3">
      <h2 class="font-display text-base font-extrabold">🧹 Data & privacy</h2>
      <ul class="list-disc space-y-1 pl-5 text-xs text-slate-600 dark:text-slate-300">
        <li>The AI chat is <span class="font-bold">temporary</span>: it lives only on this device, never in the database.</li>
        <li>Demo mode stores {{ localKeyCount }} records locally on this device.</li>
        <li>Do not paste children’s surnames or sensitive details into the AI.</li>
      </ul>
      <div class="flex flex-wrap gap-2">
        <button class="btn-secondary" @click="chat.newSession()">Clear chat history</button>
        <button class="btn-danger" @click="clearLocalData()">Clear all local data</button>
      </div>
    </section>
  </div>
  </div>
</template>
