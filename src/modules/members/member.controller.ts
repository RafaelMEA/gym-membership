import type { Request, Response, NextFunction } from 'express'
import { listMembers, createMember } from './member.service.js'

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

export async function findById(_req: Request, res: Response, _next: NextFunction) {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'findById', details: [] } })
}

export async function update(_req: Request, res: Response, _next: NextFunction) {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'update', details: [] } })
}

export async function remove(_req: Request, res: Response, _next: NextFunction) {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'remove', details: [] } })
}

