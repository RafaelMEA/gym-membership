import { Router } from 'express'
import { requireAuth } from '../../middleware/requireAuth.js'
import {
    findAll,
    findActive,
    findById,
    create,
    update,
    cancel
} from './subscriptions.controller.js'

export const subscriptionRouter = Router()

subscriptionRouter.use(requireAuth)

subscriptionRouter.get('/', findAll)
subscriptionRouter.get('/active', findActive)
subscriptionRouter.get('/:id', findById)
subscriptionRouter.post('/', create)
subscriptionRouter.patch('/:id', update)
subscriptionRouter.post('/:id/cancel', cancel)
