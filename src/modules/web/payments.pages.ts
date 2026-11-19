import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import * as paymentRepo from '../payments/payments.repository.js'
import * as paymentService from '../payments/payments.service.js'
import * as subRepo from '../subscriptions/subscriptions.repository.js'
import * as memberRepo from '../members/member.repository.js'
import * as planRepo from '../plans/plans.repository.js'
import { AppError } from '../../middleware/error.js'
import { renderPage } from './render.js'
import {
  CHIP,
  flashToast,
  formatDate,
  formatDateTime,
  peso,
  str,
  zodFieldErrors,
  type FormState,
  type StaffLocal,
  type Toast,
} from './view.js'

const PAYMENT_STATUSES = ['paid', 'pending', 'refunded', 'failed'] as const

const STATUS_CHIP: Record<string, string> = {
  paid: CHIP.green,
  pending: CHIP.gray,
  refunded: CHIP.blue,
  failed: CHIP.red,
}

function readStatusFilter(value: unknown): string {
  return typeof value === 'string' && (PAYMENT_STATUSES as readonly string[]).includes(value)
    ? value
    : ''
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

// ─────────────────────────────────────────────────────────────
// Payment modal form state
// ─────────────────────────────────────────────────────────────

function emptyPaymentValues(): Record<string, string> {
  return {
    subscription_id: '',
    amount: '',
    method: 'cash',
    status: 'paid',
    paid_at: '',
    notes: '',
  }
}

function paymentValuesFromBody(body: unknown): Record<string, string> {
  return {
    subscription_id: str(body, 'subscription_id'),
    amount: str(body, 'amount'),
    method: str(body, 'method') || 'cash',
    status: str(body, 'status') || 'paid',
    paid_at: str(body, 'paid_at'),
    notes: str(body, 'notes'),
  }
}

function paymentForm(
  values: Record<string, string>,
  opts: { open?: boolean; fieldErrors?: Record<string, string>; message?: string },
): FormState {
  return {
    open: opts.open ?? false,
    action: '/payments',
    submitLabel: 'Record payment',
    subtitle: 'Payments are permanent records — they can be refunded, never deleted.',
    values,
    fieldErrors: opts.fieldErrors ?? {},
    message: opts.message,
  }
}

/** urlencoded form → the payment schema's exact types. */
function paymentInputFromBody(body: unknown) {
  const subscriptionId = str(body, 'subscription_id')
  const paidAt = str(body, 'paid_at')
  const notes = str(body, 'notes')
  return {
    subscription_id: subscriptionId === '' ? undefined : subscriptionId,
    amount: str(body, 'amount'),
    method: str(body, 'method') || 'cash',
    status: str(body, 'status') || 'paid',
    paid_at: paidAt === '' ? undefined : paidAt,
    notes: notes === '' ? undefined : notes,
  }
}

// ─────────────────────────────────────────────────────────────
// Payments page
// ─────────────────────────────────────────────────────────────

interface PaymentsPageView {
  staff: StaffLocal
  status: string
  toast: Toast | null
  form: FormState
}

async function renderPaymentsPage(res: Response, view: PaymentsPageView): Promise<void> {
  const [payments, subs, members, plans] = await Promise.all([
    paymentRepo.findAll(),
    subRepo.findAll(),
    memberRepo.findAll(),
    planRepo.findAll(),
  ])

  const memberName = new Map(members.map((m) => [m.id, `${m.first_name} ${m.last_name}`]))
  const planName = new Map(plans.map((p) => [p.id, p.name]))
  const planById = new Map(plans.map((p) => [p.id, p]))
  const subById = new Map(subs.map((s) => [s.id, s]))

  const memberForSub = (subId: number): string => {
    const sub = subById.get(subId)
    if (!sub) return '—'
    return memberName.get(sub.member_id) ?? `Member #${sub.member_id}`
  }

  const all = [...payments].sort((a, b) => b.id - a.id)
  const filtered = view.status === '' ? all : all.filter((p) => p.status === view.status)

  const counts = {
    all: all.length,
    paid: all.filter((p) => p.status === 'paid').length,
    pending: all.filter((p) => p.status === 'pending').length,
    refunded: all.filter((p) => p.status === 'refunded').length,
    failed: all.filter((p) => p.status === 'failed').length,
  }

  await renderPage(res, 'payments/list.ejs', {
    title: 'Payments',
    activeNav: 'payments',
    staff: view.staff,
    status: view.status,
    counts,
    toast: view.toast,
    form: view.form,
    payments: filtered.map((p) => ({
      id: p.id,
      referenceNo: p.reference_no,
      memberName: memberForSub(p.subscription_id),
      memberId: subById.get(p.subscription_id)?.member_id ?? null,
      amount: peso.format(Number(p.amount)),
      method: capitalize(p.method),
      statusLabel: capitalize(p.status),
      statusClass: STATUS_CHIP[p.status] ?? CHIP.gray,
      paidAt: formatDateTime(p.paid_at) ?? '—',
      notes: p.notes,
      canRefund: p.status === 'paid',
    })),
    // Options for the record-payment modal
    formOptions: {
      subscriptions: subs
        .filter((s) => s.status !== 'cancelled')
        .sort((a, b) => b.id - a.id)
        .map((s) => ({
          id: s.id,
          label: `${memberName.get(s.member_id) ?? `Member #${s.member_id}`} · ${
            planName.get(s.plan_id) ?? 'Plan'
          } · ${formatDate(s.start_date)} → ${formatDate(s.end_date)}`,
          price: String(planById.get(s.plan_id)?.price ?? ''),
        })),
    },
  })
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    await renderPaymentsPage(res, {
      staff: res.locals.staff as StaffLocal,
      status: readStatusFilter(req.query.status),
      toast: flashToast(req.query, {
        created: 'Payment recorded.',
        refunded: 'Payment refunded. The record stays for audit history.',
      }),
      form: paymentForm(emptyPaymentValues(), {}),
    })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    await paymentService.createPayment(paymentInputFromBody(req.body))
    res.redirect('/payments?created=1')
  } catch (err) {
    if (err instanceof ZodError || err instanceof AppError) {
      await renderPaymentsPage(res, {
        staff: res.locals.staff as StaffLocal,
        status: '',
        toast: null,
        form: paymentForm(paymentValuesFromBody(req.body), {
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

export async function refund(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.redirect('/payments?error=' + encodeURIComponent('Payment not found'))
    return
  }

  try {
    const note = str(req.body, 'notes')
    await paymentService.refundPayment(id, note === '' ? undefined : note)
    res.redirect('/payments?refunded=1')
  } catch (err) {
    if (err instanceof AppError) {
      res.redirect('/payments?error=' + encodeURIComponent(err.message))
      return
    }
    next(err)
  }
}
