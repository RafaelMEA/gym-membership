import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'

// An error we EXPECTED (404, 409, 403...) — safe to show the client
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
      details: [],
    },
  })
}

// Must have 4 params — Express identifies error handlers by arity
export function errorHandler(
  err: Error, _req: Request, res: Response, _next: NextFunction,
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: [] },
    })
    return
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.issues[0]?.message ?? 'Invalid input',
        details: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
      },
    })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
  })
}