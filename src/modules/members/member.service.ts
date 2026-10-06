import { AppError } from '../../middleware/error.js'
import {findAll, findByEmail, create} from './member.repository.js'
import { createMemberSchema } from './member.schema.js'

export const listMembers = () => findAll()

export async function createMember(data: unknown) {
  const parsed = createMemberSchema.parse(data)          // ZodError if invalid
  const existing = await findByEmail(parsed.email)
  if (existing.length > 0) {
    throw new AppError(409, 'EMAIL_TAKEN', 'That email is already registered')
  }
  return create(parsed)
}