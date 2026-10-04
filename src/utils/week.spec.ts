import { describe, expect, it } from 'vitest'
import {
  addDays,
  currentWeek,
  formatWeek,
  isSameWeek,
  isoDate,
  shiftWeek,
  startOfWeek,
  weekFromKey,
} from './week'

describe('week utilities', () => {
  it('identifies Monday as the start of the week for weekdays', () => {
    // Wednesday 2026-10-07
    const wed = new Date(2026, 9, 7)
    const mon = startOfWeek(wed)
    expect(mon.getFullYear()).toBe(2026)
    expect(mon.getMonth()).toBe(9) // October
    expect(mon.getDate()).toBe(5) // Mon Oct 5
  })

  it('identifies Monday as start of week for Sunday (belonging to preceding Mon-Fri)', () => {
    // Sunday 2026-10-11
    const sun = new Date(2026, 9, 11)
    const mon = startOfWeek(sun)
    expect(mon.getDate()).toBe(5) // Mon Oct 5
  })

  it('identifies Monday as start of week for Saturday', () => {
    // Saturday 2026-10-10
    const sat = new Date(2026, 9, 10)
    const mon = startOfWeek(sat)
    expect(mon.getDate()).toBe(5) // Mon Oct 5
  })

  it('formats dates into ISO YYYY-MM-DD correctly', () => {
    const d = new Date(2026, 0, 5) // 5 Jan 2026
    expect(isoDate(d)).toBe('2026-01-05')
  })

  it('adds days correctly across month boundaries', () => {
    const endOfMonth = new Date(2026, 0, 31) // 31 Jan
    const nextDay = addDays(endOfMonth, 1)
    expect(isoDate(nextDay)).toBe('2026-02-01')
  })

  it('determines if two dates are in the same week', () => {
    const wed = new Date(2026, 9, 7)
    const fri = new Date(2026, 9, 9)
    const nextMon = new Date(2026, 9, 12)
    expect(isSameWeek(wed, fri)).toBe(true)
    expect(isSameWeek(wed, nextMon)).toBe(false)
  })

  it('builds a full week range with 5 weekdays and 2 closed weekend days', () => {
    const anchor = new Date(2026, 9, 7)
    const range = formatWeek(anchor)

    expect(range.days).toHaveLength(5)
    expect(range.days.map(d => d.key)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri'])
    expect(range.closed).toHaveLength(2)
    expect(range.closed[0].label).toBe('Sat')
    expect(range.closed[1].label).toBe('Sun')
    expect(range.weekKey).toBe('2026-10-05')
    expect(range.label).toContain('Oct')
  })

  it('shifts weeks accurately forwards and backwards', () => {
    const anchor = new Date(2026, 9, 5)
    const nextWeek = shiftWeek(anchor, 1)
    expect(isoDate(nextWeek)).toBe('2026-10-12')

    const prevWeek = shiftWeek(anchor, -1)
    expect(isoDate(prevWeek)).toBe('2026-09-28')
  })

  it('parses week from key string', () => {
    const range = weekFromKey('2026-10-05')
    expect(range.weekKey).toBe('2026-10-05')
    expect(range.days[0].iso).toBe('2026-10-05')
    expect(range.days[4].iso).toBe('2026-10-09')
  })

  it('currentWeek returns a valid WeekRange', () => {
    const curr = currentWeek()
    expect(curr.days).toHaveLength(5)
    expect(curr.weekKey).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
