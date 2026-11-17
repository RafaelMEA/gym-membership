import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import * as subRepo from '../subscriptions/subscriptions.repository.js'
import * as subService from '../subscriptions/subscriptions.service.js'
import * as memberRepo from '../members/member.repository.js'
import * as planRepo from '../plans/plans.repository.js'
import type { PlanRow } from '../plans/plans.repository.js'
import { AppError } from '../../middleware/error.js'
import { daysBetween } from '../../lib/dates.js'
import { renderPage } from './render.js'
import {
  CHIP,
  flashToast,
  formatDate,
  getToday,
  peso,
  str,
  subState,
  zodFieldErrors,
  type StaffLocal,
  type Toast,
} from './view.js'

// ─────────────────────────────────────────────────────────────
// New-subscription modal state
// ─────────────────────────────────────────────────────────────

interface SubscriptionFormState {
  open: boolean
  values: {
    member_id: string
    plan_id: string
    start_date: string
    auto_renew: boolean
  }
  fieldErrors: Record<string, string>
  message?: string
  options: {
    members: Array<{ id: number; name: string }>
    plans: Array<{ id: number; label: string }>
    today: string
  }
}

const STATUSES = ['active', 'ended', 'frozen', 'cancelled'] as const

function readStatusFilter(value: unknown): string {
  return typeof value === 'string' && (STATUSES as readonly string[]).includes(value)
    ? value
    : ''
}

function planLabel(p: PlanRow): string {
  const unit = p.duration_value === 1 ? p.duration_unit : `${p.duration_unit}s`
  return `${p.name} · ${peso.format(Number(p.price))} / ${p.duration_value} ${unit}`
}

async function loadFormOptions(): Promise<SubscriptionFormState['options']> {
  const [members, plans] = await Promise.all([memberRepo.findAll(), planRepo.findAll()])
  const today = await getToday()
  return {
    members: members.map((m) => ({ id: m.id, name: `${m.first_name} ${m.last_name}` })),
    plans: plans.map((p) => ({ id: p.id, label: planLabel(p) })),
    today,
  }
}

function closedForm(options: SubscriptionFormState['options']): SubscriptionFormState {
  return {
    open: false,
    values: { member_id: '', plan_id: '', start_date: '', auto_renew: false },
    fieldErrors: {},
    options,
  }
}

function formFromBody(
  body: unknown,
  options: SubscriptionFormState['options'],
  opts: { open: boolean; fieldErrors?: Record<string, string>; message?: string },
): SubscriptionFormState {
  return {
    open: opts.open,
    values: {
      member_id: str(body, 'member_id'),
      plan_id: str(body, 'plan_id'),
      start_date: str(body, 'start_date'),
      auto_renew: str(body, 'auto_renew') !== '',
    },
    fieldErrors: opts.fieldErrors ?? {},
    message: opts.message,
    options,
  }
}

// ─────────────────────────────────────────────────────────────
// Subscriptions list
// ─────────────────────────────────────────────────────────────

interface SubscriptionsPageView {
  staff: StaffLocal
  status: string
  toast: Toast | null
  form: SubscriptionFormState
}

async function renderSubscriptionsPage(
  res: Response,
  view: SubscriptionsPageView,
): Promise<void> {
  const [subs, members, plans] = await Promise.all([
    subRepo.findAll(),
    memberRepo.findAll(),
    planRepo.findAll(),
  ])
  const today = await getToday()

  const memberName = new Map(members.map((m) => [m.id, `${m.first_name} ${m.last_name}`]))
  const planName = new Map(plans.map((p) => [p.id, p.name]))

  // Tabs filter by what the row MEANS (subState), not just the DB column:
  // 'active' = running now, 'ended' = active status but period over.
  const filtered = subs.filter((s) => {
    if (view.status === '') return true
    if (view.status === 'ended') return s.status === 'active' && s.end_date <= today
    if (view.status === 'active') return s.status === 'active' && s.end_date > today
    return s.status === view.status
  })

  const counts = {
    all: subs.length,
    active: subs.filter((s) => s.status === 'active' && s.end_date > today).length,
    ended: subs.filter((s) => s.status === 'active' && s.end_date <= today).length,
    frozen: subs.filter((s) => s.status === 'frozen').length,
    cancelled: subs.filter((s) => s.status === 'cancelled').length,
  }

  await renderPage(res, 'subscriptions/list.ejs', {
    title: 'Subscriptions',
    activeNav: 'subscriptions',
    staff: view.staff,
    status: view.status,
    counts,
    subscriptions: [...filtered]
      .sort((a, b) => b.id - a.id)
      .map((s) => {
        const state = subState(s, today)
        return {
          id: s.id,
          memberId: s.member_id,
          memberName: memberName.get(s.member_id) ?? `Member #${s.member_id}`,
          planName: planName.get(s.plan_id) ?? 'Unknown plan',
          period: `${formatDate(s.start_date)} → ${formatDate(s.end_date)}`,
          statusLabel: state.label,
          chipClass: CHIP[state.chip],
          autoRenew: s.auto_renew === 1,
          daysLeft: s.status === 'active' && s.end_date > today ? daysBetween(today, s.end_date) : null,
        }
      }),
    toast: view.toast,
    form: view.form,
  })
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    await renderSubscriptionsPage(res, {
      staff: res.locals.staff as StaffLocal,
      status: readStatusFilter(req.query.status),
      toast: flashToast(req.query, { created: 'Subscription created.' }),
      form: closedForm(await loadFormOptions()),
    })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    // urlencoded checkboxes send 'on' when checked, nothing otherwise.
    // Empty date input means "start today" — the service defaults it.
    const startDate = str(req.body, 'start_date')
    const input = {
      member_id: str(req.body, 'member_id') || undefined,
      plan_id: str(req.body, 'plan_id') || undefined,
      start_date: startDate === '' ? undefined : startDate,
      auto_renew: str(req.body, 'auto_renew') !== '',
    }

    await subService.createSubscription(input)
    res.redirect('/subscriptions?created=1')
  } catch (err) {
    if (err instanceof ZodError || err instanceof AppError) {
      const view: SubscriptionsPageView = {
        staff: res.locals.staff as StaffLocal,
        status: '',
        toast: null,
        form: formFromBody(req.body, await loadFormOptions(), {
          open: true,
          fieldErrors: err instanceof ZodError ? zodFieldErrors(err) : {},
          message: err instanceof AppError ? err.message : undefined,
        }),
      }
      await renderSubscriptionsPage(res, view)
      return
    }
    next(err)
  }
}
