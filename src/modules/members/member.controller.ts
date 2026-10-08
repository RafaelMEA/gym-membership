import type { Request, Response, NextFunction } from 'express'
import { listMembers, createMember, getMemberById, updateMember, removeMember } from './member.service.js'

export async function findAll(_req: Request, res: Response, next: NextFunction) {
  try {
    const rows = await listMembers()
    res.json({ data: rows, meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 } })
  } catch (err) {
    next(err)
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const member = await createMember(req.body)
    res.status(201)
       .location(`/api/members/${member.id}`)
       .json({ data: member })
  } catch (err) {
    next(err)
  }
}

export async function findById(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid member ID', details: [] } })
    return
  }
  try {
    const member = await getMemberById(id)
    res.json({ data: member })
  } catch (err) {
    next(err)
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid member ID', details: [] } })
    return
  }
  try {
    const member = await updateMember(id, req.body)
    res.json({ data: member })
  } catch (err) {
    next(err)
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid member ID', details: [] } })
    return
  }
  try {
    await removeMember(id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
}

