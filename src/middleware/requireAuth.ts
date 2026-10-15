import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from './error.js'

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) {
    next(new AppError(401, 'UNAUTHENTICATED', 'You must be logged in'))
    return
  }

  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    res.locals.staff = payload          
    next()                               
  } catch {
    next(new AppError(401, 'INVALID_TOKEN', 'Session expired or invalid'))
  }
}