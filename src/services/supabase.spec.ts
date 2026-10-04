import { beforeEach, describe, expect, it } from 'vitest'
import {
  checkIsSupabaseConfigured,
  clearSupabaseCredentials,
  getActiveSupabaseAnonKey,
  getActiveSupabaseUrl,
  setSupabaseCredentials,
  testSupabaseConnection,
} from './supabase'

beforeEach(() => {
  localStorage.clear()
  clearSupabaseCredentials()
})

describe('supabase service credentials and testing', () => {
  it('returns default Supabase URL when no custom URL is saved', () => {
    const url = getActiveSupabaseUrl()
    expect(url).toContain('https://')
    expect(url).toContain('supabase.co')
  })

  it('detects unconfigured status when anon key is missing or placeholder', () => {
    expect(checkIsSupabaseConfigured()).toBe(false)
  })

  it('persists credentials into localStorage and marks configured', () => {
    const mockKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockPayloadSignature1234567890'
    const mockUrl = 'https://custom-project.supabase.co'

    setSupabaseCredentials(mockUrl, mockKey)

    expect(getActiveSupabaseUrl()).toBe(mockUrl)
    expect(getActiveSupabaseAnonKey()).toBe(mockKey)
    expect(checkIsSupabaseConfigured()).toBe(true)
  })

  it('clears credentials on clearSupabaseCredentials', () => {
    const mockKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockPayloadSignature1234567890'
    setSupabaseCredentials('https://custom.supabase.co', mockKey)
    expect(checkIsSupabaseConfigured()).toBe(true)

    clearSupabaseCredentials()
    expect(getActiveSupabaseAnonKey()).toBe('')
    expect(checkIsSupabaseConfigured()).toBe(false)
  })

  it('validates URL format before attempting live connection', async () => {
    const res = await testSupabaseConnection('not-a-url', 'some-short-key')
    expect(res.ok).toBe(false)
    expect(res.code).toBe('INVALID_URL')
  })

  it('rejects short or missing anon key before attempting live connection', async () => {
    const res = await testSupabaseConnection('https://zcslgqitzkmxwusrqlsu.supabase.co', 'too-short')
    expect(res.ok).toBe(false)
    expect(res.code).toBe('INVALID_KEY')
  })
})
