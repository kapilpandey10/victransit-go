import { computed, ref } from 'vue'

/**
 * Speech-to-text and text-to-speech helpers.
 *
 * Speech recognition uses the browser Web Speech API (best support in
 * Safari on iPadOS and Chrome). Grammar is friendly-degraded: when unsupported
 * the UI hides the microphone rather than breaking.
 */

interface SpeechRecognitionLike extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string; confidence: number }
  } & { length: number }>
}

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function useSpeechInput(options: { lang?: string } = {}) {
  const Ctor = getRecognitionCtor()
  const supported = Boolean(Ctor)
  const listening = ref(false)
  const transcript = ref('')
  const interim = ref('')
  const error = ref<string | null>(null)

  let recognition: SpeechRecognitionLike | null = null

  function ensure() {
    if (!Ctor) return null
    if (recognition) return recognition
    recognition = new Ctor()
    recognition.lang = options.lang ?? 'en-AU'
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = event => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) finalText += text
        else interimText += text
      }
      if (finalText) transcript.value = `${transcript.value} ${finalText}`.trim()
      interim.value = interimText
    }
    recognition.onerror = e => {
      error.value =
        e.error === 'not-allowed'
          ? 'Microphone permission was denied.'
          : `Speech error: ${e.error}`
      listening.value = false
    }
    recognition.onend = () => {
      listening.value = false
      interim.value = ''
    }
    return recognition
  }

  function start() {
    const rec = ensure()
    if (!rec) {
      error.value = 'This browser does not support speech recognition.'
      return
    }
    error.value = null
    try {
      rec.start()
      listening.value = true
    } catch {
      // start() throws if already running — ignore.
      listening.value = true
    }
  }

  function stop() {
    recognition?.stop()
    listening.value = false
  }

  function toggle() {
    if (listening.value) stop()
    else start()
  }

  function reset() {
    transcript.value = ''
    interim.value = ''
  }

  /** Everything captured so far, including any live interim text. */
  const fullText = computed(() =>
    `${transcript.value} ${interim.value}`.trim(),
  )

  return {
    supported,
    listening,
    transcript,
    interim,
    fullText,
    error,
    start,
    stop,
    toggle,
    reset,
  }
}

export function useSpeechOutput() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const speaking = ref(false)

  function speak(text: string, lang = 'en-AU') {
    if (!supported || !text) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = 1
    utterance.onend = () => (speaking.value = false)
    utterance.onerror = () => (speaking.value = false)
    speaking.value = true
    window.speechSynthesis.speak(utterance)
  }

  function stop() {
    if (!supported) return
    window.speechSynthesis.cancel()
    speaking.value = false
  }

  return { supported, speaking, speak, stop }
}