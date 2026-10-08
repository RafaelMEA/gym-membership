import { AppError } from '../../middleware/error.js'
import {findAll, findByEmail, create, MemberRow, findById, UpdateMemberData, remove, update} from './member.repository.js'
import { createMemberSchema } from './member.schema.js'

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

export async function updateMember(id: number, data: Partial<UpdateMemberData>): Promise<MemberRow> {
  const member = await update(id, data) 
  if (!member) throw new AppError(404, 'NOT_FOUND', 'Member not found')
  return member
}
  
export async function removeMember(id: number): Promise<void> {
  const affected = await remove(id)
  if (affected === 0) throw new AppError(404, 'NOT_FOUND', 'Member not found')
}