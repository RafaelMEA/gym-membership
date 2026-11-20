import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import * as memberRepo from '../members/member.repository.js'
import type { MemberRow } from '../members/member.repository.js'
import * as memberService from '../members/member.service.js'
import * as subRepo from '../subscriptions/subscriptions.repository.js'
import * as attendanceRepo from '../attendance/attendance.repository.js'
import * as paymentRepo from '../payments/payments.repository.js'
import * as planRepo from '../plans/plans.repository.js'
import { AppError } from '../../middleware/error.js'
import { addDuration, daysBetween, daysInMonth } from '../../lib/dates.js'
import { renderPage } from './render.js'
import {
  CHIP,
  flashToast,
  formatDate,
  formatDateTime,
  formatTime,
  getToday,
  initialsOf,
  peso,
  str,
  subState,
  zodFieldErrors,
  type ChipColor,
  type FormState,
  type StaffLocal,
  type Toast,
} from './view.js'

// ─────────────────────────────────────────────────────────────
// Modal form state builders
// ─────────────────────────────────────────────────────────────

type MemberValues = Record<string, string>

function emptyMemberValues(): MemberValues {
  return { first_name: '', last_name: '', email: '', phone: '', gender: 'undisclosed' }
}

function memberValuesFrom(member: MemberRow): MemberValues {
  return {
    first_name: member.first_name,
    last_name: member.last_name,
    email: member.email,
    phone: member.phone ?? '',
    gender: member.gender,
  }
}

/** urlencoded bodies are all strings — normalize for re-render. */
function memberValuesFromBody(body: unknown): MemberValues {
  return {
    first_name: str(body, 'first_name'),
    last_name: str(body, 'last_name'),
    email: str(body, 'email'),
    phone: str(body, 'phone'),
    gender: str(body, 'gender') || 'undisclosed',
  }
}

function createForm(
  values: MemberValues,
  opts: { open?: boolean; fieldErrors?: Record<string, string>; message?: string },
): FormState {
  return {
    open: opts.open ?? false,
    action: '/members',
    submitLabel: 'Add member',
    subtitle: 'A membership number is generated automatically.',
    values,
    fieldErrors: opts.fieldErrors ?? {},
    message: opts.message,
  }
}

function editForm(
  memberId: number,
  values: MemberValues,
  opts: { open?: boolean; fieldErrors?: Record<string, string>; message?: string },
): FormState {
  return {
    open: opts.open ?? false,
    action: `/members/${memberId}`,
    submitLabel: 'Save changes',
    subtitle: 'Update the member’s contact details.',
    values,
    fieldErrors: opts.fieldErrors ?? {},
    message: opts.message,
  }
}

// ─────────────────────────────────────────────────────────────
// Members list
// ─────────────────────────────────────────────────────────────

interface MembersPageView {
  staff: StaffLocal
  q: string
  toast: Toast | null
  form: FormState
}

async function renderMembersPage(res: Response, view: MembersPageView): Promise<void> {
  const members = await memberRepo.findAll()

  const q = view.q.trim().toLowerCase()
  const filtered =
    q === ''
      ? members
      : members.filter((m) =>
          `${m.first_name} ${m.last_name} ${m.email} ${m.membership_no}`
            .toLowerCase()
            .includes(q),
        )

  await renderPage(res, 'members/list.ejs', {
    title: 'Members',
    activeNav: 'members',
    staff: view.staff,
    q: view.q,
    totalCount: members.length,
    members: filtered.map((m) => {
      const name = `${m.first_name} ${m.last_name}`
      return {
        id: m.id,
        membershipNo: m.membership_no,
        name,
        email: m.email,
        phone: m.phone,
        initials: initialsOf(name),
      }
    }),
    toast: view.toast,
    form: view.form,
  })
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    await renderMembersPage(res, {
      staff: res.locals.staff as StaffLocal,
      q: str(req.query, 'q'),
      toast: flashToast(req.query, {
        created: 'Member added.',
        removed: 'Member deactivated. Their history is preserved.',
      }),
      form: createForm(emptyMemberValues(), {}),
    })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await memberService.createMember(req.body)
    res.redirect(`/members/${member.id}?created=1`)
  } catch (err) {
    if (err instanceof ZodError || err instanceof AppError) {
      // Re-render the list with the modal open, values kept, errors inline
      const view = {
        staff: res.locals.staff as StaffLocal,
        q: '',
        toast: null as Toast | null,
        form: createForm(memberValuesFromBody(req.body), {
          open: true,
          fieldErrors: err instanceof ZodError ? zodFieldErrors(err) : {},
          message: err instanceof AppError ? err.message : undefined,
        }),
      }
      await renderMembersPage(res, view)
      return
    }
    next(err)
  }
}

