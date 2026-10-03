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

/**
 * Cheapest valid models on this Groq account (verified against /v1/models):
 * - chat: openai/gpt-oss-20b ($0.075 in / $0.30 out per 1M, ~1000 tps)
 * - transcribe: whisper-large-v3-turbo ($0.04/hr — cheaper than whisper-large-v3)
 *
 * The Edge Function pins these server-side too; VITE_AI_MODEL can only pick
 * from the same allow-list, so a typo can never cause a 400/credit surprise.
 */
export const AI_MODELS = {
  chat: 'openai/gpt-oss-20b',
  chatFallback: 'openai/gpt-oss-120b',
  transcribe: 'whisper-large-v3-turbo',
} as const

/**
 * Optional direct-Groq fallback for environments without Supabase (dev /
 * demo). The key lives in `.env.local` (git-ignored) as `VITE_GROQ_API_KEY`.
 *
 * PRIORITY: Edge Function (key never leaves the server) → direct (key is in
 * the local bundle — acceptable only for this single-machine install) →
 * friendly setup error. Groq's CORS allows browser calls, which is what makes
 * the fallback possible.
 */
const DIRECT_KEY = (import.meta.env.VITE_GROQ_API_KEY as string) || ''
export const directGroqEnabled = !isSupabaseConfigured && !!DIRECT_KEY
export const aiMode: 'edge-function' | 'direct' | 'unavailable' = isSupabaseConfigured
  ? 'edge-function'
  : DIRECT_KEY
    ? 'direct'
    : 'unavailable'

/** Compact system prompt used only on the direct path (mirrors the Edge Function). */
const DIRECT_SYSTEM_PROMPT = `You are the Inquiry Assistant for an Australian early childhood service (Hadfield Early Learning Centre).
You help educators with inquiry planning, EYLF v2.0 outcomes (1 Identity, 2 Connectedness, 3 Wellbeing, 4 Learning, 5 Communication), learning stories, Reggio Emilia (hundred languages, environment as third teacher, emergent curriculum), and theories (Vygotsky, Piaget, Montessori, Dewey, Bruner, Bronfenbrenner, Rogoff, Dweck, Kolb, Gardner, Froebel).
House style: warm, plain English, concise, Markdown bullets/headings, strengths-based (what children CAN do), never invent observations, never request children's surnames or sensitive details.`

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
 *
 * Route selection: Supabase Edge Function when configured (key server-side),
 * otherwise the direct Groq fallback when `VITE_GROQ_API_KEY` is present.
 */
export async function streamChat(options: AiCallOptions): Promise<string> {
  const res = await openChatStream(options)
  if (!res || !res.body) {
    throw new AiUnavailableError(
      'No AI backend is available. Add Supabase credentials (Edge Function) or set VITE_GROQ_API_KEY in .env.local.',
    )
  }
  return readSse(res.body, options.onToken)
}

