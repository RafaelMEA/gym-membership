import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import {
  findAll,
  findOpen,
  findById,
  create,
  close,
  remove,
} from './attendance.controller.js'

const router = Router()

// Whole router requires auth, like the other modules
router.use(requireAuth)

// IMPORTANT: specific routes MUST be registered before '/:id'
// or Express would treat 'active' / 'check-in' as an id.
router.get('/active', findOpen)
router.get('/', findAll)
router.get('/:id', findById)

// Action endpoints — not bare POST / or PATCH /:id.
// A check-in is not a generic create; it has business rules.
router.post('/check-in', create)
router.post('/check-out', close)

// Explicitly rejected, like payments
router.delete('/:id', remove)

export const attendanceRouter = router
