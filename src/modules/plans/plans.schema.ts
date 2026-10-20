import { z } from "zod";

const durationUnit = z.enum(["day", "week", "month", "year"]);

const planFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(255).nullable(),
  price: z.coerce.number().nonnegative(),
  duration_value: z.number().int().positive(),
  duration_unit: durationUnit,
  max_visits_per_period: z.number().int().positive().nullable(),
};

export const createPlanSchema = z.object({
  ...planFields,
  description: planFields.description.optional(),
  max_visits_per_period: planFields.max_visits_per_period.optional(),
  duration_value: planFields.duration_value.default(1),
  duration_unit: planFields.duration_unit.default("month"),
});

export const updatePlanSchema = z
  .object(planFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });