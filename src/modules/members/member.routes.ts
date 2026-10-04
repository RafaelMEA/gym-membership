import { Router } from 'express'
import { findAll, create, findById, update, remove } from './member.controller.js'

export const memberRouter = Router()

memberRouter.get('/', findAll)
memberRouter.post('/', create)
memberRouter.get('/:id', findById)
memberRouter.patch('/:id', update)
memberRouter.delete('/:id', remove)