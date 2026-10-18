import { AppError } from '../../middleware/error.js'
import {findAll, findByEmail, create, MemberRow, findById, remove, update} from './member.repository.js'
import { createMemberSchema, updateMemberSchema } from './member.schema.js'

export const listMembers = () => findAll()

export async function createMember(data: unknown) {
  const parsed = createMemberSchema.parse(data) 
  const existing = await findByEmail(parsed.email)
  if (existing.length > 0) {
    throw new AppError(409, 'EMAIL_TAKEN', 'That email is already registered')
  }
  return create(parsed)
}

export async function getMemberById(id: number): Promise<MemberRow> {
  const member = await findById(id)          
  if (!member) throw new AppError(404, 'NOT_FOUND', 'Member not found')
  return member
}

export async function updateMember(id: number, data: unknown): Promise<MemberRow> {
  const parsed = updateMemberSchema.parse(data)

  const member = await findById(id)
  if (!member) throw new AppError(404, 'NOT_FOUND', 'Member not found')

  if (parsed.email && parsed.email !== member.email) {
    const existing = await findByEmail(parsed.email)
    if (existing.length > 0) {
      throw new AppError(409, 'EMAIL_TAKEN', 'That email is already registered')
    }
  }

  const updated = await update(id, parsed)
  if (!updated) throw new AppError(404, 'NOT_FOUND', 'Member not found')
  return updated
}
  
export async function removeMember(id: number, actor: { role: string }) {
  if (actor.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Only admins may delete members')
  }
  const affected = await remove(id)
  if (affected === 0) throw new AppError(404, 'NOT_FOUND', 'Member not found')
}