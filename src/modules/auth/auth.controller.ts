import type { Request, Response, NextFunction } from "express";
import { registerStaff, loginStaff } from "./staff.service.js";
import { env } from "../../config/env.js";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const staff = await registerStaff(req.body);
    res.status(201).json({ data: staff });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { token, staff } = await loginStaff(req.body);
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      maxAge: 3600_000,
    });
    res.json({ data: staff });
  } catch (err) {
    next(err);
  }
}

export async function me(_req: Request, res: Response) {
  res.json({ data: res.locals.staff });
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie("token");
  res.status(200).end();
}
