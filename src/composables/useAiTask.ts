import { ref } from 'vue'
import { AiUnavailableError, jsonTask, streamChat, type AiMessage } from '@/services/ai'

/**
 * Small wrapper that standardises loading / error handling for the
 * JSON-returning AI tools (learning outcomes, story, newsletter, analysis).
 */
export function useAiTask() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function run<T>(prompt: string, systemHint?: string): Promise<T | null> {
    loading.value = true
    error.value = null
    try {
      const messages: AiMessage[] = []
      if (systemHint) messages.push({ role: 'system', content: systemHint })
      messages.push({ role: 'user', content: prompt })
      return await jsonTask<T>({ messages, temperature: 0.5, maxTokens: 1600 })
    } catch (e) {
      error.value =
        e instanceof AiUnavailableError
          ? e.message
          : `The AI request failed: ${(e as Error).message}`
      return null
    } finally {
      loading.value = false
    }
  }

  /**
   * Runs a prose task (streamed) and returns the full text — used by the
   * Weekly Wrap-Up compiler, where the model writes a ready-to-copy document
   * rather than JSON.
   */
  async function runText(
    prompt: string,
    opts: { systemHint?: string; maxTokens?: number; temperature?: number } = {},
  ): Promise<string | null> {
    loading.value = true
    error.value = null
    try {
      const messages: AiMessage[] = []
      if (opts.systemHint) messages.push({ role: 'system', content: opts.systemHint })
      messages.push({ role: 'user', content: prompt })
      const text = await streamChat({
        messages,
        mode: 'chat',
        temperature: opts.temperature ?? 0.7,
        maxTokens: opts.maxTokens ?? 2400,
      })
      if (!text.trim()) throw new Error('The AI returned an empty wrap-up.')
      return text.trim()
    } catch (e) {
      error.value =
        e instanceof AiUnavailableError
          ? e.message
          : `The AI request failed: ${(e as Error).message}`
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, error, run, runText }
}