async function openChatStream(options: AiCallOptions): Promise<Response> {
  // Path 1: Supabase Edge Function — the key never reaches the browser.
  if (isSupabaseConfigured) {
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: authHeaders(),
      signal: options.signal,
      body: JSON.stringify({
        messages: options.messages,
        mode: options.mode ?? 'chat',
        stream: true,
        model: AI_MODELS.chat,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1400,
      }),
    })
    if (!res.ok) {
      const detail = await safeText(res)
      throw new AiUnavailableError(
        `AI request failed (${res.status}). ${detail || 'Check that the Edge Function is deployed and GROQ_API_KEY is set.'}`,
      )
    }
    return res
  }

  // Path 2: direct Groq fallback (local installs without Supabase).
  if (DIRECT_KEY) {
    const isJson = options.mode === 'json'
    const messages = [
      ...(isJson ? [{ role: 'system' as const, content: JSON_HINT }] : []),
      { role: 'system' as const, content: DIRECT_SYSTEM_PROMPT },
      ...options.messages.map(m => ({
        role: m.role === 'system' ? ('system' as const) : (m.role as 'user' | 'assistant'),
        content: m.content,
      })),
    ]
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DIRECT_KEY}`,
      },
      signal: options.signal,
      body: JSON.stringify({
        model: AI_MODELS.chat,
        messages,
        stream: true,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 1400,
        reasoning_effort: 'low',
      }),
    })
    if (!res.ok) {
      const detail = await safeText(res)
      throw new AiUnavailableError(`Groq request failed (${res.status}). ${detail}`)
    }
    return res
  }

  throw new AiUnavailableError(
    'The AI assistant needs a Supabase project with the `chat` Edge Function deployed, or VITE_GROQ_API_KEY in .env.local. See Settings for the steps.',
  )
}

const JSON_HINT = 'When asked to return JSON, respond with a single valid JSON object and nothing else — no markdown fences, no prose before or after.'

async function readSse(
  body: ReadableStream<Uint8Array>,
  onToken?: (token: string) => void,
): Promise<string> {
  const reader = body.getReader()
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
      const line = part.split('\n').find(l => l.startsWith('data:'))
      if (!line) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue

      try {
        const parsed = JSON.parse(payload)
        // OpenAI/Groq compatible chunk shape (same for both routes).
        // `reasoning` deltas are intentionally ignored — only content tokens
        // are shown and counted as progress.
        const token: string =
          parsed?.choices?.[0]?.delta?.content ??
          parsed?.choices?.[0]?.message?.content ??
          ''
        if (token) {
          full += token
          onToken?.(token)
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

/**
 * Upload a recorded audio blob and get a transcript.
 *
 * Routes: Supabase Edge Function when configured (multipart → Whisper on the
 * server) → direct Groq upload when `VITE_GROQ_API_KEY` is set. Audio is
 * never stored anywhere; it goes straight to `whisper-large-v3-turbo` (the
 * cheapest Whisper on the account: $0.04/hr).
 */
export async function transcribeAudio(
  audio: Blob,
  options: { language?: string; signal?: AbortSignal } = {},
): Promise<string> {
  const form = new FormData()
  form.append('audio', audio, 'voice-message.webm')
  if (options.language) form.append('language', options.language)

  let res: Response
  if (isSupabaseConfigured) {
    // The Edge Function branches on multipart/form-data (transcribe) vs JSON
    // (chat) so only one route needs to be deployed. Do NOT set Content-Type
    // manually — the browser must add the multipart boundary.
    res = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY ?? '',
      },
      signal: options.signal,
      body: form,
    })
  } else if (DIRECT_KEY) {
    // Direct upload — Groq accepts the multipart body from the browser.
    const direct = new FormData()
    direct.append('file', audio, 'voice-message.webm')
    direct.append('model', AI_MODELS.transcribe)
    direct.append('response_format', 'json')
    if (options.language) direct.append('language', options.language)
    res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DIRECT_KEY}` },
      signal: options.signal,
      body: direct,
    })
  } else {
    throw new AiUnavailableError(
      'Transcription needs a Supabase project with the `chat` Edge Function deployed, or VITE_GROQ_API_KEY in .env.local. See Settings for the steps.',
    )
  }

  if (!res.ok) {
    const detail = await safeText(res)
    throw new AiUnavailableError(
      `Transcription failed (${res.status}). ${detail || 'Check the Edge Function and GROQ_API_KEY.'}`,
    )
  }

  try {
    const data = await res.json()
    const text = String(data?.text ?? '').trim()
    if (!text) throw new Error('Whisper heard no words — try again, closer to the mic.')
    return text
  } catch (e) {
    throw new AiUnavailableError(
      `Transcription returned no text. ${(e as Error).message}`,
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
  mode: aiMode,
  direct: directGroqEnabled,
  endpoint: isSupabaseConfigured ? endpoint() : directGroqEnabled ? 'https://api.groq.com/openai/v1 (direct, key in .env.local)' : null,
}