import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import * as planRepo from '../plans/plans.repository.js'
import * as planService from '../plans/plans.service.js'
import * as subRepo from '../subscriptions/subscriptions.repository.js'
import { AppError } from '../../middleware/error.js'
import { renderPage } from './render.js'
import {
  flashToast,
  peso,
  str,
  zodFieldErrors,
  type FormState,
  type StaffLocal,
  type Toast,
} from './view.js'

// ─────────────────────────────────────────────────────────────
// Plan modal form state
// ─────────────────────────────────────────────────────────────

function emptyPlanValues(): Record<string, string> {
  return {
    name: '',
    description: '',
    price: '',
    duration_value: '1',
    duration_unit: 'month',
    max_visits_per_period: '',
  }
}

function planValuesFromBody(body: unknown): Record<string, string> {
  return {
    name: str(body, 'name'),
    description: str(body, 'description'),
    price: str(body, 'price'),
    duration_value: str(body, 'duration_value') || '1',
    duration_unit: str(body, 'duration_unit') || 'month',
    max_visits_per_period: str(body, 'max_visits_per_period'),
  }
}

/**
 * urlencoded form → the exact types the plan schemas expect.
 * price is coerced by zod; duration_value / max_visits are plain
 * z.number() so we convert them here.
 */
function planInputFromBody(body: unknown) {
  const description = str(body, 'description')
  const maxVisits = str(body, 'max_visits_per_period')
  return {
    name: str(body, 'name'),
    description: description === '' ? null : description,
    price: str(body, 'price'),
    duration_value: Number(str(body, 'duration_value') || '1'),
    duration_unit: str(body, 'duration_unit') || 'month',
    max_visits_per_period: maxVisits === '' ? null : Number(maxVisits),
  }
}

function planForm(
  values: Record<string, string>,
  action: string,
  opts: { open?: boolean; fieldErrors?: Record<string, string>; message?: string },
): FormState {
  const isEdit = action !== '/plans'
  return {
    open: opts.open ?? false,
    action,
    submitLabel: isEdit ? 'Save changes' : 'Add plan',
    subtitle: isEdit
      ? 'Update pricing or duration — existing subscriptions keep their dates.'
      : 'Plans define the price and duration used when creating subscriptions.',
    values,
    fieldErrors: opts.fieldErrors ?? {},
    message: opts.message,
  }
}

// ─────────────────────────────────────────────────────────────
// Plans page
// ─────────────────────────────────────────────────────────────

interface PlansPageView {
  staff: StaffLocal
  toast: Toast | null
  form: FormState
}

async function renderPlansPage(res: Response, view: PlansPageView): Promise<void> {
  const [plans, subs] = await Promise.all([planRepo.findAll(), subRepo.findAll()])

  // How many subscriptions (any status) reference each plan
  const usage = new Map<number, number>()
  for (const s of subs) {
    usage.set(s.plan_id, (usage.get(s.plan_id) ?? 0) + 1)
  }

  await renderPage(res, 'plans/list.ejs', {
    title: 'Plans',
    activeNav: 'plans',
    staff: view.staff,
    toast: view.toast,
    form: view.form,
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      price: peso.format(Number(p.price)),
      priceRaw: String(p.price),
      duration: `${p.duration_value} ${p.duration_value === 1 ? p.duration_unit : `${p.duration_unit}s`}`,
      durationValue: p.duration_value,
      durationUnit: p.duration_unit,
      maxVisits: p.max_visits_per_period,
      usage: usage.get(p.id) ?? 0,
    })),
  })
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    await renderPlansPage(res, {
      staff: res.locals.staff as StaffLocal,
      toast: flashToast(req.query, {
        created: 'Plan added.',
        updated: 'Plan updated.',
        removed: 'Plan deactivated. Existing subscriptions are unaffected.',
      }),
      form: planForm(emptyPlanValues(), '/plans', {}),
    })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    await planService.createPlan(planInputFromBody(req.body))
    res.redirect('/plans?created=1')
  } catch (err) {
    if (err instanceof ZodError || err instanceof AppError) {
      await renderPlansPage(res, {
        staff: res.locals.staff as StaffLocal,
        toast: null,
        form: planForm(planValuesFromBody(req.body), '/plans', {
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

export async function update(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.redirect('/plans?error=' + encodeURIComponent('Plan not found'))
    return
  }

  try {
    await planService.updatePlan(id, planInputFromBody(req.body))
    res.redirect('/plans?updated=1')
  } catch (err) {
    if (err instanceof ZodError || err instanceof AppError) {
      await renderPlansPage(res, {
        staff: res.locals.staff as StaffLocal,
        toast: null,
        form: planForm(planValuesFromBody(req.body), `/plans/${id}`, {
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

/** Deactivate (soft delete) — admin only, mirrors the API. */
export async function remove(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.redirect('/plans?error=' + encodeURIComponent('Plan not found'))
    return
  }

  try {
    const staff = res.locals.staff as StaffLocal
    await planService.removePlan(id, { role: staff.role })
    res.redirect('/plans?removed=1')
  } catch (err) {
    if (err instanceof AppError) {
      res.redirect('/plans?error=' + encodeURIComponent(err.message))
      return
    }
    next(err)
  }
}
