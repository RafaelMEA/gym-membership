import { z } from 'zod'

export const createMemberSchema = z.object({
  first_name: z.string().trim().min(1).max(60),
  last_name:  z.string().trim().min(1).max(60),
  email:      z.string().trim().toLowerCase().email(),

  phone:  z.union([z.string().max(30), z.literal(''), z.null()]),
  gender: z.enum(['male', 'female', 'other', 'undisclosed']).default('undisclosed'),
})

export const updateMemberSchema = createMemberSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
)