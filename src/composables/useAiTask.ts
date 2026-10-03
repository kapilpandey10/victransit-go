import { ref } from 'vue'
import { AiUnavailableError, jsonTask, type AiMessage } from '@/services/ai'

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

  return { loading, error, run }
}