// ─────────────────────────────────────────────────────────────
// Member detail
// ─────────────────────────────────────────────────────────────

interface MemberDetailPageView {
  staff: StaffLocal
  toast: Toast | null
  editForm: FormState
  /** 'YYYY-MM' calendar month; defaults to the current month. */
  month?: string | null
}

const MONTH_PARAM = /^\d{4}-(0[1-9]|1[0-2])$/

function readMonthParam(value: unknown): string | null {
  return typeof value === 'string' && MONTH_PARAM.test(value) ? value : null
}

async function renderMemberDetailPage(
  res: Response,
  member: MemberRow,
  view: MemberDetailPageView,
): Promise<void> {
  const today = await getToday()
  const name = `${member.first_name} ${member.last_name}`

  const [activeRows, subs, attendance, payments, plans] = await Promise.all([
    subRepo.findActiveByMember(member.id),
    subRepo.findAll({ member_id: member.id }),
    attendanceRepo.findAll({ member_id: member.id }),
    paymentRepo.findAll(),
    planRepo.findAll(),
  ])

  const planName = new Map(plans.map((p) => [p.id, p.name]))
  const subsNewestFirst = [...subs].sort((a, b) => b.id - a.id)

  // Membership card: the running view row wins; a frozen sub is the fallback
  const active = activeRows[0]
  const frozen = subs.find((s) => s.status === 'frozen' && s.end_date > today)

  let membership: {
    label: string
    chipClass: string
    planName?: string
    period?: string
    daysLeft?: number
  } = { label: 'No active subscription', chipClass: CHIP.gray }

  if (active) {
    membership = {
      label: 'Active',
      chipClass: CHIP.green,
      planName: active.plan_name,
      period: `${formatDate(active.start_date)} → ${formatDate(active.end_date)}`,
      daysLeft: daysBetween(today, active.end_date),
    }
  } else if (frozen) {
    membership = {
      label: 'Frozen',
      chipClass: CHIP.blue,
      planName: planName.get(frozen.plan_id) ?? 'Unknown plan',
      period: `${formatDate(frozen.start_date)} → ${formatDate(frozen.end_date)}`,
    }
  }

  // Payments are keyed by subscription — keep this member's, newest first
  const subIds = new Set(subs.map((s) => s.id))
  const memberPayments = payments
    .filter((p) => subIds.has(p.subscription_id))
    .sort((a, b) => b.id - a.id)

  const totalPaid = memberPayments
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  const paymentChip: Record<string, string> = {
    paid: CHIP.green,
    pending: CHIP.gray,
    refunded: CHIP.blue,
    failed: CHIP.red,
  }

  // ── Attendance calendar ─────────────────────────────────
  // The member page shows a monthly calendar (not a table): one cell per
  // day, with a check mark on every date that has at least one visit.
  const currentMonth = today.slice(0, 7)
  const month = view.month ?? currentMonth
  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const monthStart = `${month}-01`
  const prevMonth = addDuration(monthStart, -1, 'month').slice(0, 7)
  const nextMonth = addDuration(monthStart, 1, 'month').slice(0, 7)

  const visitsByDay = new Map<string, (typeof attendance)[number][]>()
  for (const a of attendance) {
    const date = a.check_in.slice(0, 10)
    if (!date.startsWith(month)) continue
    const list = visitsByDay.get(date)
    if (list) list.push(a)
    else visitsByDay.set(date, [a])
  }

  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const totalDays = daysInMonth(year, monthNumber)
  const cellCount = Math.ceil((firstWeekday + totalDays) / 7) * 7
  const pad = (n: number) => String(n).padStart(2, '0')

  const calendarDays = Array.from({ length: cellCount }, (_, index) => {
    const dayNumber = index - firstWeekday + 1
    const inMonth = dayNumber >= 1 && dayNumber <= totalDays
    const dateKey = `${month}-${pad(dayNumber)}`
    const visits = inMonth ? visitsByDay.get(dateKey) ?? [] : []
    // Repo returns newest-first; reverse so tooltips read chronologically.
    const times = visits
      .map((v) => formatTime(v.check_in))
      .filter((t): t is string => t !== null)
      .reverse()

    return {
      // Date.UTC normalizes out-of-range days, so leading/trailing cells
      // still show the neighbouring month's date.
      day: inMonth
        ? dayNumber
        : new Date(Date.UTC(year, monthNumber - 1, dayNumber)).getUTCDate(),
      inMonth,
      isToday: inMonth && dateKey === today,
      count: visits.length,
      firstTime: times[0] ?? '',
      title: times.length > 0 ? `Checked in at ${times.join(', ')}` : '',
    }
  })

  const visitsThisMonth = [...visitsByDay.values()].reduce(
    (sum, list) => sum + list.length,
    0,
  )

  const monthLabel = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)))

  await renderPage(res, 'members/detail.ejs', {
    title: name,
    activeNav: 'members',
    staff: view.staff,
    toast: view.toast,
    editForm: view.editForm,
    member: {
      id: member.id,
      membershipNo: member.membership_no,
      name,
      initials: initialsOf(name),
      email: member.email,
      phone: member.phone ?? '—',
      gender: member.gender,
      joined: member.created_at ? formatDate(member.created_at.slice(0, 10)) : null,
    },
    membership,
    stats: {
      visits: attendance.length,
      openVisits: attendance.filter((a) => a.check_out === null).length,
      totalPaid: peso.format(totalPaid),
      subscriptions: subs.length,
    },
    subscriptions: subsNewestFirst.map((s) => {
      const state = subState(s, today)
      return {
        id: s.id,
        planName: planName.get(s.plan_id) ?? 'Unknown plan',
        period: `${formatDate(s.start_date)} → ${formatDate(s.end_date)}`,
        statusLabel: state.label,
        chipClass: CHIP[state.chip as ChipColor],
        autoRenew: s.auto_renew === 1,
      }
    }),
    payments: memberPayments.slice(0, 10).map((p) => ({
      id: p.id,
      referenceNo: p.reference_no,
      amount: peso.format(Number(p.amount)),
      method: p.method,
      statusLabel: p.status.charAt(0).toUpperCase() + p.status.slice(1),
      statusClass: paymentChip[p.status] ?? CHIP.gray,
      paidAt: formatDateTime(p.paid_at) ?? '—',
    })),
    calendar: {
      month,
      label: monthLabel,
      prevMonth,
      nextMonth,
      visitsThisMonth,
      canGoNext: month < currentMonth,
      days: calendarDays,
    },
  })
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id)
    if (!Number.isInteger(id) || id <= 0) {
      res.redirect('/members?error=' + encodeURIComponent('Member not found'))
      return
    }

    const member = await memberRepo.findById(id)
    if (!member) {
      // Deactivated or unknown — back to the list with a message
      res.redirect('/members?error=' + encodeURIComponent('Member not found'))
      return
    }

    await renderMemberDetailPage(res, member, {
      staff: res.locals.staff as StaffLocal,
      toast: flashToast(req.query, { updated: 'Member updated.' }),
      editForm: editForm(id, memberValuesFrom(member), {}),
      month: readMonthParam(req.query.month),
    })
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.redirect('/members?error=' + encodeURIComponent('Member not found'))
    return
  }

  try {
    await memberService.updateMember(id, req.body)
    res.redirect(`/members/${id}?updated=1`)
  } catch (err) {
    if (err instanceof ZodError || err instanceof AppError) {
      const member = await memberRepo.findById(id).catch(() => null)
      if (!member) {
        res.redirect('/members?error=' + encodeURIComponent('Member not found'))
        return
      }

      await renderMemberDetailPage(res, member, {
        staff: res.locals.staff as StaffLocal,
        toast: null,
        editForm: editForm(id, memberValuesFromBody(req.body), {
          open: true,
          fieldErrors: err instanceof ZodError ? zodFieldErrors(err) : {},
          message: err instanceof AppError ? err.message : undefined,
        }),
      })
      return
    }
    next(err)
  }
}

/**
 * Deactivate (soft delete) — admin only, history preserved.
 * Mirrors the API's DELETE /api/members/:id rule.
 */
export async function remove(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.redirect('/members?error=' + encodeURIComponent('Member not found'))
    return
  }

  try {
    const staff = res.locals.staff as StaffLocal
    await memberService.removeMember(id, { role: staff.role })
    res.redirect('/members?removed=1')
  } catch (err) {
    if (err instanceof AppError) {
      res.redirect(`/members/${id}?error=${encodeURIComponent(err.message)}`)
      return
    }
    next(err)
  }
}
