import { pool } from '../../config/db.js'
import type { DbExecutor } from '../../config/db.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'

export type SubscriptionStatus = 'active' | 'cancelled' | 'frozen'

export interface SubscriptionRow extends RowDataPacket {
  id: number
  member_id: number
  plan_id: number
  start_date: string
  end_date: string
  status: SubscriptionStatus
  cancelled_at: string | null
  cancellation_reason: string | null
  frozen_at: string | null
  frozen_until: string | null
  auto_renew: number
  created_at: string
  updated_at: string
}

export interface SubscriptionListRow extends SubscriptionRow {
  plan_name: string
  member_name: string
}

export interface ActiveSubscriptionViewRow extends RowDataPacket {
  id: number
  member_id: number
  plan_id: number
  plan_name: string
  start_date: string
  end_date: string
  days_remaining: number
}

export interface CreateSubscriptionData {
  member_id: number
  plan_id: number
  start_date: string
  end_date: string
  status: SubscriptionStatus
  auto_renew: number
  cancelled_at?: string | null
  cancellation_reason?: string | null
  frozen_at?: string | null
  frozen_until?: string | null
}

export interface UpdateSubscriptionData {
  status?: SubscriptionStatus
  auto_renew?: number
  cancellation_reason?: string | null
  frozen_until?: string | null
  cancelled_at?: string | null
  frozen_at?: string | null
  end_date?: string
}

export interface SubscriptionFilters {
  member_id?: number
  status?: SubscriptionStatus
}

type BindValue = string | number | boolean | null

const SUBSCRIPTION_SELECT = `
  SELECT id, member_id, plan_id, start_date, end_date, status,
         cancelled_at, cancellation_reason, frozen_at, frozen_until,
         auto_renew, created_at, updated_at
  FROM subscriptions`

export async function findAll(
  filters: SubscriptionFilters = {},
  db: DbExecutor = pool,
): Promise<SubscriptionRow[]> {
  const where: string[] = []
  const params: BindValue[] = []

  if (filters.member_id !== undefined) {
    where.push('member_id = ?')
    params.push(filters.member_id)
  }
  if (filters.status !== undefined) {
    where.push('status = ?')
    params.push(filters.status)
  }

  const sql = `
    ${SUBSCRIPTION_SELECT}
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY id`

  const [rows] = await db.execute(sql, params)
  return rows as SubscriptionRow[]
}

export async function findById(
  id: number,
  db: DbExecutor = pool,
): Promise<SubscriptionRow | undefined> {
  const [rows] = await db.execute(
    `${SUBSCRIPTION_SELECT}
     WHERE id = ?`,
    [id],
  )

  return (rows as SubscriptionRow[])[0]
}

export async function findActiveByMember(
  memberId: number,
  db: DbExecutor = pool,
): Promise<ActiveSubscriptionViewRow[]> {
  const [rows] = await db.execute(
    `SELECT subscription_id AS id,
            member_id,
            plan_id,
            plan_name,
            start_date,
            end_date,
            days_remaining
     FROM v_active_subscriptions
     WHERE member_id = ?`,
    [memberId],
  )

  return rows as ActiveSubscriptionViewRow[]
}

export async function lockMember(
  memberId: number,
  db: DbExecutor,
): Promise<boolean> {
  const [rows] = await db.execute(
    `SELECT id FROM members WHERE id = ? AND is_active = 1 FOR UPDATE`,
    [memberId],
  )
  return (rows as RowDataPacket[]).length > 0
}

export async function findActivePlan(
  planId: number,
  db: DbExecutor,
): Promise<{ id: number; duration_value: number; duration_unit: 'day' | 'week' | 'month' | 'year' } | undefined> {
  const [rows] = await db.execute(
    `SELECT id, duration_value, duration_unit
     FROM membership_plans
     WHERE id = ? AND is_active = 1`,
    [planId],
  )
  return (rows as Array<{ id: number; duration_value: number; duration_unit: 'day' | 'week' | 'month' | 'year' } & RowDataPacket>)[0]
}

export async function findOverlapping(
  memberId: number,
  candidateStart: string,
  candidateEnd: string,
  db: DbExecutor,
): Promise<SubscriptionRow | undefined> {
  const [rows] = await db.execute(
    `${SUBSCRIPTION_SELECT}
     WHERE member_id = ?
       AND status IN ('active','frozen')
       AND start_date < ?
       AND end_date   > ?
     FOR UPDATE`,
    [memberId, candidateEnd, candidateStart],
  )
  return (rows as SubscriptionRow[])[0]
}

export async function create(
  data: CreateSubscriptionData,
  db: DbExecutor = pool,
): Promise<SubscriptionRow> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO subscriptions (
       member_id,
       plan_id,
       start_date,
       end_date,
       status,
       auto_renew,
       cancelled_at,
       cancellation_reason,
       frozen_at,
       frozen_until
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.member_id,
      data.plan_id,
      data.start_date,
      data.end_date,
      data.status,
      data.auto_renew ?? 0,
      data.cancelled_at ?? null,
      data.cancellation_reason ?? null,
      data.frozen_at ?? null,
      data.frozen_until ?? null,
    ],
  )

  const created = await findById(result.insertId, db)
  if (!created) {
    throw new Error('Failed to load created subscription')
  }
  return created
}

export async function update(
  id: number,
  data: UpdateSubscriptionData,
  db: DbExecutor = pool,
): Promise<SubscriptionRow | undefined> {
  const sets: string[] = []
  const params: BindValue[] = []

  if (data.status !== undefined) {
    sets.push('status = ?')
    params.push(data.status)
  }
  if (data.auto_renew !== undefined) {
    sets.push('auto_renew = ?')
    params.push(data.auto_renew)
  }
  if (data.cancellation_reason !== undefined) {
    sets.push('cancellation_reason = ?')
    params.push(data.cancellation_reason)
  }
  if (data.frozen_until !== undefined) {
    sets.push('frozen_until = ?')
    params.push(data.frozen_until)
  }
  if (data.cancelled_at !== undefined) {
    sets.push('cancelled_at = ?')
    params.push(data.cancelled_at)
  }
  if (data.frozen_at !== undefined) {
    sets.push('frozen_at = ?')
    params.push(data.frozen_at)
  }
  if (data.end_date !== undefined) {
    sets.push('end_date = ?')
    params.push(data.end_date)
  }

  if (sets.length === 0) {
    return findById(id, db)
  }

  params.push(id)
  const sql = `UPDATE subscriptions SET ${sets.join(', ')} WHERE id = ?`
  await db.execute(sql, params)

  return findById(id, db)
}

export async function unfreeze(
  id: number,
  db: DbExecutor,
): Promise<SubscriptionRow | undefined> {
  await db.execute(
    `UPDATE subscriptions
     SET status = 'active',
         end_date = DATE_ADD(end_date, INTERVAL DATEDIFF(frozen_until, frozen_at) DAY),
         frozen_at = NULL,
         frozen_until = NULL
     WHERE id = ? AND status = 'frozen'`,
    [id],
  )

  return findById(id, db)
}