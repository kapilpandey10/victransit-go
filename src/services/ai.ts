import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './supabase'

/**
 * Client for AI Completions and Audio Transcription.
 *
 * Supports dual backends:
 * 1. Direct Groq API (`VITE_GROQ_API_KEY` in `.env.local`): zero-latency, works out-of-the-box.
 * 2. Supabase Edge Function (`chat`): serverless proxy where key stays server-side.
 *
 * Automatically falls back between backends so educators never experience "Failed to fetch".
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
 */
export const AI_MODELS = {
  chat: 'openai/gpt-oss-20b',
  chatFallback: 'openai/gpt-oss-120b',
  transcribe: 'whisper-large-v3-turbo',
} as const

const DIRECT_KEY = (import.meta.env.VITE_GROQ_API_KEY as string) || ''
export const directGroqEnabled = !!DIRECT_KEY
export const aiMode: 'edge-function' | 'direct' | 'unavailable' = DIRECT_KEY
  ? 'direct'
  : isSupabaseConfigured
    ? 'edge-function'
    : 'unavailable'

/** Compact system prompt used on the direct path. */
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

const JSON_HINT = 'When asked to return JSON, respond with a single valid JSON object and nothing else — no markdown fences, no prose before or after.'

/**
 * Direct call to Groq API using VITE_GROQ_API_KEY.
 */
async function callDirectGroq(options: AiCallOptions): Promise<Response> {
  const isJson = options.mode === 'json'
  const hasSystem = options.messages.some(m => m.role === 'system')

  const messages: AiMessage[] = []
  if (isJson) {
    messages.push({ role: 'system', content: JSON_HINT })
  }
  if (!hasSystem) {
    messages.push({ role: 'system', content: DIRECT_SYSTEM_PROMPT })
  }
  for (const m of options.messages) {
    messages.push({
      role: m.role === 'system' ? 'system' : (m.role as 'user' | 'assistant'),
      content: m.content,
    })
  }

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
    }),
  })

  if (!res.ok) {
    const detail = await safeText(res)
    throw new AiUnavailableError(`Groq request failed (${res.status}). ${detail}`)
  }
  return res
}

/**
 * Call Supabase Edge Function proxy.
 */
async function callEdgeFunctionChat(options: AiCallOptions): Promise<Response> {
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

/**
 * Streams a chat completion. Tokens are emitted through `onToken` as they
 * arrive. Returns the full concatenated text.
 */
export async function streamChat(options: AiCallOptions): Promise<string> {
  const res = await openChatStream(options)
  if (!res || !res.body) {
    throw new AiUnavailableError(
      'No AI backend is available. Add VITE_GROQ_API_KEY in .env.local or deploy the `chat` Edge Function to Supabase.',
    )
  }
  return readSse(res.body, options.onToken)
}

async function openChatStream(options: AiCallOptions): Promise<Response> {
  // If DIRECT_KEY is configured in .env.local, use direct Groq for instant, zero-latency inference:
  if (DIRECT_KEY) {
    try {
      return await callDirectGroq(options)
    } catch (err) {
      console.warn('Direct Groq failed, attempting Edge Function fallback:', err)
      if (isSupabaseConfigured) {
        try {
          return await callEdgeFunctionChat(options)
        } catch (edgeErr) {
          console.warn('Edge function also failed:', edgeErr)
        }
      }
      throw err
    }
  }

  // If no direct key, use Supabase Edge Function
  if (isSupabaseConfigured) {
    try {
      return await callEdgeFunctionChat(options)
    } catch (edgeErr) {
      throw new AiUnavailableError(
        `The Supabase Edge Function is not reachable: ${(edgeErr as Error).message}. Deploy the \`chat\` Edge Function to Supabase or add VITE_GROQ_API_KEY to .env.local.`,
      )
    }
  }

  throw new AiUnavailableError(
    'The AI assistant needs VITE_GROQ_API_KEY in .env.local, or a deployed Supabase `chat` Edge Function.',
  )
}

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
 */
export async function transcribeAudio(
  audio: Blob,
  options: { language?: string; signal?: AbortSignal } = {},
): Promise<string> {
  const callDirect = async (): Promise<Response> => {
    const direct = new FormData()
    direct.append('file', audio, 'voice-message.webm')
    direct.append('model', AI_MODELS.transcribe)
    direct.append('response_format', 'json')
    if (options.language) direct.append('language', options.language)
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${DIRECT_KEY}` },
      signal: options.signal,
      body: direct,
    })
    if (!res.ok) {
      const detail = await safeText(res)
      throw new AiUnavailableError(`Transcription failed (${res.status}). ${detail}`)
    }
    return res
  }

  const callEdge = async (): Promise<Response> => {
    const form = new FormData()
    form.append('audio', audio, 'voice-message.webm')
    if (options.language) form.append('language', options.language)

    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY ?? '',
      },
      signal: options.signal,
      body: form,
    })
    if (!res.ok) {
      const detail = await safeText(res)
      throw new AiUnavailableError(`Transcription failed (${res.status}). ${detail}`)
    }
    return res
  }

  let res: Response
  if (DIRECT_KEY) {
    try {
      res = await callDirect()
    } catch (directErr) {
      if (isSupabaseConfigured) {
        res = await callEdge()
      } else {
        throw directErr
      }
    }
  } else if (isSupabaseConfigured) {
    res = await callEdge()
  } else {
    throw new AiUnavailableError(
      'Transcription needs VITE_GROQ_API_KEY in .env.local or the `chat` Edge Function deployed.',
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
  configured: isSupabaseConfigured || directGroqEnabled,
  mode: aiMode,
  direct: directGroqEnabled,
  endpoint: DIRECT_KEY
    ? 'https://api.groq.com/openai/v1 (direct Groq, key in .env.local)'
    : isSupabaseConfigured
      ? endpoint()
      : null,
}