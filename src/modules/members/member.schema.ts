import { z } from "zod";

const gender = z.enum(["male", "female", "other", "undisclosed"]);

const memberFields = {
  first_name: z.string().trim().min(1, 'First name is required').max(60, 'Use 60 characters or fewer'),
  last_name: z.string().trim().min(1, 'Last name is required').max(60, 'Use 60 characters or fewer'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address').max(254, 'Use 254 characters or fewer'),
  phone: z.union([z.string().max(30, 'Use 30 characters or fewer'), z.literal(""), z.null()]),
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
