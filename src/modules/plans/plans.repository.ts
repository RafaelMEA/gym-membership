import { ResultSetHeader, RowDataPacket } from "mysql2";
import { pool } from "../../config/db.js";

export interface PlanRow extends RowDataPacket {
  id: number;
  name: string;
  description: string | null;
  price: string;
  duration_value: number;
  duration_unit: "day" | "week" | "month" | "year";
  max_visits_per_period: number | null;
  is_active: number;
}

export interface CreatePlanData {
  name: string;
  description?: string | null;
  price: number;
  duration_value: number;
  duration_unit: "day" | "week" | "month" | "year";
  max_visits_per_period?: number | null;
}

export interface UpdatePlanData extends Partial<CreatePlanData> {
  name?: string;
  description?: string | null;
  price?: number;
  duration_value?: number;
  duration_unit?: "day" | "week" | "month" | "year";
  max_visits_per_period?: number | null;
}

export async function findAll(): Promise<PlanRow[]> {
  const [rows] = await pool.execute(
    "SELECT id, name, description, price, duration_value, duration_unit, max_visits_per_period, is_active FROM membership_plans WHERE is_active = 1",
  );
  return rows as PlanRow[];
}

export async function findById(id: number): Promise<PlanRow | null> {
  const [rows] = await pool.execute(
    "SELECT id, name, description, price, duration_value, duration_unit, max_visits_per_period, is_active FROM membership_plans WHERE id = ? AND is_active = 1",
    [id],
  );
  const plan = (rows as PlanRow[])[0];
  return plan || null;
}

export async function findByName(name: string): Promise<PlanRow | null> {
  const [rows] = await pool.execute(
    "SELECT id, name, description, price, duration_value, duration_unit, max_visits_per_period, is_active FROM membership_plans WHERE name = ?",
    [name],
  );
  const plan = (rows as PlanRow[])[0];
  return plan || null;
}

export async function create(data: CreatePlanData): Promise<PlanRow> {
  const [result] = await pool.execute(
    "INSERT INTO membership_plans (name, description, price, duration_value, duration_unit, max_visits_per_period) VALUES (?, ?, ?, ?, ?, ?)",
    [
      data.name,
      data.description ?? null,
      data.price,
      data.duration_value,
      data.duration_unit,
      data.max_visits_per_period ?? null,
    ],
  );
  const insertId = (result as ResultSetHeader).insertId;

  const [rows] = await pool.execute(
    `SELECT id, name, description, price, duration_value, duration_unit, max_visits_per_period
       FROM membership_plans WHERE id = ?`,
    [insertId],
  );
  return (rows as PlanRow[])[0]!;
}

// update plans
const ALLOWED_FIELDS = [
  "name",
  "description",
  "price",
  "duration_value",
  "duration_unit",
  "max_visits_per_period",
];

export async function update(
  id: number,
  data: Partial<UpdatePlanData>,
): Promise<PlanRow | null> {
  const fields = Object.keys(data).filter((f) => ALLOWED_FIELDS.includes(f));
  if (fields.length === 0) return findById(id)

  const setClause = fields.map((f) => `${f} = ?`).join(", ");
  const values = fields.map((f) => data[f as keyof UpdatePlanData] ?? null);

  await pool.execute(`UPDATE membership_plans SET ${setClause} WHERE id = ?`, [
    ...values,
    id,
  ]);
  return findById(id);
}

export async function remove(id: number): Promise<number> {
  const [result] = await pool.execute("UPDATE membership_plans SET is_active = 0 WHERE id = ? AND is_active = 1", [id],
  )

  return (result as ResultSetHeader).affectedRows
}
