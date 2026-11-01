import type { Request, Response, NextFunction } from "express";
import {
  listPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  refundPayment,
} from "./payments.service.js";
import { listPaymentsSchema } from "./payments.schema.js";

export async function findAll(req: Request, res: Response, next: NextFunction) {
  try {
    listPaymentsSchema.parse(req.query);
    const rows = await listPayments();
    res.json({
      data: rows,
      meta: { page: 1, limit: 20, total: rows.length, totalPages: 1 },
    });
  } catch (err) {
    next(err);
  }
}

export async function findById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: "INVALID_ID", message: "Invalid payment ID", details: [] } });
    return;
  }
  try {
    const payment = await getPaymentById(id);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const payment = await createPayment(req.body);
    res
      .status(201)
      .location(`/api/payments/${payment.id}`)
      .json({ data: payment });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: "INVALID_ID", message: "Invalid payment ID", details: [] } });
    return;
  }
  try {
    const payment = await updatePayment(id, req.body);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
}

export async function refund(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: "INVALID_ID", message: "Invalid payment ID", details: [] } });
    return;
  }
  try {
    const note = (req.body?.notes as string | undefined) ?? undefined;
    const payment = await refundPayment(id, note);
    res.json({ data: payment });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res
      .status(400)
      .json({ error: { code: "INVALID_ID", message: "Invalid payment ID", details: [] } });
    return;
  }
  // Payments are never deleted
  res.status(405).json({
    error: { code: "METHOD_NOT_ALLOWED", message: "Payments cannot be deleted", details: [] },
  });
}
