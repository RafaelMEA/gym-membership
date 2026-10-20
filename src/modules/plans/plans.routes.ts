import { Router } from 'express'
import { findAll, create, findById, update, remove } from './plans.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

export const planRouter = Router()

planRouter.use(requireAuth)

planRouter.get('/', findAll)
planRouter.post('/', create)
planRouter.get('/:id', findById)
planRouter.patch('/:id', update)
planRouter.delete('/:id', remove)