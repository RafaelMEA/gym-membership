import type { RowDataPacket } from 'mysql2'
import type { ZodError } from 'zod'
import { pool } from '../../config/db.js'
import type { SubscriptionRow } from '../subscriptions/subscriptions.repository.js'

// ─────────────────────────────────────────────────────────────
// Shared display helpers for the server-rendered pages.
// Controllers prepare view-ready values; EJS templates stay dumb.
// ─────────────────────────────────────────────────────────────

export interface StaffLocal {
  id: number
  full_name: string
  email: string
  role: string
}

/** Flash message banner, driven by redirect query params (PRG). */
export interface Toast {
  kind: 'success' | 'error'
  text: string
}

/**
 * State of a modal form on a page.
 *
 * Pages render the modal in the DOM even when closed, so plain JS can
 * open it. On a failed POST the controller re-renders the page with
 * `open: true`, the submitted values, and per-field error messages —
 * the user never loses their input.
 */
export interface FormState {
  open: boolean
  action: string
  submitLabel: string
  subtitle: string
  values: Record<string, string>
  fieldErrors: Record<string, string>
  message?: string
}

// ── formatting ──────────────────────────────────────────────

export const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
})

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** '2026-11-20' -> 'Nov 20, 2026' */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return iso
  const month = MONTHS[m - 1]
  if (month === undefined) return iso
  return `${month} ${d}, ${y}`
}

/** '2026-11-14 08:30:12' -> '08:30' (dateStrings: true DATETIME format) */
export function formatTime(dt: string | null): string | null {
  return dt === null ? null : dt.slice(11, 16)
}

/** '2026-11-14 08:30:12' -> 'Nov 14, 2026 · 08:30' */
export function formatDateTime(dt: string | null): string | null {
  if (dt === null) return null
  const time = formatTime(dt)
  return `${formatDate(dt.slice(0, 10))}${time ? ` · ${time}` : ''}`
}

/** Minutes between two DATETIME strings, both from the DB clock. */
export function minutesBetween(from: string, to: string): number {
  const a = Date.parse(from.replace(' ', 'T') + 'Z')
  const b = Date.parse(to.replace(' ', 'T') + 'Z')
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.max(0, Math.round((b - a) / 60000))
}

/** 95 -> '1h 35m' */
export function formatDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** 'Juan Dela Cruz' -> 'JD' */
export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

/** Today's date from the DB clock, like everywhere else in the app. */
export async function getToday(): Promise<string> {
  const [rows] = await pool.execute('SELECT CURDATE() AS today')
  const row = (rows as Array<{ today: string } & RowDataPacket>)[0]
  if (!row?.today) {
    throw new Error('Failed to get CURDATE() from database')
  }
  return row.today
}

/** Current DB timestamp — used for elapsed-time display. */
export async function getNow(): Promise<string> {
  const [rows] = await pool.execute('SELECT NOW() AS now')
  const row = (rows as Array<{ now: string } & RowDataPacket>)[0]
  if (!row?.now) {
    throw new Error('Failed to get NOW() from database')
  }
  return row.now
}

// ── zod / body helpers ──────────────────────────────────────

/** ZodError -> { fieldName: firstMessage } for inline form errors. */
export function zodFieldErrors(err: ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form'
    if (!out[key]) out[key] = issue.message
  }
  return out
}

/** Safely read a string field out of req.body / req.query. */
export function str(source: unknown, key: string): string {
  const obj = (source ?? {}) as Record<string, unknown>
  return typeof obj[key] === 'string' ? (obj[key] as string) : ''
}

// ── flash + chips ───────────────────────────────────────────

/**
 * Build a toast from redirect query flags.
 * `messages` maps flag -> text, e.g. { created: 'Member added.' }.
 * A bare `?error=<text>` always becomes an error toast.
 */
export function flashToast(query: unknown, messages: Record<string, string>): Toast | null {
  const q = (query ?? {}) as Record<string, unknown>
  for (const [flag, text] of Object.entries(messages)) {
    if (q[flag] !== undefined) {
      return { kind: flag === 'error' ? 'error' : 'success', text }
    }
  }
  if (typeof q.error === 'string' && q.error !== '') {
    return { kind: 'error', text: q.error }
  }
  return null
}

export type ChipColor = 'green' | 'blue' | 'gray' | 'red'

export const CHIP: Record<ChipColor, string> = {
  green: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/40',
  blue: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/40',
  gray: 'bg-zinc-800 text-zinc-400',
  red: 'bg-brand-600/15 text-brand-400 ring-1 ring-brand-600/40',
}

/**
 * What a subscription row MEANS for display: the DB `status` alone
 * lies — an 'active' row whose end_date has passed is really ended.
 */
export function subState(
  s: SubscriptionRow,
  today: string,
): { label: string; chip: ChipColor } {
  if (s.status === 'cancelled') return { label: 'Cancelled', chip: 'gray' }
  if (s.status === 'frozen') return { label: 'Frozen', chip: 'blue' }
  return s.end_date > today
    ? { label: 'Active', chip: 'green' }
    : { label: 'Ended', chip: 'gray' }
}
