import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { findById } from '../modules/auth/staff.repository.js'

/**
 * Page-route twin of requireAuth (middleware/requireAuth.ts).
 *
 * The API answers unauthenticated calls with JSON 401s. Pages can't
 * show a JSON body to a person — they must be SENT somewhere, so this
 * middleware redirects to /login instead of throwing AppError.
 *
 * It also loads the staff row from the DB on every page request:
 *  - the header needs full_name/role (the JWT payload only carries
 *    sub + role)
 *  - a deactivated account loses page access immediately, even with
 *    a still-valid token
 */
export async function requirePageAuth(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.token
  if (!token) {
    res.redirect('/login')
    return
  }

  let staffId: number
  try {
    const payload = jwt.verify(token, env.JWT_SECRET)
    staffId = Number(payload.sub)
  } catch {
    // expired / tampered token — start a fresh session
    res.redirect('/login')
    return
  }

  if (!Number.isInteger(staffId) || staffId <= 0) {
    res.clearCookie('token')
    res.redirect('/login')
    return
  }

  try {
    const staff = await findById(staffId)
    if (!staff || !staff.is_active) {
      res.clearCookie('token')
      res.redirect('/login')
      return
    }

    res.locals.staff = {
      id: staff.id,
      full_name: staff.full_name,
      email: staff.email,
      role: staff.role,
    }
    next()
  } catch {
    // DB problem on a page route — send the person somewhere useful
    // rather than a JSON 500
    res.redirect('/login')
  }
}

/** Login-page guard: already signed in? Straight to the dashboard. */
export function redirectIfAuthed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.token
  if (!token) {
    next()
    return
  }

  try {
    jwt.verify(token, env.JWT_SECRET)
    res.redirect('/')
  } catch {
    // stale token — let them see the login form
    next()
  }
}
