import { pool } from '../../config/db.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'
import type { DbExecutor } from '../../config/db.js'

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

export interface SubscriptionFilters {
    member_id?: number
    status?: SubscriptionStatus
}

type BindValue = string | number | boolean | null

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
    SELECT id, member_id, plan_id, start_date, end_date, status,
           cancelled_at, cancellation_reason, frozen_at, frozen_until,
           auto_renew, created_at, updated_at
    FROM subscriptions
    ${where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY id`

  const [rows] = await db.execute(sql, params)
  return rows as SubscriptionRow[]
}