import { Router } from 'express'
import { findAll, create, findById, update, remove } from './member.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

export const memberRouter = Router()

memberRouter.use(requireAuth)

memberRouter.get('/', findAll)
memberRouter.post('/', create)
memberRouter.get('/:id', findById)
memberRouter.patch('/:id', update)
memberRouter.delete('/:id', remove)