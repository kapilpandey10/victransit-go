import { computed, ref } from 'vue'
import { useSpeechInput } from './useSpeech'
import {
  DEFAULT_VOICE_SETTINGS,
  readVoiceSettings,
  recorderSupported,
  recordUntilStopped,
  transcribeWithGroq,
  transcribeWithPuter,
  writeVoiceSettings,
  type VoiceSettings,
  type VoiceSource,
} from '@/services/voice'

/**
 * Unified voice input for the chat dock:
 *
 * - groq-whisper (default): hold-to-record mic → Whisper transcription with a
 *   ✍️ transcribe icon state. Works on iPad Safari.
 * - browser: free on-device Web Speech recognition, zero credits.
 * - puter: Puter.js transcription, free user-pays layer.
 */
export function useVoice() {
  const settings = ref<VoiceSettings>(readVoiceSettings())
  const browser = useSpeechInput({ lang: 'en-AU' })

  const recording = ref(false)
  const transcribing = ref(false)
  const level = ref(0)
  const error = ref<string | null>(null)
  const lastTranscript = ref('')

  let handle: { stop: () => Promise<Blob>; cancel: () => void } | null = null
  let aborter: AbortController | null = null

  const busy = computed(() => recording.value || transcribing.value)
  const canRecord = computed(() => recorderSupported)

  function setSource(source: VoiceSource) {
    settings.value = { ...settings.value, source }
    writeVoiceSettings(settings.value)
  }

  function setPuter(enabled: boolean, model?: string) {
    settings.value = {
      ...settings.value,
      puterEnabled: enabled,
      puterModel: model?.trim() || settings.value.puterModel,
      source: enabled ? settings.value.source : 'groq-whisper',
    }
    writeVoiceSettings(settings.value)
  }

  function resetTranscript() {
    lastTranscript.value = ''
    browser.reset()
  }

  /** Browser path: hands free continuous recognition. */
  function toggleBrowser() {
    error.value = null
    browser.toggle()
  }

  /** Recording path: start capturing audio. */
  async function startRecording() {
    error.value = null
    if (recording.value || transcribing.value) return
    if (!recorderSupported) {
      error.value = 'This browser cannot record audio. The free speech option may still work.'
      return
    }
    try {
      handle = await recordUntilStopped(l => (level.value = l))
      recording.value = true
    } catch (e) {
      error.value =
        (e as Error).name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : `Could not start recording: ${(e as Error).message}`
    }
  }

  /** Stop recording and transcribe with the configured provider. */
  async function stopAndTranscribe(): Promise<string> {
    if (!handle) return lastTranscript.value
    const current = handle
    handle = null
    recording.value = false
    transcribing.value = true
    aborter = new AbortController()
    try {
      const audio = await current.stop()
      if (audio.size < 1000) {
        lastTranscript.value = ''
        return ''
      }
      const source = settings.value.source
      const text =
        source === 'puter' && settings.value.puterEnabled
          ? await transcribeWithPuter(audio)
          : await transcribeWithGroq(audio, aborter.signal)
      lastTranscript.value = text
      return text
    } catch (e) {
      if ((e as Error).name === 'AbortError') return lastTranscript.value
      error.value = `Transcription failed: ${(e as Error).message}`
      return lastTranscript.value
    } finally {
      transcribing.value = false
      aborter = null
      level.value = 0
    }
  }

  function cancel() {
    handle?.cancel()
    handle = null
    aborter?.abort()
    recording.value = false
    transcribing.value = false
    level.value = 0
  }

  return {
    settings,
    browser,
    recording,
    transcribing,
    busy,
    level,
    error,
    lastTranscript,
    canRecord,
    setSource,
    setPuter,
    resetTranscript,
    toggleBrowser,
    startRecording,
    stopAndTranscribe,
    cancel,
    defaults: DEFAULT_VOICE_SETTINGS,
  }
}
