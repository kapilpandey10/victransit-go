import { beforeEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_VOICE_SETTINGS,
  readVoiceSettings,
  writeVoiceSettings,
} from './voice'

beforeEach(() => {
  localStorage.clear()
})

describe('voice settings persistence', () => {
  it('returns defaults when nothing is saved', () => {
    expect(readVoiceSettings()).toEqual(DEFAULT_VOICE_SETTINGS)
    expect(readVoiceSettings().source).toBe('groq-whisper') // Whisper by default
    expect(readVoiceSettings().puterEnabled).toBe(false)
  })

  it('round-trips settings', () => {
    writeVoiceSettings({
      source: 'browser',
      puterEnabled: true,
      puterModel: 'gpt-5-nano',
    })
    expect(readVoiceSettings()).toEqual({
      source: 'browser',
      puterEnabled: true,
      puterModel: 'gpt-5-nano',
    })
  })

  it('falls back to defaults on corrupt JSON', () => {
    localStorage.setItem('hadfield:v1:voice-settings', '{nope')
    const s = readVoiceSettings()
    expect(s.source).toBe('groq-whisper')
    expect(s.puterEnabled).toBe(false)
  })

  it('keeps a default Puter model when cleared', () => {
    writeVoiceSettings({ source: 'puter', puterEnabled: true, puterModel: '' })
    expect(readVoiceSettings().puterModel).toBe(
      DEFAULT_VOICE_SETTINGS.puterModel,
    )
  })
})