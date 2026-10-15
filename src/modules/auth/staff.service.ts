import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import { AppError } from "../../middleware/error.js";
import { env } from "../../config/env.js";
import { create, findByEmail } from "./staff.repository.js";
import { registerSchema, loginSchema } from "./auth.schema.js";

import type { StringValue } from 'ms'

export async function registerStaff(input: unknown) {
  const data = registerSchema.parse(input);

  const existing = await findByEmail(data.email);
  if (existing) {
    throw new AppError(
      409,
      "EMAIL_TAKEN",
      "Staff account with this email already exists",
    );
  }

  const password_hash = await bcrypt.hash(data.password, 10);
  return create({
    full_name: data.full_name,
    email: data.email,
    password_hash,
    role: 'staff',
  })
}

export async function loginStaff(input: unknown) {
  const data = loginSchema.parse(input);

  const staff = await findByEmail(data.email);
  if (!staff || !staff.is_active) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const ok = await bcrypt.compare(data.password, staff.password_hash);
  if (!ok) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const token = signToken(staff);
  return { token, staff: toPublic(staff) };
}

export async function getMe(token: string) {
    const payload = jwt.verify(token, env.JWT_SECRET)
    return payload
}

function signToken(staff: { id: number; role: string }) {
  return jwt.sign(
    { sub: String(staff.id), role: staff.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as StringValue }
  )
}

function toPublic(staff: { id: number; full_name: string; email: string; role: string }) {
  return { id: staff.id, full_name: staff.full_name, email: staff.email, role: staff.role }
}
