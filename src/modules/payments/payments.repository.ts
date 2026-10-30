import { pool } from "../../config/db.js";
import type { DbExecutor } from "../../config/db.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export type PaymentMethod = "cash" | "card" | "transfer" | "online";
export type PaymentStatus = "paid" | "pending" | "failed" | "refunded";

export interface PaymentRow extends RowDataPacket {
  id: number;
  subscription_id: number;
  reference_no: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentData {
  subscription_id: number;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paid_at?: string | null;
  notes?: string | null;
}

export interface UpdatePaymentData {
  amount?: number;
  method?: PaymentMethod;
  status?: PaymentStatus;
  paid_at?: string | null;
  notes?: string | null;
}

type BindValue = string | number | boolean | null;

const PAYMENT_SELECT = `
  SELECT id, subscription_id, reference_no, amount, method, status, paid_at, notes, created_at, updated_at
  FROM payments
`;

export async function findAll(db: DbExecutor = pool): Promise<PaymentRow[]> {
  const [rows] = await db.execute(`${PAYMENT_SELECT} ORDER BY id`);
  return rows as PaymentRow[];
}

export async function findById(
  id: number,
  db: DbExecutor = pool,
): Promise<PaymentRow | undefined> {
  const [rows] = await db.execute(`${PAYMENT_SELECT} WHERE id = ?`, [id]);
  return (rows as PaymentRow[])[0];
}

export async function create(
  data: CreatePaymentData,
  db: DbExecutor = pool,
): Promise<PaymentRow> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO payments (subscription_id, amount, method, status, paid_at, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      data.subscription_id,
      data.amount,
      data.method,
      data.status,
      data.paid_at ?? null,
      data.notes ?? null,
    ],
  );

  const created = await findById(result.insertId, db);
  if (!created) {
    throw new Error("Failed to load created payment");
  }
  return created;
}

export async function update(
  id: number,
  data: UpdatePaymentData,
  db: DbExecutor = pool,
): Promise<PaymentRow | undefined> {
  const sets: string[] = [];
  const params: BindValue[] = [];

  if (data.amount !== undefined) {
    sets.push("amount = ?");
    params.push(data.amount);
  }
  if (data.method !== undefined) {
    sets.push("method = ?");
    params.push(data.method);
  }
  if (data.status !== undefined) {
    sets.push("status = ?");
    params.push(data.status);
  }
  if (data.paid_at !== undefined) {
    sets.push("paid_at = ?");
    params.push(data.paid_at);
  }
  if (data.notes !== undefined) {
    sets.push("notes = ?");
    params.push(data.notes);
  }

  if (sets.length === 0) {
    return findById(id, db);
  }

  params.push(id);
  await db.execute(`UPDATE payments SET ${sets.join(", ")} WHERE id = ?`, params);

  return findById(id, db);
}