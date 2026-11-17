import { Router } from 'express'
import { showLogin, login, logout, dashboard } from './web.controller.js'
import * as membersPages from './members.pages.js'
import * as subscriptionsPages from './subscriptions.pages.js'
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

export const webRouter = router
