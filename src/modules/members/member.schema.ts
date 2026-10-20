import { z } from "zod";

const gender = z.enum(["male", "female", "other", "undisclosed"]);

const memberFields = {
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().email(),
  phone: z.union([z.string().max(30), z.literal(""), z.null()]),
  gender,
};

export const createMemberSchema = z.object({
  ...memberFields,
  gender: gender.default("undisclosed"),
});

export const updateMemberSchema = z
  .object(memberFields)
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update",
  });