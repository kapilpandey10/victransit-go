<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { AI_MODELS, aiStatus } from '@/services/ai'
import { listLocalKeys, removeLocal } from '@/services/localStore'
import { isSupabaseConfigured } from '@/services/supabase'
import {
  DEFAULT_VOICE_SETTINGS,
  loadPuter,
  readVoiceSettings,
  recorderSupported,
} from '@/services/voice'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'

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

const configured = computed(() => isSupabaseConfigured)
const endpoint = computed(() => aiStatus.endpoint)
const localKeyCount = computed(() => listLocalKeys().length)

const profileForm = reactive({
  full_name: auth.profile?.full_name ?? '',
  centre_name: auth.profile?.centre_name ?? '',
  room: auth.profile?.room ?? '',
  role: auth.profile?.role ?? '',
})

const saving = ref(false)
const email = ref('')
const password = ref('')
const fullName = ref('')
const authError = ref<string | null>(null)
const authBusy = ref(false)

async function saveProfile() {
  saving.value = true
  try {
    await auth.saveProfile({ ...profileForm })
    ui.showToast('Profile saved', 'success')
  } catch (e) {
    ui.showToast((e as Error).message, 'error')
  } finally {
    saving.value = false
  }
}

async function authAction(kind: 'in' | 'up') {
  authBusy.value = true
  authError.value = null
  try {
    if (kind === 'in') await auth.signIn(email.value, password.value)
    else await auth.signUp(email.value, password.value, fullName.value)
    ui.showToast(kind === 'in' ? 'Signed in' : 'Account created — check your email', 'success')
  } catch (e) {
    authError.value = (e as Error).message
  } finally {
    authBusy.value = false
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

    <section class="card space-y-3">
      <h2 class="font-display text-base font-extrabold">🔌 Backend connection</h2>
      <p class="text-xs text-slate-500 dark:text-slate-400">
        Status:
        <span
          :class="
            aiStatus.mode === 'edge-function'
              ? 'font-bold text-emerald-600'
              : aiStatus.mode === 'direct'
                ? 'font-bold text-sky-600'
                : 'font-bold text-amber-600'
          "
        >
          {{
            aiStatus.mode === 'edge-function'
              ? 'Supabase Edge Function — Groq key stays server-side, data syncs.'
              : aiStatus.mode === 'direct'
                ? 'Direct Groq mode — AI chat + Whisper voice work now (key in git-ignored .env.local).'
                : 'Demo mode — no AI backend yet. Add a Groq key or Supabase credentials.'
          }}
        </span>
      </p>

      <div v-if="configured" class="space-y-3">
        <p class="break-all font-mono text-[11px] text-slate-400">{{ endpoint }}</p>
        <div class="grid gap-3">
          <div>
            <label class="field-label" for="auth-email">Email</label>
            <input id="auth-email" v-model="email" type="email" class="input" />
          </div>
          <div>
            <label class="field-label" for="auth-password">Password</label>
            <input id="auth-password" v-model="password" type="password" class="input" />
          </div>
          <div>
            <label class="field-label" for="auth-name">Name (for sign-up)</label>
            <input id="auth-name" v-model="fullName" class="input" />
          </div>
          <p v-if="authError" class="text-xs text-rose-600">{{ authError }}</p>
          <div class="flex gap-2">
            <button class="btn-primary flex-1" :disabled="authBusy" @click="authAction('in')">Sign in</button>
            <button class="btn-secondary flex-1" :disabled="authBusy" @click="authAction('up')">Sign up</button>
            <button v-if="auth.isAuthenticated" class="btn-ghost" @click="auth.signOut()">Out</button>
          </div>
        </div>
      </div>

      <div v-else-if="aiStatus.direct" class="space-y-3">
        <p class="break-all font-mono text-[11px] text-slate-400">{{ endpoint }}</p>
        <p class="text-xs text-slate-600 dark:text-slate-300">
          AI chat and Whisper voice transcription are <span class="font-bold">live right now</span>
          through the direct Groq path — no Supabase required. Data is still saved
          on this device only.
        </p>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          To enable cross-device sync and move the key fully server-side, follow
          the README: create a Supabase project, run
          <span class="font-mono">supabase/migrations/0001_init.sql</span>, deploy the
          <span class="font-mono">chat</span> function, then add the URL + anon key to
          <span class="font-mono">.env.local</span>.
        </p>
      </div>

      <ol v-else class="list-decimal space-y-1.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
        <li>Create a free project at <span class="font-bold">supabase.com</span>.</li>
        <li>Run the SQL in <span class="font-mono">supabase/migrations/0001_init.sql</span>.</li>
        <li>Deploy the chat function and set the GROQ_API_KEY secret.</li>
        <li>Copy .env.example to .env.local with your URL and anon key, then rebuild.</li>
      </ol>
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
</template>
