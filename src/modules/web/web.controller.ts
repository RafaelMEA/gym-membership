import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { loginStaff } from '../auth/staff.service.js'
import { AppError } from '../../middleware/error.js'
import { env } from '../../config/env.js'
import { daysBetween } from '../../lib/dates.js'
import { renderPage, renderStandalone } from './render.js'
import {
  getToday, formatDate, formatTime, peso, flashToast,
} from './view.js'
import * as memberRepo from '../members/member.repository.js'
import * as planRepo from '../plans/plans.repository.js'
import * as subRepo from '../subscriptions/subscriptions.repository.js'
import * as attendanceRepo from '../attendance/attendance.repository.js'
import * as paymentRepo from '../payments/payments.repository.js'

// Cookie options mirror auth.controller.ts — one session, one set of rules
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  maxAge: 3600_000,
} as const

// ─────────────────────────────────────────────────────────────
// Pages
// ─────────────────────────────────────────────────────────────

export async function showLogin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Login failures and sign-outs use the same right-hand toast stack
    // as the rest of the app. Success lands on the dashboard instead.
    const toast =
      req.query.error === '1'
        ? { kind: 'error' as const, text: 'Incorrect email or password. Please try again.' }
        : req.query.loggedout !== undefined
          ? { kind: 'success' as const, text: 'Signed out successfully. See you next shift!' }
          : null

    await renderStandalone(res, 'auth/login.ejs', {
      title: 'Sign in',
      toast,
    })
  } catch (err) {
    next(err)
  }
}

/**
 * POST /login — Post/Redirect/Get for pages.
 * Success: set the JWT cookie, then redirect (no page rendered, so a
 * refresh can't re-submit the form). Failure: redirect back with
 * ?error=1 so the form shows a banner. Expected failures are
 * bad credentials (AppError) and a malformed body (ZodError);
 * anything else is a real bug and goes to the error handler.
 */
export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { token } = await loginStaff(req.body)
    res.cookie('token', token, COOKIE_OPTIONS)
    res.redirect('/?welcome=1')
  } catch (err) {
    if (err instanceof AppError || err instanceof ZodError) {
      res.redirect('/login?error=1')
      return
    }
    next(err)
  }
}

export function logout(_req: Request, res: Response) {
  res.clearCookie('token')
  res.redirect('/login?loggedout=1')
}

/**
 * GET / — the dashboard.
 *
 * Small dataset: pull the existing repo findAll()s once, compute the
 * numbers in JS. When the data grows, these become SQL COUNT/GROUP BY
 * queries — the view data shape stays the same.
 */
export async function dashboard(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const staff = res.locals.staff as {
      id: number
      full_name: string
      email: string
      role: string
    }

    const today = await getToday()
    const monthPrefix = today.slice(0, 7) // 'YYYY-MM'

    const [members, plans, subs, attendance, payments] = await Promise.all([
      memberRepo.findAll(),
      planRepo.findAll(),
      subRepo.findAll(),
      attendanceRepo.findAll(),
      paymentRepo.findAll(),
    ])

    // Display name lookups
    const memberName = new Map(members.map((m) => [m.id, `${m.first_name} ${m.last_name}`]))
    const memberNo = new Map(members.map((m) => [m.id, m.membership_no]))
    const planName = new Map(plans.map((p) => [p.id, p.name]))

    // A subscription is "running" unless it was cancelled and its
    // period hasn't ended yet (end_date is the first day NOT covered)
    const activeSubs = subs.filter(
      (s) => s.status !== 'cancelled' && s.end_date > today,
    )

    // An open visit = never checked out. Frozen memberships keep their
    // end_date extended, so they still count here.
    const inGymNow = attendance.filter((a) => a.check_out === null)

    const todayCheckIns = attendance
      .filter((a) => a.check_in.startsWith(today))
      .sort((a, b) => (a.check_in < b.check_in ? 1 : -1))

    const monthRevenue = payments
      .filter((p) => p.status === 'paid' && p.paid_at?.startsWith(monthPrefix))
      .reduce((sum, p) => sum + Number(p.amount), 0)

    const expiring = activeSubs
      .filter((s) => s.status === 'active' && daysBetween(today, s.end_date) <= 7)
      .map((s) => ({
        memberName: memberName.get(s.member_id) ?? `Member #${s.member_id}`,
        planName: planName.get(s.plan_id) ?? 'Unknown plan',
        endDate: formatDate(s.end_date),
        daysLeft: daysBetween(today, s.end_date),
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft)

    await renderPage(res, 'dashboard/index.ejs', {
      title: 'Dashboard',
      activeNav: 'dashboard',
      staff,
      toast: flashToast(req.query, {
        welcome: 'Signed in successfully. Welcome back!',
      }),
      todayLabel: formatDate(today),
      stats: {
        totalMembers: members.length,
        activeSubs: activeSubs.length,
        inGymNow: inGymNow.length,
        todayVisits: todayCheckIns.length,
      },
      monthRevenue: peso.format(monthRevenue),
      checkIns: todayCheckIns.map((a) => ({
        id: a.id,
        memberName: memberName.get(a.member_id) ?? `Member #${a.member_id}`,
        membershipNo: memberNo.get(a.member_id) ?? '—',
        checkIn: formatTime(a.check_in),
        checkOut: formatTime(a.check_out),
        open: a.check_out === null,
      })),
      expiring,
    })
  } catch (err) {
    next(err)
  }
}
