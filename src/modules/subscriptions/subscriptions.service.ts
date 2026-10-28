import { AppError } from '../../middleware/error.js'
import { withTransaction } from '../../config/db.js'
import type { DbExecutor } from '../../config/db.js'
import { addDuration } from '../../lib/dates.js'
import {
  createSubscriptionSchema,
  updateSubscriptionSchema,
} from './subscriptions.schema.js'
import * as subRepo from './subscriptions.repository.js'
import type { SubscriptionRow } from './subscriptions.repository.js'

async function getToday(db: DbExecutor): Promise<string> {
  const [rows] = await db.execute('SELECT CURDATE() AS today')
  const row = (rows as Array<{ today: string } & import('mysql2').RowDataPacket>)[0]
  if (!row?.today) {
    throw new Error('Failed to get CURDATE() from database')
  }
  return row.today
}

async function getNow(db: DbExecutor): Promise<string> {
  const [rows] = await db.execute('SELECT NOW() AS now')
  const row = (rows as Array<{ now: string } & import('mysql2').RowDataPacket>)[0]
  if (!row?.now) {
    throw new Error('Failed to get NOW() from database')
  }
  return row.now
}

export const listSubscriptions = (filters?: subRepo.SubscriptionFilters) => {
  return subRepo.findAll(filters ?? {})
}

export async function getSubscriptionById(id: number): Promise<SubscriptionRow> {
  const sub = await subRepo.findById(id)
  if (!sub) {
    throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found')
  }
  return sub
}

export async function getActiveSubscriptionForMember(memberId: number) {
  return subRepo.findActiveByMember(memberId)
}

export async function createSubscription(input: unknown): Promise<SubscriptionRow> {
  return withTransaction(async (db) => {
    const parsed = createSubscriptionSchema.parse(input)

    const memberId = parsed.member_id
    const planId = parsed.plan_id

    const memberOk = await subRepo.lockMember(memberId, db)
    if (!memberOk) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found or inactive')
    }


    const plan = await subRepo.findActivePlan(planId, db)
    if (!plan) {
      throw new AppError(404, 'PLAN_NOT_FOUND', 'Plan not found or inactive')
    }

    const today = await getToday(db)
    const startDate = parsed.start_date ?? today

    const endDate = addDuration(startDate, plan.duration_value, plan.duration_unit)

    const overlapping = await subRepo.findOverlapping(
      memberId,
      startDate,
      endDate,
      db,
    )
    if (overlapping) {
      throw new AppError(
        409,
        'SUBSCRIPTION_OVERLAP',
        'Member already has an overlapping subscription',
      )
    }

    const autoRenew = parsed.auto_renew ? 1 : 0

    const created = await subRepo.create(
      {
        member_id: memberId,
        plan_id: planId,
        start_date: startDate,
        end_date: endDate,
        status: 'active',
        auto_renew: autoRenew,
      },
      db,
    )

    return created
  })
}

export async function updateSubscription(
  id: number,
  input: unknown,
): Promise<SubscriptionRow> {
  const parsed = updateSubscriptionSchema.parse(input)

  const sub = await subRepo.findById(id)
  if (!sub) {
    throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found')
  }

  if (sub.status === 'cancelled') {
    throw new AppError(
      409,
      'INVALID_STATUS_TRANSITION',
      'Cannot update a cancelled subscription',
    )
  }

  if (parsed.status === 'cancelled') {
    if (!parsed.cancellation_reason) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'cancellation_reason is required when cancelling',
      )
    }

    return withTransaction(async (db) => {
      const now = await getNow(db)

      const updated = await subRepo.update(
        id,
        {
          status: 'cancelled',
          cancellation_reason: parsed.cancellation_reason,
          cancelled_at: now,
        },
        db,
      )

      if (!updated) {
        throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found')
      }
      return updated
    })
  }

  if (parsed.status === 'frozen') {
    if (!parsed.frozen_until) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'frozen_until is required when freezing',
      )
    }

    if (sub.status !== 'active') {
      throw new AppError(
        409,
        'INVALID_STATUS_TRANSITION',
        'Only active subscriptions can be frozen',
      )
    }

    return withTransaction(async (db) => {
      const now = await getNow(db)

      const updated = await subRepo.update(
        id,
        {
          status: 'frozen',
          frozen_until: parsed.frozen_until,
          frozen_at: now,
        },
        db,
      )

      if (!updated) {
        throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found')
      }
      return updated
    })
  }

  if (parsed.status === 'active' && sub.status === 'frozen') {
    return withTransaction(async (db) => {
      const unfrozen = await subRepo.unfreeze(id, db)
      if (!unfrozen) {
        throw new AppError(409, 'INVALID_STATUS_TRANSITION', 'Cannot unfreeze this subscription')
      }

      if (parsed.auto_renew !== undefined) {
        const updated = await subRepo.update(
          id,
          { auto_renew: parsed.auto_renew ? 1 : 0 },
          db,
        )
        if (updated) return updated
      }

      return unfrozen
    })
  }

  if (
    parsed.auto_renew !== undefined ||
    parsed.frozen_until !== undefined
  ) {
    const data: subRepo.UpdateSubscriptionData = {}

    if (parsed.auto_renew !== undefined) {
      data.auto_renew = parsed.auto_renew ? 1 : 0
    }

    if (parsed.frozen_until !== undefined && sub.status === 'frozen') {
      data.frozen_until = parsed.frozen_until
    }

    if (Object.keys(data).length === 0) {
      return sub
    }

    const updated = await subRepo.update(id, data)
    if (!updated) {
      throw new AppError(404, 'SUBSCRIPTION_NOT_FOUND', 'Subscription not found')
    }
    return updated
  }

  return sub
}

export async function cancelSubscription(
  id: number,
  cancellationReason: string,
): Promise<SubscriptionRow> {
  if (!cancellationReason?.trim()) {
    throw new AppError(400, 'VALIDATION_ERROR', 'cancellation_reason is required')
  }

  return updateSubscription(id, {
    status: 'cancelled',
    cancellation_reason: cancellationReason.trim(),
  })
}