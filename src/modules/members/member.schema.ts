import { z } from 'zod'

export const createMemberSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name:  z.string().trim().min(1).max(60),
  email:      z.string().trim().toLowerCase().email(),

  phone:  z.union([z.string().max(30), z.literal(''), z.null()]),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']).default('undisclosed'),
})