import { z } from "zod";

export const createPlanSchema = z.object({
  name:        z.string().trim().min(2).max(80),
  description: z.string().trim().max(255).nullable().optional(),
  price:       z.coerce.number().nonnegative(),
  duration_value: z.number().int().positive().default(1),
  duration_unit:  z.enum(['day', 'week', 'month', 'year']).default('month'),
  max_visits_per_period: z.number().int().positive().nullable().optional(),
})

export const updatePlanSchema = z.object({
    name:        z.string().trim().min(2).max(80).optional(),
    description: z.string().trim().max(255).nullable().optional(),
    price:       z.coerce.number().nonnegative().optional(),
    duration_value: z.number().int().positive().optional(),
    duration_unit:  z.enum(['day', 'week', 'month', 'year']).optional(),
    max_visits_per_period: z.number().int().positive().nullable().optional(),
})