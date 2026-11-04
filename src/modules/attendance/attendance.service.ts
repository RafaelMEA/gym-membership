import { AppError } from '../../middleware/error.js'
import { withTransaction } from '../../config/db.js'
import {
  checkInSchema,
  checkOutSchema,
} from './attendance.schema.js'
import * as attendanceRepo from './attendance.repository.js'
import type { AttendanceRow } from './attendance.repository.js'
import { findActiveByMember } from '../subscriptions/subscriptions.repository.js'

export interface AttendanceFilters {
  member_id?: number
  active_only?: boolean
  from?: string
  to?: string
}

export const listAttendance = (filters: AttendanceFilters = {}) => {
  return attendanceRepo.findAll(filters)
}

export async function getAttendanceById(id: number): Promise<AttendanceRow> {
  const row = await attendanceRepo.findById(id)
  if (!row) {
    throw new AppError(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found')
  }
  return row
}

export const getOpenAttendanceForMember = (memberId: number) => {
  return attendanceRepo.findOpenByMember(memberId)
}

/**
 * Open a new visit.
 *
 * Order matters for the race: lockMember first so concurrent
 * check-ins serialize on the member row, then check the open visit
 * with a locking read. A plain SELECT would read the snapshot taken
 * at transaction start under REPEATABLE-READ and miss a committed
 * insert from another transaction.
 */
export async function checkIn(input: unknown): Promise<AttendanceRow> {
  const parsed = checkInSchema.parse(input)

  return withTransaction(async (db) => {
    const memberOk = await attendanceRepo.lockActiveMember(parsed.member_id, db)
    if (!memberOk) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found or inactive')
    }

    const active = await findActiveByMember(parsed.member_id, db)
    if (active.length === 0) {
      throw new AppError(
        403,
        'MEMBERSHIP_NOT_ACTIVE',
        'Member does not have an active subscription',
      )
    }

    const open = await attendanceRepo.lockOpenByMember(parsed.member_id, db)
    if (open) {
      throw new AppError(
        409,
        'ALREADY_CHECKED_IN',
        'Member is already checked in',
      )
    }

    return attendanceRepo.checkIn(parsed.member_id, db)
  })
}

/**
 * Close an open visit.
 *
 * Two entry points, matching the schema:
 *  - { member_id } -> close that member's open visit
 *  - { id }        -> close that specific attendance row
 *
 * Failures are distinguished deliberately:
 *  - member inactive or record missing   -> 404
 *  - record exists but is already closed -> 409 CHECK_OUT_NOT_OPEN
 */
export async function checkOut(input: unknown): Promise<AttendanceRow> {
  const parsed = checkOutSchema.parse(input)

  // --- by attendance id ---
  if (parsed.id !== undefined) {
    const attendanceId = parsed.id

    return withTransaction(async (db) => {
      const opened = await attendanceRepo.lockOpenById(attendanceId, db)
      if (!opened) {
        const existing = await attendanceRepo.findById(attendanceId, db)
        if (!existing) {
          throw new AppError(404, 'ATTENDANCE_NOT_FOUND', 'Attendance record not found')
        }
        throw new AppError(
          409,
          'CHECK_OUT_NOT_OPEN',
          'This attendance record is already checked out',
        )
      }

      const closed = await attendanceRepo.checkOut(opened.id, db)
      if (!closed) {
        throw new AppError(409, 'CHECK_OUT_NOT_OPEN', 'Attendance is no longer open')
      }
      return closed
    })
  }

  // --- by member ---
  const memberId = parsed.member_id
  if (memberId === undefined) {
    // Should have been caught by checkOutSchema, but keep the service
    // safe if the schema ever changes.
    throw new AppError(400, 'VALIDATION_ERROR', 'member_id or id is required')
  }

  return withTransaction(async (db) => {
    const memberOk = await attendanceRepo.lockActiveMember(memberId, db)
    if (!memberOk) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Member not found or inactive')
    }

    const opened = await attendanceRepo.lockOpenByMember(memberId, db)
    if (!opened) {
      throw new AppError(409, 'NOT_CHECKED_IN', 'Member is not checked in')
    }

    const closed = await attendanceRepo.checkOut(opened.id, db)
    if (!closed) {
      throw new AppError(409, 'NOT_CHECKED_IN', 'Member is no longer checked in')
    }
    return closed
  })
}
