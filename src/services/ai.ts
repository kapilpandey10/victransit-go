import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './supabase'

/**
 * Client for the AI Edge Function.
 *
 * SECURITY: the Groq API key never reaches the browser. All requests go to a
 * Supabase Edge Function which holds `GROQ_API_KEY` as a server-side secret.
 */

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AiCallOptions {
  messages: AiMessage[]
  /** 'chat' returns prose; 'json' forces a JSON object response. */
  mode?: 'chat' | 'json'
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
  onToken?: (token: string) => void
}

const FUNCTION_NAME = (import.meta.env.VITE_CHAT_FUNCTION as string) || 'chat'

export class AiUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AiUnavailableError'
  }
}

function endpoint(): string {
  return `${SUPABASE_URL}/functions/v1/${FUNCTION_NAME}`
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    apikey: SUPABASE_ANON_KEY ?? '',
  }
}

/**
 * Streams a chat completion. Tokens are emitted through `onToken` as they
 * arrive. Returns the full concatenated text.
 */
export async function streamChat(options: AiCallOptions): Promise<string> {
  if (!isSupabaseConfigured) {
    throw new AiUnavailableError(
      'The AI assistant needs a Supabase project with the `chat` Edge Function deployed. Add your credentials to .env.local and run `supabase functions deploy chat`.',
    )
  }

  const res = await fetch(endpoint(), {
    method: 'POST',
    headers: authHeaders(),
    signal: options.signal,
    body: JSON.stringify({
      messages: options.messages,
      mode: options.mode ?? 'chat',
      stream: true,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 1400,
    }),
  })

  if (!res.ok || !res.body) {
    const detail = await safeText(res)
    throw new AiUnavailableError(
      `AI request failed (${res.status}). ${detail || 'Check that the Edge Function is deployed and GROQ_API_KEY is set.'}`,
    )
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Split on SSE record boundaries.
    const parts = buffer.split('\n\n')
    buffer = parts.pop() ?? ''

    for (const part of parts) {
      const line = part
        .split('\n')
        .find(l => l.startsWith('data:'))
      if (!line) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        const parsed = JSON.parse(payload)
        // The Edge Function forwards Groq's OpenAI-compatible chunk shape.
        const token: string =
          parsed?.choices?.[0]?.delta?.content ??
          parsed?.choices?.[0]?.message?.content ??
          ''
        if (token) {
          full += token
          options.onToken?.(token)
        }
      } catch {
        // Ignore malformed keep-alive frames.
      }
    }
  }

  return full
}

/**
 * Calls the AI and parses a JSON response, tolerating markdown fences and
 * leading/trailing prose that models sometimes add.
 */
export async function jsonTask<T>(options: AiCallOptions): Promise<T> {
  const raw = await streamChat({ ...options, mode: 'json' })
  return parseJsonLoose<T>(raw)
}

export function parseJsonLoose<T>(raw: string): T {
  let text = raw.trim()

  // Strip ```json … ``` fences.
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) text = fence[1].trim()

  // Fall back to the outermost {...} block.
  if (!text.startsWith('{') && !text.startsWith('[')) {
    const start = text.search(/[[{]/)
    const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
    if (start !== -1 && end !== -1 && end > start) {
      text = text.slice(start, end + 1)
    }
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new AiUnavailableError(
      'The AI returned a response that could not be read as JSON. Please try again.',
    )
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    const text = await res.text()
    try {
      const parsed = JSON.parse(text)
      return parsed?.error ?? parsed?.message ?? text.slice(0, 300)
    } catch {
      return text.slice(0, 300)
    }
  } catch {
    return ''
  }
}

export const aiStatus = {
  configured: isSupabaseConfigured,
  endpoint: isSupabaseConfigured ? endpoint() : null,
}