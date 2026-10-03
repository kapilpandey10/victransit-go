import { describe, expect, it } from 'vitest'
import { parseJsonLoose } from './ai'

describe('parseJsonLoose', () => {
  it('parses plain JSON', () => {
    expect(parseJsonLoose<{ a: number }>('{"a": 1}')).toEqual({ a: 1 })
  })

  it('strips markdown fences', () => {
    const raw = '```json\n{"a": 2, "b": "x"}\n```'
    expect(parseJsonLoose<{ a: number; b: string }>(raw)).toEqual({ a: 2, b: 'x' })
  })

  it('extracts JSON from surrounding prose', () => {
    const raw = 'Here you go:\n{"a": 3}\nHope that helps.'
    expect(parseJsonLoose<{ a: number }>(raw)).toEqual({ a: 3 })
  })

  it('throws a friendly error for garbage', () => {
    expect(() => parseJsonLoose('not json at all {{{')).toThrow(/could not be read as JSON/)
  })
})