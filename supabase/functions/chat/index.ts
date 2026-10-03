// ---------------------------------------------------------------------------
// Hadfield Inquiry Planner — `chat` Edge Function.
//
// Secure proxy to the Groq API. The browser can never see the API key:
// GROQ_API_KEY lives in Supabase project secrets (supabase secrets set ...).
//
// Deploy:  supabase functions deploy chat --no-verify-jwt
// Secret:  supabase secrets set GROQ_API_KEY=gsk_...
// Routes (same path, branched on Content-Type):
//          application/json       -> streamed chat completion (SSE)
//          multipart/form-data    -> Whisper transcription (field "audio")
// ---------------------------------------------------------------------------

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const GROQ_API_BASE = 'https://api.groq.com/openai/v1'

/**
 * Cheapest verified models on this project's Groq account (checked against
 * GET /openai/v1/models). Client requests may ask for a model, but only these
 * values are ever forwarded — a typo or a pricey model can never be billed.
 */
const ALLOWED_CHAT_MODELS = new Set([
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
])
const DEFAULT_MODEL = 'openai/gpt-oss-20b'
const TRANSCRIBE_MODEL = 'whisper-large-v3-turbo'

/** The specialist system prompt behind every response. */
const SYSTEM_PROMPT = `You are the Inquiry Assistant for Hadfield Early Learning Centre in Australia.

You help early childhood educators with:
- inquiry-based curriculum planning and provocations,
- EYLF v2.0 Learning Outcomes (1 Identity, 2 Connectedness, 3 Wellbeing, 4 Learning, 5 Communication),
- learning stories, observations and documentation,
- the Reggio Emilia approach (hundred languages, environment as third teacher, emergent curriculum, pedagogical documentation),
- learning theories: Vygotsky (ZPD, scaffolding), Piaget (schemas), Montessori, Dewey, Bruner, Bronfenbrenner, Rogoff, Dweck, Kolb, Gardner, Froebel,
- family newsletters and program reflection.

House style:
- Warm, practical and concise. Busy educators, plain English, no jargon without explaining it.
- Use short paragraphs, bullets and Markdown headings.
- Reference EYLF outcomes and theorists by name where relevant.
- Strengths-based: describe what children CAN do. No deficit language.
- Never invent child observations. If asked for facts you are unsure of, say so.
- If the educator's message includes "Context from my current screen", use that context directly.
- Never request or store children's surnames or sensitive family details.`

const JSON_MODE_HINT = `\n\nWhen the user asks for JSON (or when a task instruction says "Return ONLY valid JSON"), respond with a single valid JSON object and nothing else — no fences, no prose before or after.`

type Role = 'system' | 'user' | 'assistant'

interface ChatMessage {
  role: Role
  content: string
}

interface ChatRequest {
  messages: ChatMessage[]
  mode?: 'chat' | 'json'
  stream?: boolean
  temperature?: number
  max_tokens?: number
  model?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Use POST.' }, 405)
  }

  const apiKey = Deno.env.get('GROQ_API_KEY')
  if (!apiKey) {
    return json(
      {
        error:
          'GROQ_API_KEY is not set on the Edge Function. Run: supabase secrets set GROQ_API_KEY=gsk_...',
      },
      500,
    )
  }

  // Multipart body = voice transcription request; JSON body = chat.
  // (Branching on Content-Type keeps a single deployable route, so there is
  // no dependence on sub-path routing behaviour.)
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    return handleTranscribe(req, apiKey)
  }

  let payload: ChatRequest
  try {
    payload = (await req.json()) as ChatRequest
  } catch {
    return json({ error: 'Expected a JSON body.' }, 400)
  }

  const incoming = Array.isArray(payload.messages) ? payload.messages : []
  // Defensive truncation: keep the system prompt + the last turns.
  const history = incoming
    .filter(m => m && typeof m.content === 'string' && m.content.length > 0)
    .slice(-20)
    .map(m => ({
      role:
        m.role === 'assistant'
          ? 'assistant'
          : m.role === 'system'
            ? 'system'
            : ('user' as Role),
      content: m.content.slice(0, 6000),
    })) as ChatMessage[]

  const mode = payload.mode === 'json' ? 'json' : 'chat'

  // Allow-list the model so only the cheapest verified models can be billed.
  const requested = typeof payload.model === 'string' ? payload.model : ''
  const model = ALLOWED_CHAT_MODELS.has(requested) ? requested : DEFAULT_MODEL

  const groqBody = {
    model,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT + (mode === 'json' ? JSON_MODE_HINT : ''),
      },
      ...history,
    ],
    temperature: clamp(payload.temperature ?? 0.7, 0, 1.5),
    max_tokens: clampInt(payload.max_tokens ?? 1400, 100, 8000),
    // gpt-oss models are reasoning models; 'low' keeps quality while
    // spending as few reasoning tokens as possible (cheapest verified value —
    // Groq accepts low|medium|high).
    reasoning_effort: 'low',
    stream: payload.stream !== false,
  }

  let groqRes: Response
  try {
    groqRes = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(groqBody),
    })
  } catch (err) {
    return json({ error: `Could not reach Groq: ${(err as Error).message}` }, 502)
  }

  if (!groqRes.ok || !groqRes.body) {
    const detail = await groqRes.text().catch(() => '')
    return json(
      { error: `Groq request failed (${groqRes.status}). ${detail.slice(0, 400)}` },
      502,
    )
  }

  if (payload.stream === false) {
    const data = await groqRes.json().catch(() => null)
    const content: string =
      data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.delta?.content ?? ''
    return new Response(content, {
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  // Streaming path: forward Groq's SSE bytes straight to the client.
  return new Response(groqRes.body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})

/**
 * POST multipart/form-data with an "audio" field (a Blob/File) and an
 * optional "language" field (e.g. "en").
 *
 * Cost control: the audio field is capped at ~25 MB (matches the Whisper
 * limit), is never stored, and always uses the cheapest Whisper model.
 */
async function handleTranscribe(req: Request, apiKey: string): Promise<Response> {
  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return json({ error: 'Expected multipart form data with an "audio" file.' }, 400)
  }

  const audio = form.get('audio')
  if (!(audio instanceof File)) {
    return json({ error: 'Missing "audio" file field.' }, 400)
  }

  if (audio.size > 25 * 1024 * 1024) {
    return json(
      { error: 'Audio is too large (max 25 MB). Record a shorter message.' },
      413,
    )
  }

  const language = form.get('language')
  const out = new FormData()
  out.append('file', audio, audio.name || 'voice-message.webm')
  out.append('model', TRANSCRIBE_MODEL)
  out.append('response_format', 'json')
  if (typeof language === 'string' && /^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
    out.append('language', language)
  }

  let groqRes: Response
  try {
    groqRes = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: out,
    })
  } catch (err) {
    return json({ error: `Could not reach Groq: ${(err as Error).message}` }, 502)
  }

  if (!groqRes.ok) {
    const detail = await groqRes.text().catch(() => '')
    return json(
      { error: `Transcription failed (${groqRes.status}). ${detail.slice(0, 400)}` },
      502,
    )
  }

  const data = await groqRes.json().catch(() => null)
  const text = String(data?.text ?? '').trim()
  return json({ text })
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function clampInt(value: number, min: number, max: number): number {
  return Math.round(clamp(value, min, max))
}
