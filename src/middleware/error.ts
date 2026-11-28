import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { renderPage } from '../modules/web/render.js'

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

/** API calls get JSON; staff pages get a branded, recoverable page. */
function wantsPage(req: Request): boolean {
  return !req.path.startsWith('/api/') && req.path !== '/health'
}

async function sendPageError(
  req: Request,
  res: Response,
  status: number,
  code: string,
  heading: string,
  message: string,
): Promise<void> {
  res.status(status)
  res.setHeader('Cache-Control', 'no-store')
  try {
    await renderPage(res, 'errors/error.ejs', {
      title: heading,
      code,
      heading,
      message,
      url: req.originalUrl,
      // The header reads these directly; define them even on a public error.
      staff: undefined,
      activeNav: '',
    })
  } catch (renderErr) {
    // The error page itself failed (e.g. EJS is broken) — never recurse.
    console.error('Failed to render error page:', renderErr)
    if (!res.headersSent) res.setHeader('Content-Type', 'text/plain; charset=utf-8')
    res.end(`${heading}\n${message}`)
  }
}

export async function notFoundHandler(req: Request, res: Response) {
  if (wantsPage(req)) {
    await sendPageError(
      req,
      res,
      404,
      'PAGE_NOT_FOUND',
      'That page isn’t here',
      'The link may be out of date, or the page may have moved. Head back to the dashboard to keep working.',
    )
    return
  }

  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `No route matches ${req.method} ${req.originalUrl}`,
      details: [],
    },
  })
}

// Must have 4 params — Express identifies error handlers by arity
export async function errorHandler(
  err: Error, _req: Request, res: Response, _next: NextFunction,
) {
  if (wantsPage(_req)) {
    if (err instanceof AppError) {
      await sendPageError(
        _req, res, err.statusCode, err.code, 'We couldn’t complete that', err.message,
      )
      return
    }

    console.error('Unhandled page error:', err)
    await sendPageError(
      _req,
      res,
      500,
      'INTERNAL_ERROR',
      'Something went wrong',
      'Your work was not lost. Try again, and if it keeps happening, ask the gym owner to check the server.',
    )
    return
  }

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
