import { AppError } from "../../middleware/error.js";
import { withTransaction } from "../../config/db.js";
import type { DbExecutor } from "../../config/db.js";
import { findAll, findById, create, update, type PaymentRow } from "./payments.repository.js";
import { createPaymentSchema, updatePaymentSchema } from "./payments.schema.js";
import { findById as findSubscriptionById } from "../subscriptions/subscriptions.repository.js";

async function getNow(db: DbExecutor): Promise<string> {
  const [rows] = await db.execute("SELECT NOW() AS now");
  const row = (rows as Array<{ now: string } & import("mysql2").RowDataPacket>)[0];
  if (!row?.now) {
    throw new Error("Failed to get NOW() from database");
  }
  return row.now;
}

export const listPayments = () => findAll();

export async function getPaymentById(id: number): Promise<PaymentRow> {
  const payment = await findById(id);
  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }
  return payment;
}

export async function createPayment(data: unknown): Promise<PaymentRow> {
  const parsed = createPaymentSchema.parse(data);

  const subscription = await findSubscriptionById(parsed.subscription_id);
  if (!subscription) {
    throw new AppError(404, "SUBSCRIPTION_NOT_FOUND", "Subscription not found");
  }

  return withTransaction(async (db) => {
    let paidAt: string | null = parsed.paid_at ?? null;

    if (parsed.status === "paid" && !paidAt) {
      paidAt = await getNow(db);
    }

    if (parsed.status !== "paid") {
      paidAt = null;
    }

    const created = await create(
      {
        subscription_id: parsed.subscription_id,
        amount: parsed.amount,
        method: parsed.method,
        status: parsed.status,
        paid_at: paidAt,
        notes: parsed.notes ?? null,
      },
      db,
    );

    return created;
  });
}

export async function updatePayment(id: number, data: unknown): Promise<PaymentRow> {
  const parsed = updatePaymentSchema.parse(data);

  const payment = await findById(id);
  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }
  if (parsed.status === "paid" && parsed.paid_at === undefined && !payment.paid_at) {
    const now = await getNow(await import("../../config/db.js").then((m) => m.pool));
    const updated = await update(id, { ...parsed, paid_at: now });
    if (!updated) {
      throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
    }
    return updated;
  }

  const updated = await update(id, parsed);
  if (!updated) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }
  return updated;
}

export async function refundPayment(id: number, note?: string): Promise<PaymentRow> {
  const payment = await findById(id);
  if (!payment) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }
  if (payment.status === "refunded") {
    throw new AppError(409, "ALREADY_REFUNDED", "This payment has already been refunded");
  }
  if (payment.status !== "paid") {
    throw new AppError(409, "INVALID_REFUND", "Only paid payments can be refunded");
  }

  const updated = await update(id, {
    status: "refunded",
    notes: note?.trim() ? note.trim() : payment.notes,
  });

  if (!updated) {
    throw new AppError(404, "PAYMENT_NOT_FOUND", "Payment not found");
  }
  return updated;
}