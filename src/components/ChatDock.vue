<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import MarkdownView from './MarkdownView.vue'
import { CHAT_STARTERS } from '@/data/prompts'
import { useChatStore } from '@/stores/chat'
import { useUiStore } from '@/stores/ui'
import { useSpeechInput, useSpeechOutput } from '@/composables/useSpeech'

const chat = useChatStore()
const ui = useUiStore()

const draft = ref('')
const scroller = ref<HTMLElement | null>(null)
const speakReplies = ref(false)

const speech = useSpeechInput({ lang: 'en-AU' })
const voiceOut = useSpeechOutput()

watch(
  () => speech.fullText.value,
  value => {
    if (value) draft.value = value
  },
)

watch(
  () => chat.messages.length,
  async () => {
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
  },
)

watch(
  () => chat.streaming,
  async streaming => {
    if (streaming) {
      await nextTick()
      scroller.value?.scrollTo({ top: scroller.value.scrollHeight })
    }
  },
)

async function submit() {
  const text = draft.value.trim()
  if (!text || chat.streaming) return
  if (speech.listening.value) speech.stop()
  draft.value = ''
  speech.reset()
  await chat.send(text)
  if (speakReplies.value && chat.lastAssistant) {
    voiceOut.speak(chat.lastAssistant)
  }
}

function useStarter(prompt: string) {
  draft.value = prompt
  void submit()
}

function close() {
  if (speech.listening.value) speech.stop()
  voiceOut.stop()
  ui.toggleChat(false)
}
</script>

<template>
  <!-- Launcher (mobile only; desktop has the top-bar button) -->
  <button
    class="fixed bottom-20 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-brand-700 text-2xl text-white shadow-lift transition active:scale-95 lg:hidden"
    aria-label="Open AI assistant"
    @click="ui.toggleChat(true)"
  >
    ✨
  </button>

  <Transition name="dock">
    <div v-if="ui.chatOpen" class="fixed inset-0 z-[55] flex justify-end">
      <div class="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" @click="close" />

      <section
        class="relative flex h-full w-full flex-col bg-white shadow-lift dark:bg-slate-900 sm:max-w-xl lg:max-w-lg"
      >
        <header
          class="flex items-center gap-3 border-b border-slate-200 px-4 py-3 pt-safe dark:border-slate-800"
        >
          <div
            class="grid h-10 w-10 place-items-center rounded-2xl bg-brand-700 text-lg text-white"
          >
            ✨
          </div>
          <div class="min-w-0 flex-1">
            <p class="font-display text-sm font-extrabold">Inquiry Assistant</p>
            <p class="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span class="chip bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                Temporary
              </span>
              <span class="truncate">Not saved · clears with New chat</span>
            </p>
          </div>
          <button
            class="btn-ghost !px-2"
            aria-label="Toggle spoken replies"
            @click="speakReplies = !speakReplies"
          >
            <span class="text-lg">{{ speakReplies ? '🔊' : '🔈' }}</span>
          </button>
          <button class="btn-ghost !px-2" aria-label="Close" @click="close">
            <span class="text-xl">✕</span>
          </button>
        </header>

        <div
          v-if="chat.context"
          class="flex items-center gap-2 border-b border-slate-200 bg-brand-50 px-4 py-2 text-xs text-brand-800 dark:border-slate-800 dark:bg-brand-950/50 dark:text-brand-200"
        >
          <span>📎</span>
          <span class="truncate">Using context: {{ chat.context.label }}</span>
          <button class="ml-auto underline" @click="chat.setContext(null)">remove</button>
        </div>

        <div ref="scroller" class="flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-touch">
          <div v-if="!chat.hasMessages" class="space-y-4">
            <p class="text-sm text-slate-500 dark:text-slate-400">
              Ask anything about inquiry planning, EYLF outcomes, learning stories,
              Reggio Emilia or learning theories. Voice input works on iPad — tap the
              microphone.
            </p>
            <div class="grid gap-2">
              <button
                v-for="starter in CHAT_STARTERS"
                :key="starter.label"
                class="flex items-start gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm font-semibold transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:hover:bg-slate-800"
                @click="useStarter(starter.prompt)"
              >
                <span>💬</span>
                <span class="min-w-0">
                  <span class="block">{{ starter.label }}</span>
                  <span
                    class="block truncate text-xs font-normal text-slate-500 dark:text-slate-400"
                  >
                    {{ starter.prompt.slice(0, 64) }}…
                  </span>
                </span>
              </button>
            </div>
          </div>

          <div
            v-for="message in chat.messages"
            :key="message.id"
            class="flex"
            :class="message.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm"
              :class="
                message.role === 'user'
                  ? 'bg-brand-700 text-white'
                  : message.error
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300'
                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100'
              "
            >
              <MarkdownView
                v-if="message.role === 'assistant' && message.content"
                :source="message.content"
              />
              <p v-else class="whitespace-pre-wrap">{{ message.content || '…' }}</p>
            </div>
          </div>

          <div v-if="chat.streaming" class="flex items-center gap-2 text-xs text-slate-400">
            <span class="h-2 w-2 animate-pulse rounded-full bg-brand-500" />
            Thinking…
          </div>
        </div>

        <div
          v-if="speech.listening.value"
          class="flex items-center gap-2 border-t border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold text-brand-800 dark:border-brand-900 dark:bg-brand-950/50 dark:text-brand-200"
        >
          <span class="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
          Listening… {{ speech.fullText.value || 'speak now' }}
        </div>

        <footer class="border-t border-slate-200 px-3 py-3 pb-safe dark:border-slate-800">
          <div class="flex items-end gap-2">
            <textarea
              v-model="draft"
              rows="1"
              placeholder="Ask about EYLF, theories, planning…"
              class="input max-h-32 flex-1 resize-none"
              @keydown.enter.exact.prevent="submit()"
            />
            <button
              v-if="speech.supported"
              class="btn-secondary !px-3"
              :class="speech.listening.value ? '!bg-rose-600 !text-white' : ''"
              :aria-label="speech.listening.value ? 'Stop listening' : 'Speak your message'"
              @click="speech.toggle()"
            >
              <span class="text-lg">🎤</span>
            </button>
            <button
              v-if="chat.streaming"
              class="btn-danger !px-3"
              aria-label="Stop generating"
              @click="chat.stop()"
            >
              ■
            </button>
            <button
              class="btn-primary !px-3"
              :disabled="!draft.trim() || chat.streaming"
              aria-label="Send message"
              @click="submit()"
            >
              ➤
            </button>
          </div>
          <div class="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <button class="underline" @click="chat.newSession()">
              ＋ New chat (clears history)
            </button>
            <span>Enter to send</span>
          </div>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<style scoped>
.dock-enter-active,
.dock-leave-active {
  transition: opacity 0.2s ease;
}
.dock-enter-active section,
.dock-leave-active section {
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.dock-enter-from,
.dock-leave-to {
  opacity: 0;
}
.dock-enter-from section,
.dock-leave-to section {
  transform: translateX(24px);
}
</style>

