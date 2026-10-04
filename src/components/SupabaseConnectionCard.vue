<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  DEFAULT_SUPABASE_URL,
  clearSupabaseCredentials,
  getActiveSupabaseAnonKey,
  getActiveSupabaseUrl,
  isSupabaseConfiguredRef,
  setSupabaseCredentials,
  testSupabaseConnection,
  type SupabaseConnectionTestResult,
} from '@/services/supabase'
import { syncAllLocalDataToSupabase, type SyncResult } from '@/services/cloudSync'
import { SUPABASE_SQL_MIGRATION } from '@/data/sqlMigration'
import { useAuthStore } from '@/stores/auth'
import { useAdminStore } from '@/stores/admin'
import { useRoomsStore } from '@/stores/rooms'
import { useUiStore } from '@/stores/ui'

const auth = useAuthStore()
const admin = useAdminStore()
const roomsStore = useRoomsStore()
const ui = useUiStore()

const url = ref(DEFAULT_SUPABASE_URL)
const anonKey = ref('')
const showKey = ref(false)

const testing = ref(false)
const saving = ref(false)
const syncing = ref(false)
const copiedSql = ref(false)

const testResult = ref<SupabaseConnectionTestResult | null>(null)
const syncResult = ref<SyncResult | null>(null)

onMounted(() => {
  url.value = getActiveSupabaseUrl()
  anonKey.value = getActiveSupabaseAnonKey()
})

const isConfigured = computed(() => isSupabaseConfiguredRef.value)

const projectRef = computed(() => {
  try {
    const parsed = new URL(url.value)
    return parsed.hostname.split('.')[0] || 'zcslgqitzkmxwusrqlsu'
  } catch {
    return 'zcslgqitzkmxwusrqlsu'
  }
})

const apiSettingsUrl = computed(
  () => `https://supabase.com/dashboard/project/${projectRef.value}/settings/api`,
)
const sqlEditorUrl = computed(
  () => `https://supabase.com/dashboard/project/${projectRef.value}/sql/new`,
)
const tableEditorUrl = computed(
  () => `https://supabase.com/dashboard/project/${projectRef.value}/editor`,
)
const authUsersUrl = computed(
  () => `https://supabase.com/dashboard/project/${projectRef.value}/auth/users`,
)

async function handleTestConnection() {
  testing.value = true
  testResult.value = null
  try {
    const res = await testSupabaseConnection(url.value, anonKey.value)
    testResult.value = res
    if (res.ok) {
      if (res.code === 'TABLES_MISSING') {
        ui.showToast('Supabase API key verified! Tables not found yet — run the SQL migration.', 'info')
      } else {
        ui.showToast('Supabase Cloud is connected and operational! 🟢', 'success')
      }
    } else {
      ui.showToast(res.message, 'error')
    }
  } catch (err) {
    testResult.value = {
      ok: false,
      message: (err as Error).message,
      code: 'NETWORK_ERROR',
    }
    ui.showToast((err as Error).message, 'error')
  } finally {
    testing.value = false
  }
}

async function handleSaveAndConnect() {
  saving.value = true
  try {
    if (!anonKey.value.trim()) {
      ui.showToast('Please enter your Supabase anon key.', 'error')
      return
    }

    // Run connection test first
    const test = await testSupabaseConnection(url.value, anonKey.value)
    testResult.value = test

    if (!test.ok) {
      ui.showToast(`Cannot connect: ${test.message}`, 'error')
      return
    }

    setSupabaseCredentials(url.value, anonKey.value)
    await auth.init()
    await Promise.all([admin.init(), roomsStore.loadRooms()])

    ui.showToast('Supabase credentials saved! Live connection active.', 'success')
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    saving.value = false
  }
}

function handleDisconnect() {
  if (confirm('Disconnect from Supabase Cloud and revert to local demo mode?')) {
    clearSupabaseCredentials()
    anonKey.value = ''
    testResult.value = null
    void auth.init()
    void admin.init()
    ui.showToast('Disconnected from Supabase Cloud. App running in local mode.', 'info')
  }
}

async function handleCopySql() {
  try {
    await navigator.clipboard.writeText(SUPABASE_SQL_MIGRATION)
    copiedSql.value = true
    ui.showToast('SQL migration copied to clipboard! Paste into Supabase SQL editor.', 'success')
    setTimeout(() => {
      copiedSql.value = false
    }, 4000)
  } catch (err) {
    ui.showToast('Failed to copy to clipboard. Please copy manually from supabase/migrations/0001_init.sql', 'error')
  }
}

