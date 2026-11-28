import { z } from "zod";

const durationUnit = z.enum(["day", "week", "month", "year"]);

const planFields = {
  name: z.string().trim().min(2, 'Use at least 2 characters').max(80, 'Use 80 characters or fewer'),
  description: z.string().trim().max(255, 'Use 255 characters or fewer').nullable(),
  price: z.coerce.number('Enter a valid price').nonnegative('Price can’t be negative'),
  duration_value: z.number().int().positive('Duration must be at least 1'),
  duration_unit: durationUnit,
  max_visits_per_period: z.number().int().positive('Visits must be at least 1').nullable(),
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