import type { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import * as attendanceRepo from '../attendance/attendance.repository.js'
import * as attendanceService from '../attendance/attendance.service.js'
import * as subRepo from '../subscriptions/subscriptions.repository.js'
import * as memberRepo from '../members/member.repository.js'
import * as planRepo from '../plans/plans.repository.js'
import { AppError } from '../../middleware/error.js'
import { daysBetween } from '../../lib/dates.js'
import { renderPage } from './render.js'
import {
  flashToast,
  formatDate,
  formatDuration,
  formatTime,
  getNow,
  getToday,
  initialsOf,
  minutesBetween,
  str,
  type StaffLocal,
  type Toast,
} from './view.js'

/**
 * The front desk page.
 *
 * Check-in eligibility follows the same rule as the API service:
 * a RUNNING subscription (status active, start <= today < end).
 * The page shows everyone, but only eligible members get a button —
 * a disabled row with the reason is friendlier than a hidden one.
 */
async function renderAttendancePage(
  res: Response,
  view: { staff: StaffLocal; q: string; toast: Toast | null },
): Promise<void> {
  const [members, subs, attendance, plans] = await Promise.all([
    memberRepo.findAll(),
    subRepo.findAll(),
    attendanceRepo.findAll(),
    planRepo.findAll(),
  ])
  const today = await getToday()
  const now = await getNow()

  const memberById = new Map(members.map((m) => [m.id, m]))
  const planName = new Map(plans.map((p) => [p.id, p.name]))

  // Running subscription per member — if several overlap, the latest end wins
  const running = new Map<number, { planId: number; endDate: string }>()
  for (const s of subs) {
    if (s.status !== 'active') continue
    if (s.start_date > today || s.end_date <= today) continue
    const current = running.get(s.member_id)
    if (!current || s.end_date > current.endDate) {
      running.set(s.member_id, { planId: s.plan_id, endDate: s.end_date })
    }
  }

  // Open visit per member (findAll is newest-first, keep the first)
  const openByMember = new Map<number, attendanceRepo.AttendanceRow>()
  for (const a of attendance) {
    if (a.check_out === null && !openByMember.has(a.member_id)) {
      openByMember.set(a.member_id, a)
    }
  }

  const nameOf = (memberId: number): string => {
    const m = memberById.get(memberId)
    return m ? `${m.first_name} ${m.last_name}` : `Member #${memberId}`
  }

  const inGym = [...openByMember.values()]
    .sort((a, b) => (a.check_in < b.check_in ? -1 : 1))
    .map((a) => ({
      memberId: a.member_id,
      name: nameOf(a.member_id),
      initials: initialsOf(nameOf(a.member_id)),
      since: formatTime(a.check_in) ?? '—',
      elapsed: formatDuration(minutesBetween(a.check_in, now)),
    }))

  const todayVisits = attendance
    .filter((a) => a.check_in.startsWith(today))
    .map((a) => ({
      id: a.id,
      name: nameOf(a.member_id),
      checkIn: formatTime(a.check_in) ?? '—',
      checkOut: formatTime(a.check_out),
      duration: a.check_out === null ? null : formatDuration(minutesBetween(a.check_in, a.check_out)),
      open: a.check_out === null,
    }))

  const q = view.q.trim().toLowerCase()
  const directory = members
    .filter((m) =>
      q === ''
        ? true
        : `${m.first_name} ${m.last_name} ${m.membership_no}`.toLowerCase().includes(q),
    )
    .map((m) => {
      const sub = running.get(m.id)
      const open = openByMember.get(m.id)
      const name = `${m.first_name} ${m.last_name}`
      const canCheckIn = sub !== undefined && open === undefined
      return {
        id: m.id,
        name,
        initials: initialsOf(name),
        membershipNo: m.membership_no,
        phone: m.phone,
        planName: sub ? planName.get(sub.planId) ?? 'Active plan' : null,
        daysLeft: sub ? daysBetween(today, sub.endDate) : null,
        inGymSince: open ? formatTime(open.check_in) : null,
        canCheckIn,
        rank: canCheckIn ? 0 : open ? 1 : 2,
      }
    })
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))

  await renderPage(res, 'attendance/index.ejs', {
    title: 'Attendance',
    activeNav: 'attendance',
    staff: view.staff,
    q: view.q,
    toast: view.toast,
    todayLabel: formatDate(today),
    stats: {
      inGym: inGym.length,
      todayVisits: todayVisits.length,
      eligible: directory.filter((m) => m.planName !== null).length,
    },
    inGym,
    todayVisits,
    directory,
  })
}

export async function index(req: Request, res: Response, next: NextFunction) {
  try {
    await renderAttendancePage(res, {
      staff: res.locals.staff as StaffLocal,
      q: str(req.query, 'q'),
      toast: flashToast(req.query, {
        checkedin: 'Member checked in.',
        checkedout: 'Member checked out.',
      }),
    })
  } catch (err) {
    next(err)
  }
}

export async function checkIn(req: Request, res: Response, next: NextFunction) {
  try {
    await attendanceService.checkIn({ member_id: str(req.body, 'member_id') })
    res.redirect('/attendance?checkedin=1')
  } catch (err) {
    if (err instanceof AppError) {
      res.redirect('/attendance?error=' + encodeURIComponent(err.message))
      return
    }
    if (err instanceof ZodError) {
      res.redirect('/attendance?error=' + encodeURIComponent('Invalid member'))
      return
    }
    next(err)
  }
}

export async function checkOut(req: Request, res: Response, next: NextFunction) {
  try {
    await attendanceService.checkOut({ member_id: str(req.body, 'member_id') })
    res.redirect('/attendance?checkedout=1')
  } catch (err) {
    if (err instanceof AppError) {
      res.redirect('/attendance?error=' + encodeURIComponent(err.message))
      return
    }
    if (err instanceof ZodError) {
      res.redirect('/attendance?error=' + encodeURIComponent('Invalid member'))
      return
    }
    next(err)
  }
}
