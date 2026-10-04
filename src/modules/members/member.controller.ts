import type { Request, Response, NextFunction } from 'express'

export async function findAll(_req: Request, res: Response, next: NextFunction) {
  try {
    const members: unknown[] = []
    res.json({ data: members, meta: { page: 1, limit: 20, total: 0, totalPages: 0 } })
  } catch (err) {
    next(err)
  }
}

export async function create(_req: Request, res: Response, next: NextFunction) {
  res.status(501).json({
    error: { code: 'NOT_IMPLEMENTED', message: 'create not built yet', details: [] },
  })
}

export async function findById(_req: Request, res: Response, next: NextFunction) {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'findById', details: [] } })
}

export async function update(_req: Request, res: Response, next: NextFunction) {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'update', details: [] } })
}

export async function remove(_req: Request, res: Response, next: NextFunction) {
  res.status(501).json({ error: { code: 'NOT_IMPLEMENTED', message: 'remove', details: [] } })
}