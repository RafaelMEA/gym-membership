import type { Request, Response, NextFunction } from 'express'
import {
  listSubscriptions,
  getSubscriptionById,
  getActiveSubscriptionForMember,
  createSubscription,
  updateSubscription,
  cancelSubscription,
} from './subscriptions.service.js'
import { listSubscriptionsSchema } from './subscriptions.schema.js'

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listSubscriptionsSchema.parse(req.query)
    const rows = await listSubscriptions(parsed)
    res.json({ data: rows, meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 } })
  } catch (err) {
    next(err)
  }
}

export async function findActive(req: Request, res: Response, next: NextFunction) {
  const memberId = Number(req.query.member_id)
  if (!Number.isInteger(memberId) || memberId <= 0) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_ID', message: 'Invalid member_id', details: [] } })
    return
  }
  try {
    const rows = await getActiveSubscriptionForMember(memberId)
    res.json({ data: rows })
  } catch (err) {
    next(err)
  }
}

export async function findById(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_ID', message: 'Invalid subscription ID', details: [] } })
    return
  }
  try {
    const sub = await getSubscriptionById(id)
    res.json({ data: sub })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const sub = await createSubscription(req.body)
    res.status(201).location(`/api/subscriptions/${sub.id}`).json({ data: sub })
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_ID', message: 'Invalid subscription ID', details: [] } })
    return
  }
  try {
    const sub = await updateSubscription(id, req.body)
    res.json({ data: sub })
  } catch (err) {
    next(err)
  }
}

export async function cancel(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_ID', message: 'Invalid subscription ID', details: [] } })
    return
  }
  try {
    const reason = (req.body?.cancellation_reason as string | undefined) ?? ''
    const sub = await cancelSubscription(id, reason)
    res.json({ data: sub })
  } catch (err) {
    next(err)
  }
}
