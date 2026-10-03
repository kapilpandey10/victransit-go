import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { AiUnavailableError, streamChat, type AiMessage } from '@/services/ai'
import {
  DRAFT_KEYS,
  localId,
  readLocal,
  removeLocal,
  writeLocal,
} from '@/services/localStore'
import { readVoiceSettings, streamChatWithPuter } from '@/services/voice'
import type { ChatContext, ChatMessage } from '@/types'

/**
 * Temporary AI chat.
 *
 * By design the conversation lives only in memory + localStorage on this device.
 * It is never written to the database, so no child or family information leaks
 * into persisted chat history. "Clear chat" removes it entirely.
 */
export const useChatStore = defineStore('chat', () => {
  const messages = ref<ChatMessage[]>(readLocal<ChatMessage[]>(DRAFT_KEYS.chat, []))
  const streaming = ref(false)
  const error = ref<string | null>(null)
  const context = ref<ChatContext | null>(null)
  const provider = ref<'groq' | 'puter'>('groq')
  let controller: AbortController | null = null

  const isTemporary = true // documents intent for the UI badge
  const hasMessages = computed(() => messages.value.length > 0)
  const lastAssistant = computed(
    () => [...messages.value].reverse().find(m => m.role === 'assistant')?.content ?? '',
  )

  function persist() {
    writeLocal(DRAFT_KEYS.chat, messages.value.slice(-40))
  }

  function push(message: Omit<ChatMessage, 'id' | 'createdAt'>) {
    const full: ChatMessage = {
      ...message,
      id: localId(),
      createdAt: Date.now(),
    }
    messages.value.push(full)
    persist()
    return full
  }

  function setContext(next: ChatContext | null) {
    context.value = next
  }

  function buildApiMessages(): AiMessage[] {
    return buildPlainMessages() as AiMessage[]
  }

  function buildPlainMessages(): { role: string; content: string }[] {
    const history = messages.value
      .filter(m => !m.error)
      .map(m => ({ role: m.role, content: m.content }))

    if (context.value) {
      history.unshift({
        role: 'user',
        content: `Context from my current screen (${context.value.label}):\n"""\n${context.value.body.slice(
          0,
          4000,
        )}\n"""\n\nPlease use this context when answering.`,
      })
    }
    return history
  }

  async function send(text: string) {
    const content = text.trim()
    if (!content || streaming.value) return

    error.value = null
    push({ role: 'user', content })

    const assistant = push({ role: 'assistant', content: '' })
    streaming.value = true
    controller = new AbortController()

    // Puter.js toggle (Settings): free user-pays chat, zero Groq credit.
    const voice = readVoiceSettings()
    const usePuter = voice.puterEnabled

    try {
      const onToken = (token: string) => {
        assistant.content += token
        persist()
      }
      const full = usePuter
        ? await streamChatWithPuter(buildPlainMessages(), {
            model: voice.puterModel,
            maxTokens: 1400,
            signal: controller.signal,
            onToken,
          })
        : await streamChat({
            messages: buildApiMessages(),
            mode: 'chat',
            signal: controller.signal,
            onToken,
          })
      provider.value = usePuter ? 'puter' : 'groq'
      if (!full) assistant.content = '_(No response received.)_'
    } catch (e) {
      const message =
        e instanceof AiUnavailableError
          ? e.message
          : `Something went wrong: ${(e as Error).message}`
      error.value = message
      assistant.content = message
      assistant.error = true
      persist()
    } finally {
      streaming.value = false
      controller = null
      persist()
    }
  }

  function stop() {
    controller?.abort()
    controller = null
    streaming.value = false
  }

  function clear() {
    stop()
    messages.value = []
    error.value = null
    removeLocal(DRAFT_KEYS.chat)
  }

  function newSession() {
    clear()
  }

  return {
    messages,
    streaming,
    error,
    context,
    provider,
    isTemporary,
    hasMessages,
    lastAssistant,
    send,
    stop,
    clear,
    newSession,
    setContext,
  }
})