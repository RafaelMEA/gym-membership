import { Router } from 'express'
import { showLogin, login, logout, dashboard } from './web.controller.js'
import * as membersPages from './members.pages.js'
import * as subscriptionsPages from './subscriptions.pages.js'
import * as plansPages from './plans.pages.js'
import * as paymentsPages from './payments.pages.js'
import * as attendancePages from './attendance.pages.js'
import { requirePageAuth, redirectIfAuthed } from '../../middleware/requirePageAuth.js'

const router = Router()

// Page routes are separate from the /api JSON routes. They render HTML,
// redirect instead of 401, and live in this module.
router.get('/login', redirectIfAuthed, showLogin)
router.post('/login', login)
router.post('/logout', logout)
router.get('/', requirePageAuth, dashboard)

// Members — pages call the same services the API does, then render HTML
router.get('/members', requirePageAuth, membersPages.list)
router.post('/members', requirePageAuth, membersPages.create)
// :id/remove must be matched before :id — both are single-segment POSTs,
// but '/members/5/remove' has two segments so it can't collide; order is
// still kept explicit for readability.
router.post('/members/:id/remove', requirePageAuth, membersPages.remove)
router.post('/members/:id', requirePageAuth, membersPages.update)
router.get('/members/:id', requirePageAuth, membersPages.detail)

// Subscriptions
router.get('/subscriptions', requirePageAuth, subscriptionsPages.list)
router.post('/subscriptions', requirePageAuth, subscriptionsPages.create)

// Plans
router.get('/plans', requirePageAuth, plansPages.list)
router.post('/plans', requirePageAuth, plansPages.create)
router.post('/plans/:id/remove', requirePageAuth, plansPages.remove)
router.post('/plans/:id', requirePageAuth, plansPages.update)

// Payments (no delete — refund only)
router.get('/payments', requirePageAuth, paymentsPages.list)
router.post('/payments', requirePageAuth, paymentsPages.create)
router.post('/payments/:id/refund', requirePageAuth, paymentsPages.refund)

// Attendance — action endpoints, not CRUD
router.get('/attendance', requirePageAuth, attendancePages.index)
router.post('/attendance/check-in', requirePageAuth, attendancePages.checkIn)
router.post('/attendance/check-out', requirePageAuth, attendancePages.checkOut)

export const webRouter = router