async function handleSyncLocalData() {
  syncing.value = true
  syncResult.value = null
  try {
    const res = await syncAllLocalDataToSupabase()
    syncResult.value = res
    if (res.total > 0) {
      ui.showToast(`Successfully synced ${res.total} records to Supabase Cloud!`, 'success')
      await Promise.all([admin.loadTeachers(), admin.loadTopics(), roomsStore.loadRooms()])
    } else {
      ui.showToast('No new local records needed synchronization.', 'info')
    }
  } catch (err) {
    ui.showToast((err as Error).message, 'error')
  } finally {
    syncing.value = false
  }
}
</script>

<template>
  <div class="card p-6 sm:p-7 space-y-6 border-slate-200 dark:border-slate-800 shadow-lift">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="space-y-1">
        <div class="flex items-center gap-2">
          <span class="text-2xl">☁️</span>
          <h3 class="font-display text-lg font-black text-slate-900 dark:text-white">
            Supabase Cloud Database & Authentication
          </h3>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400">
          Connect your Hadfield ELC project for real-time cloud persistence, multi-teacher auth, and PostgreSQL storage.
        </p>
      </div>

      <!-- Live Connection Pill -->
      <div class="shrink-0 flex items-center gap-2">
        <span
          class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border"
          :class="
            isConfigured
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
          "
        >
          <span
            class="h-2 w-2 rounded-full"
            :class="isConfigured ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'"
          />
          <span>{{ isConfigured ? 'Cloud Connected' : 'Disconnected (Demo Mode)' }}</span>
        </span>
      </div>
    </div>

    <!-- Quick Steps Notice if Disconnected -->
    <div
      v-if="!isConfigured"
      class="rounded-2xl border border-brand-200 dark:border-brand-900 bg-brand-50/70 dark:bg-brand-950/40 p-4 text-xs space-y-2 text-brand-950 dark:text-brand-200"
    >
      <p class="font-bold flex items-center gap-1.5 text-sm">
        <span>⚡</span>
        <span>How to connect your Supabase Dashboard in 2 minutes:</span>
      </p>
      <ol class="list-decimal pl-5 space-y-1 text-slate-700 dark:text-slate-300">
        <li>
          Open your Supabase project:
          <a
            :href="apiSettingsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold underline text-brand-600 dark:text-brand-400 hover:text-brand-700 ml-1 inline-flex items-center gap-0.5"
          >
            <span>Open API Settings</span>
            <span class="text-[10px]">↗</span>
          </a>
        </li>
        <li>
          Copy the <span class="font-mono font-bold bg-brand-100 dark:bg-brand-900/60 px-1 py-0.5 rounded text-[11px]">anon</span> <span class="font-mono font-bold bg-brand-100 dark:bg-brand-900/60 px-1 py-0.5 rounded text-[11px]">public</span> key under <strong>Project API keys</strong>.
        </li>
        <li>Paste it into the <strong>Anon Public Key</strong> field below and click <strong>Test & Connect</strong>.</li>
        <li>
          Run the SQL migration in your
          <a
            :href="sqlEditorUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-bold underline text-brand-600 dark:text-brand-400 hover:text-brand-700 ml-1 inline-flex items-center gap-0.5"
          >
            <span>Supabase SQL Editor</span>
            <span class="text-[10px]">↗</span>
          </a>
          using the 1-click <strong>Copy SQL Migration</strong> button.
        </li>
      </ol>
    </div>

    <!-- Credentials Form -->
    <div class="grid gap-4 sm:grid-cols-1">
      <div>
        <label class="field-label flex items-center justify-between" for="sb-url">
          <span>Supabase Project URL</span>
          <span class="text-[10px] text-slate-400 font-normal">Project ID: {{ projectRef }}</span>
        </label>
        <input
          id="sb-url"
          v-model="url"
          type="text"
          class="input font-mono text-xs"
          placeholder="https://your-project.supabase.co"
        />
      </div>

      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="field-label mb-0" for="sb-key">Supabase Anon Public Key</label>
          <a
            :href="apiSettingsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center gap-1"
          >
            <span>Get Anon Key from Supabase</span>
            <span>↗</span>
          </a>
        </div>
        <div class="relative">
          <input
            id="sb-key"
            v-model="anonKey"
            :type="showKey ? 'text' : 'password'"
            class="input font-mono text-xs pr-20"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
          />
          <button
            type="button"
            class="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 rounded"
            @click="showKey = !showKey"
          >
            {{ showKey ? 'Hide' : 'Show' }}
          </button>
        </div>
        <p class="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
          This is safe to use in the browser. Do <strong class="text-rose-500">NOT</strong> paste the <code class="text-[10px] font-mono">service_role</code> secret.
        </p>
      </div>
    </div>

    <!-- Test Diagnostic Result Message -->
    <div
      v-if="testResult"
      class="rounded-xl p-3.5 text-xs flex items-start gap-2.5 border transition"
      :class="
        testResult.ok
          ? testResult.code === 'TABLES_MISSING'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200'
          : 'bg-rose-500/10 border-rose-500/30 text-rose-900 dark:text-rose-200'
      "
    >
      <span class="text-base shrink-0">
        {{ testResult.ok ? (testResult.code === 'TABLES_MISSING' ? '⚠️' : '✅') : '❌' }}
      </span>
      <div class="space-y-1">
        <p class="font-bold">
          {{
            testResult.ok
              ? testResult.code === 'TABLES_MISSING'
                ? 'Connected to Project — Tables Missing'
                : 'Connection Verified & Active'
              : 'Connection Verification Failed'
          }}
        </p>
        <p class="leading-relaxed">{{ testResult.message }}</p>
        <div v-if="testResult.code === 'TABLES_MISSING'" class="pt-1">
          <button
            type="button"
            class="btn-primary text-xs py-1.5 px-3 font-bold"
            @click="handleCopySql"
          >
            <span>📋</span>
            <span>Copy SQL Migration Script</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Action Buttons -->
    <div class="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
      <button
        type="button"
        class="btn-secondary text-xs font-bold flex items-center gap-1.5"
        :disabled="testing"
        @click="handleTestConnection"
      >
        <span>{{ testing ? '⏳' : '🧪' }}</span>
        <span>{{ testing ? 'Testing Connection…' : 'Test Connection' }}</span>
      </button>

      <button
        type="button"
        class="btn-primary text-xs font-bold flex items-center gap-1.5"
        :disabled="saving || !anonKey.trim()"
        @click="handleSaveAndConnect"
      >
        <span>{{ saving ? '⏳' : '⚡' }}</span>
        <span>{{ saving ? 'Saving…' : 'Save & Connect to Cloud' }}</span>
      </button>

      <button
        type="button"
        class="btn-secondary text-xs font-bold flex items-center gap-1.5"
        @click="handleCopySql"
      >
        <span>{{ copiedSql ? '✅' : '📋' }}</span>
        <span>{{ copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Migration' }}</span>
      </button>

      <button
        v-if="isConfigured"
        type="button"
        class="btn bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center gap-1.5"
        :disabled="syncing"
        @click="handleSyncLocalData"
      >
        <span>{{ syncing ? '⏳' : '🔄' }}</span>
        <span>{{ syncing ? 'Syncing…' : 'Sync Local Data to Cloud' }}</span>
      </button>

      <button
        v-if="isConfigured"
        type="button"
        class="btn text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 px-3 py-2 rounded-xl transition ml-auto"
        @click="handleDisconnect"
      >
        Disconnect
      </button>
    </div>

    <!-- Cloud Quicklinks -->
    <div class="rounded-2xl bg-slate-50 dark:bg-slate-900/60 p-4 border border-slate-200 dark:border-slate-800 space-y-2">
      <p class="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Direct Supabase Dashboard Links
      </p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <a
          :href="apiSettingsUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl bg-white dark:bg-slate-800 p-2.5 text-center text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition shadow-xs flex flex-col items-center gap-1"
        >
          <span class="text-base">🔑</span>
          <span>API Settings</span>
        </a>

        <a
          :href="sqlEditorUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl bg-white dark:bg-slate-800 p-2.5 text-center text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition shadow-xs flex flex-col items-center gap-1"
        >
          <span class="text-base">📝</span>
          <span>SQL Editor</span>
        </a>

        <a
          :href="tableEditorUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl bg-white dark:bg-slate-800 p-2.5 text-center text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition shadow-xs flex flex-col items-center gap-1"
        >
          <span class="text-base">📊</span>
          <span>Table Data</span>
        </a>

        <a
          :href="authUsersUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="rounded-xl bg-white dark:bg-slate-800 p-2.5 text-center text-xs font-bold border border-slate-200 dark:border-slate-700 hover:border-brand-500 transition shadow-xs flex flex-col items-center gap-1"
        >
          <span class="text-base">👥</span>
          <span>Auth Users</span>
        </a>
      </div>
    </div>
  </div>
</template>
