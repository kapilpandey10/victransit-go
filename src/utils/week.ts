/**
 * Week/date helpers for the Weekly Wrap-Up tool.
 *
 * Weeks run Monday → Friday (centre open). Saturday & Sunday are always shown
 * as "closed". All maths is done in the *local* timezone so the educator's
 * Monday is the storage key.
 */

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri'

export interface WeekDay {
  key: DayKey
  label: string
  short: string
  date: Date
  iso: string
}

export interface WeekRange {
  /** Monday of the week (local midnight). */
  monday: Date
  friday: Date
  saturday: Date
  sunday: Date
  days: WeekDay[]
  /** Sat + Sun, shown greyed out as centre-closed. */
  closed: { label: string; iso: string }[]
  /** e.g. "Mon 6 Oct – Fri 10 Oct 2026" */
  label: string
  /** Storage key: YYYY-MM-DD of the Monday. */
  weekKey: string
  year: number
}

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri']

export function startOfWeek(input: Date): Date {
  const d = new Date(input.getFullYear(), input.getMonth(), input.getDate())
  const dow = d.getDay() // 0 Sun … 6 Sat
  // Monday-based: Sunday belongs to the week that started the previous Monday.
  const offset = dow === 0 ? -6 : 1 - dow
  d.setDate(d.getDate() + offset)
  return d
}

export function addDays(input: Date, amount: number): Date {
  const d = new Date(input.getFullYear(), input.getMonth(), input.getDate())
  d.setDate(d.getDate() + amount)
  return d
}

export function isoDate(input: Date): string {
  const m = String(input.getMonth() + 1).padStart(2, '0')
  const day = String(input.getDate()).padStart(2, '0')
  return `${input.getFullYear()}-${m}-${day}`
}

export function isSameWeek(a: Date, b: Date): boolean {
  return isoDate(startOfWeek(a)) === isoDate(startOfWeek(b))
}

const DAY_LABELS: Record<DayKey, { long: string; short: string }> = {
  mon: { long: 'Monday', short: 'Mon' },
  tue: { long: 'Tuesday', short: 'Tue' },
  wed: { long: 'Wednesday', short: 'Wed' },
  thu: { long: 'Thursday', short: 'Thu' },
  fri: { long: 'Friday', short: 'Fri' },
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function shortDay(d: Date): string {
  return d.toLocaleDateString('en-AU', { weekday: 'short' })
}

/** Build the full Mon–Fri (+ closed weekend) view for a week. */
export function formatWeek(anchor: Date): WeekRange {
  const monday = startOfWeek(anchor)
  const days: WeekDay[] = DAY_KEYS.map((key, i) => {
    const date = addDays(monday, i)
    return {
      key,
      label: DAY_LABELS[key].long,
      short: DAY_LABELS[key].short,
      date,
      iso: isoDate(date),
    }
  })
  const friday = days[4].date
  const saturday = addDays(monday, 5)
  const sunday = addDays(monday, 6)

  return {
    monday,
    friday,
    saturday,
    sunday,
    days,
    closed: [
      { label: 'Sat', iso: isoDate(saturday) },
      { label: 'Sun', iso: isoDate(sunday) },
    ],
    label: `${shortDay(monday)} ${shortDate(monday)} – ${shortDay(friday)} ${shortDate(friday)} ${friday.getFullYear()}`,
    weekKey: isoDate(monday),
    year: friday.getFullYear(),
  }
}

/** Shift a week anchor by ± whole weeks. */
export function shiftWeek(anchor: Date, weeks: number): Date {
  const monday = startOfWeek(anchor)
  return addDays(monday, weeks * 7)
}

/** "This week" = the week containing today (works on Sat/Sun too). */
export function currentWeek(): WeekRange {
  return formatWeek(new Date())
}

/** Parse a stored YYYY-MM-DD key into a week range. */
export function weekFromKey(key: string): WeekRange {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return currentWeek()
  return formatWeek(new Date(y, m - 1, d))
}