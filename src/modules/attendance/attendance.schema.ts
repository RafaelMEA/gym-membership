import { z } from 'zod'


export const checkInSchema = z.object({
  member_id: z.coerce.number().int().positive(),
})

export const checkOutSchema = z.object({
  member_id: z.coerce.number().int().positive().optional(),
  id: z.coerce.number().int().positive().optional(),
})
  .superRefine((v, ctx) => {
    if (v.member_id === undefined && v.id === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'member_id or id is required',
        path: ['member_id'],
      })
    }
    if (v.member_id !== undefined && v.id !== undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'provide only one of member_id or id',
        path: ['id'],
      })
    }
  })

export const listAttendanceSchema = z.object({
  member_id: z.coerce.number().int().positive().optional(),
  active_only: z.coerce.boolean().optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})
  .superRefine((v, ctx) => {
    if (v.from !== undefined && v.to !== undefined && v.to < v.from) {
      ctx.addIssue({
        code: 'custom',
        message: 'to must be on or after from',
        path: ['to'],
      })
    }
  })
