import { Router } from 'express'
import { showLogin, login, logout, dashboard } from './web.controller.js'
import { requirePageAuth, redirectIfAuthed } from '../../middleware/requirePageAuth.js'

const router = Router()

// Page routes are separate from the /api JSON routes. They render HTML,
// redirect instead of 401, and live in this module.
router.get('/login', redirectIfAuthed, showLogin)
router.post('/login', login)
router.post('/logout', logout)
router.get('/', requirePageAuth, dashboard)

export const webRouter = router
