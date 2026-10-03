import { transcribeAudio } from './ai'

/**
 * Voice input that works everywhere — including iPad Safari, where the
 * Web Speech API is unreliable.
 *
 * Strategy (in order):
 *  1. MediaRecorder: capture the educator's voice as an audio blob.
 *  2. Groq Whisper (via the Edge Function): accurate, punctuation-aware
 *     transcription. This is the "transcribe icon" path.
 *  3. Browser speech recognition: free local fallback, no API credits.
 *  4. Puter.js (optional, Settings toggle): free user-pays chat + STT that
 *     costs this project's Groq account nothing.
 */

export type VoiceSource = 'groq-whisper' | 'browser' | 'puter'

export interface VoiceSettings {
  /** Default transcription path when the user holds the mic. */
  source: VoiceSource
  /** Optional Puter.js free-AI layer (Settings toggle, off by default). */
  puterEnabled: boolean
  /** Puter chat model id (e.g. gpt-5-nano). Only used when Puter is on. */
  puterModel: string
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  source: 'groq-whisper',
  puterEnabled: false,
  puterModel: 'gpt-5-nano',
}

const SETTINGS_KEY = 'hadfield:v1:voice-settings'

export function readVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return { ...DEFAULT_VOICE_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>
    return {
      source: parsed.source ?? DEFAULT_VOICE_SETTINGS.source,
      puterEnabled: parsed.puterEnabled ?? false,
      puterModel: parsed.puterModel || DEFAULT_VOICE_SETTINGS.puterModel,
    }
  } catch {
    return { ...DEFAULT_VOICE_SETTINGS }
  }
}

export function writeVoiceSettings(settings: VoiceSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

export const recorderSupported =
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined' &&
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia

function pickMimeType(): string {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') return ''
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
  return candidates.find(m => MediaRecorder.isTypeSupported(m)) ?? ''
}

/**
 * Records until `stop()` is called on the returned handle.
 * Resolves with the audio blob. Rejects on permission errors.
 */
export async function recordUntilStopped(onLevel?: (level: number) => void): Promise<{
  stop: () => Promise<Blob>
  cancel: () => void
}> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: Blob[] = []

  let raf = 0
  const analyser = wireLevelMeter(stream, onLevel)
  if (analyser) {
    const tick = () => {
      analyser.tick()
      raf = requestAnimationFrame(tick)
    }
    tick()
  }

  const done = new Promise<Blob>((resolve, reject) => {
    recorder.ondataavailable = e => {
      if (e.data.size > 0) chunks.push(e.data)
    }
    recorder.onstop = () => {
      cancelAnimationFrame(raf)
      stream.getTracks().forEach(t => t.stop())
      resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }))
    }
    recorder.onerror = () => reject(new Error('Recording failed.'))
  })

  recorder.start(250)

  let settled = false
  return {
    stop: () => {
      if (settled) return done
      settled = true
      recorder.stop()
      return done
    },
    cancel: () => {
      if (settled) return
      settled = true
      cancelAnimationFrame(raf)
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
      stream.getTracks().forEach(t => t.stop())
    },
  }
}

function wireLevelMeter(
  stream: MediaStream,
  onLevel?: (level: number) => void,
): { tick: () => void } | null {
  if (!onLevel) return null
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctx) return null
    const ctx = new Ctx()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    src.connect(analyser)
    const data = new Uint8Array(analyser.frequencyBinCount)
    return {
      tick: () => {
        analyser.getByteTimeDomainData(data)
        let peak = 0
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128
          if (v > peak) peak = v
        }
        onLevel(Math.min(1, peak * 1.6))
      },
    }
  } catch {
    return null
  }
}

/** Groq Whisper path — accurate, punctuation-aware, cheapest turbo model. */
export async function transcribeWithGroq(
  audio: Blob,
  signal?: AbortSignal,
): Promise<string> {
  return transcribeAudio(audio, { language: 'en', signal })
}

// ---------------------------------------------------------------------------
// Puter.js — optional free AI layer (user-pays, zero cost to this project).
// Loaded lazily from the CDN only when the Settings toggle is on.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    puter?: {
      ai: {
        chat: (
          prompt: string | unknown[],
          options?: Record<string, unknown>,
        ) => Promise<unknown>
        speech2txt: (
          source: unknown,
          options?: Record<string, unknown>,
        ) => Promise<unknown>
      }
    }
  }
}

let puterLoading: Promise<void> | null = null

export function loadPuter(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window.'))
  if (window.puter?.ai) return Promise.resolve()
  if (puterLoading) return puterLoading

  puterLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://js.puter.com/v2/'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      puterLoading = null
      reject(new Error('Could not load the Puter.js library. Check your connection.'))
    }
    document.head.appendChild(script)
  })
  return puterLoading
}

export async function transcribeWithPuter(audio: Blob): Promise<string> {
  await loadPuter()
  const puter = window.puter
  if (!puter?.ai?.speech2txt) throw new Error('Puter.js speech2txt is unavailable.')
  const file = new File([audio], 'voice-message.webm', {
    type: audio.type || 'audio/webm',
  })
  const result = (await puter.ai.speech2txt(file, {
    model: 'whisper-1',
    response_format: 'text',
  })) as unknown
  if (typeof result === 'string') return result.trim()
  const text = (result as { text?: unknown })?.text
  if (typeof text === 'string' && text.trim()) return text.trim()
  throw new Error('Puter transcription returned no text.')
}

export interface PuterStreamOptions {
  model?: string
  maxTokens?: number
  signal?: AbortSignal
  onToken?: (token: string) => void
}

/** Streaming chat through Puter.js (free, user-pays). */
export async function streamChatWithPuter(
  messages: { role: string; content: string }[],
  options: PuterStreamOptions = {},
): Promise<string> {
  await loadPuter()
  const puter = window.puter
  if (!puter?.ai?.chat) throw new Error('Puter.js chat is unavailable.')

  const completion = (await puter.ai.chat(messages, {
    model: options.model || 'gpt-5-nano',
    stream: true,
    ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
  })) as AsyncIterable<{ text?: string } | string>

  let full = ''
  for await (const part of completion) {
    if (options.signal?.aborted) break
    const token = typeof part === 'string' ? part : (part?.text ?? '')
    if (token) {
      full += token
      options.onToken?.(token)
    }
  }
  return full
}
