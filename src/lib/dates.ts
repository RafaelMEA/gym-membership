/**
 * Pure date helpers for membership periods.
 *
 * Two rules this file exists to enforce:
 *
 *  1. A membership period is a HALF-OPEN interval [start, end).
 *     `end_date` is the first day the membership NO LONGER covers.
 *
 *  2. Month/year arithmetic must CLAMP to the last day of the target
 *     month. 2026-01-31 + 1 month is 2026-02-28, not 2026-03-03.
 *     Naive `Date.setUTCMonth()` silently rolls over into March
 *     because "February 31" does not exist.
 *
 * Everything here is pure string/integer math on 'YYYY-MM-DD'.
 * No `Date` objects are constructed from local time, so there is no
 * timezone drift: a DATE column means the same calendar day
 * everywhere.
 */

export type DurationUnit = 'day' | 'week' | 'month' | 'year'

export interface IsoDate {
  year: number
  month: number // 1-12
  day: number // 1-31
}

/** Parse 'YYYY-MM-DD' into its parts. Throws on anything malformed. */
export function parseIsoDate(value: string): IsoDate {
  const parts = value.split('-')
  if (parts.length !== 3) {
    throw new Error(`Invalid ISO date "${value}" — expected YYYY-MM-DD`)
  }
  const [y, m, d] = parts.map(Number)
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`Invalid ISO date "${value}" — expected YYYY-MM-DD`)
  }
  return { year: y, month: m, day: d }
}

/** Format parts back into 'YYYY-MM-DD'. */
export function formatIsoDate({ year, month, day }: IsoDate): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${year}-${pad(month)}-${pad(day)}`
}

/** Number of days in a given month. month is 1-12. */
export function daysInMonth(year: number, month: number): number {
  // Day 0 of the next month is the last day of this month.
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * Add a duration to a date, clamping to the end of the target month.
 *
 *   addDuration('2026-01-31', 1, 'month') === '2026-02-28'
 *   addDuration('2028-02-29', 1, 'year')  === '2029-02-28'
 */
export function addDuration(start: string, value: number, unit: DurationUnit): string {
  const { year, month, day } = parseIsoDate(start)

  if (unit === 'day' || unit === 'week') {
    const days = unit === 'week' ? value * 7 : value
    const dt = new Date(Date.UTC(year, month - 1, day))
    dt.setUTCDate(dt.getUTCDate() + days)
    return dt.toISOString().slice(0, 10)
  }

  // month / year — work out the target year+month, then clamp the day.
  let targetYear = year
  let targetMonth = month
  if (unit === 'month') {
    const totalMonths = year * 12 + (month - 1) + value
    targetYear = Math.floor(totalMonths / 12)
    targetMonth = (totalMonths % 12) + 1
  } else {
    targetYear = year + value
  }

  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return formatIsoDate({ year: targetYear, month: targetMonth, day: clampedDay })
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
  const a = parseIsoDate(from)
  const b = parseIsoDate(to)
  const ms = Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)
  return Math.round(ms / 86_400_000)
}
