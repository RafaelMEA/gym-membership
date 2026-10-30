import { z } from "zod";

const paymentMethod = z.enum(["cash", "card", "transfer", "online"]);
const paymentStatus = z.enum(["paid", "pending", "failed", "refunded"]);

export const createPaymentSchema = z.object({
  subscription_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  method: paymentMethod,
  status: paymentStatus.default("paid"),
  paid_at: z.iso.date().optional(),
  notes: z.string().trim().max(255).optional(),
});

export const updatePaymentSchema = z
  .object({
    amount: z.coerce.number().positive().optional(),
    method: paymentMethod.optional(),
    status: paymentStatus.optional(),
    paid_at: z.iso.date().optional(),
    notes: z.string().trim().max(255).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided for update",
  });

export const listPaymentsSchema = z.object({
  subscription_id: z.coerce.number().int().positive().optional(),
  member_id: z.coerce.number().int().positive().optional(),
  status: paymentStatus.optional(),
});
