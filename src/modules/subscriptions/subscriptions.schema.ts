import { z } from "zod";

const subscriptionStatus = z.enum(["active", "cancelled", "frozen"]);

export const createSubscriptionSchema = z.object({
  member_id: z.coerce.number().int().positive(),
  plan_id: z.coerce.number().int().positive(),
  start_date: z.iso.date().optional(),
  auto_renew: z.boolean().optional(),
});

export const updateSubscriptionSchema = z
  .object({
    status: subscriptionStatus.optional(),
    auto_renew: z.boolean().optional(),
    cancellation_reason: z.string().trim().min(1).max(255).optional(),
    frozen_until: z.iso.date().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field must be provided for update",
  })
  .superRefine((v, ctx) => {
    if (v.status === "cancelled" && !v.cancellation_reason) {
      ctx.addIssue({
        code: "custom",
        message: "cancellation_reason is required when cancelling",
        path: ["cancellation_reason"],
      });
    }
    if (v.status === "frozen" && !v.frozen_until) {
      ctx.addIssue({
        code: "custom",
        message: "frozen_until is required when freezing",
        path: ["frozen_until"],
      });
    }
  });

export const listSubscriptionsSchema = z.object({
  member_id: z.coerce.number().int().positive().optional(),
  status: subscriptionStatus.optional(),
});