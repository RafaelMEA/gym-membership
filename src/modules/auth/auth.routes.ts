import { Router } from 'express'
import { register, login, me, logout } from './auth.controller.js'
import { requireAuth } from '../../middleware/requireAuth.js'

export const authRouter = Router()

authRouter.post('/register', register)
authRouter.post('/login', login)
authRouter.get('/me', requireAuth, me)
authRouter.post('/logout', logout)