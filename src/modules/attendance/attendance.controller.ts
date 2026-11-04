import type { Request, Response, NextFunction } from 'express'
import {
  listAttendance,
  getAttendanceById,
  getOpenAttendanceForMember,
  checkIn,
  checkOut,
} from './attendance.service.js'
import { listAttendanceSchema } from './attendance.schema.js'

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listAttendanceSchema.parse(req.query)
    const rows = await listAttendance(parsed)
    res.json({ data: rows, meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 } })
  } catch (err) {
    next(err)
  }
}

export async function findOpen(req: Request, res: Response, next: NextFunction) {
  const memberId = Number(req.query.member_id)
  if (!Number.isInteger(memberId) || memberId <= 0) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_ID', message: 'Invalid member_id', details: [] } })
    return
  }
  try {
    const row = await getOpenAttendanceForMember(memberId)
    res.json({ data: row ?? null })
  } catch (err) {
    next(err)
  }
}

export async function findById(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_ID', message: 'Invalid attendance ID', details: [] } })
    return
  }
  try {
    const row = await getAttendanceById(id)
    res.json({ data: row })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await checkIn(req.body)
    res.status(201).location(`/api/attendance/${row.id}`).json({ data: row })
  } catch (err) {
    next(err)
  }
}

export async function close(req: Request, res: Response, next: NextFunction) {
  try {
    const row = await checkOut(req.body)
    res.json({ data: row })
  } catch (err) {
    next(err)
  }
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: 'INVALID_ID', message: 'Invalid attendance ID', details: [] } })
    return
  }
  // Attendance is history. It is never deleted.
  res.status(405).json({
    error: { code: 'METHOD_NOT_ALLOWED', message: 'Attendance cannot be deleted', details: [] },
  })
}
