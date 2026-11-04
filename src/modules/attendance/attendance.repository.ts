import { pool } from "../../config/db.js";
import type { DbExecutor } from "../../config/db.js";
import type { ResultSetHeader, RowDataPacket } from "mysql2";

export interface AttendanceRow extends RowDataPacket {
  id: number;
  member_id: number;
  check_in: string;
  check_out: string | null;
}

export interface AttendanceFilters {
  member_id?: number;
  active_only?: boolean;
  from?: string;
  to?: string;
}

type BindValue = string | number | boolean | null;

const ATTENDANCE_SELECT = `
  SELECT id, member_id, check_in, check_out
  FROM attendance`;

export async function findAll(
  filters: AttendanceFilters = {},
  db: DbExecutor = pool,
): Promise<AttendanceRow[]> {
  const where: string[] = [];
  const params: BindValue[] = [];

  if (filters.member_id !== undefined) {
    where.push("member_id = ?");
    params.push(filters.member_id);
  }

  if (filters.active_only) {
    where.push("check_out IS NULL");
  }

  if (filters.from !== undefined) {
    where.push("DATE(check_in) >= ?");
    params.push(filters.from);
  }

  if (filters.to !== undefined) {
    where.push("DATE(check_in) <= ?");
    params.push(filters.to);
  }

  const sql = `
    ${ATTENDANCE_SELECT}
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY check_in DESC, id DESC`;

  const [rows] = await db.execute(sql, params);
  return rows as AttendanceRow[];
}

export async function findById(
  id: number,
  db: DbExecutor = pool,
): Promise<AttendanceRow | undefined> {
  const [rows] = await db.execute(
    `${ATTENDANCE_SELECT}
     WHERE id = ?`,
    [id],
  );

  return (rows as AttendanceRow[])[0];
}

export async function findOpenByMember(
  memberId: number,
  db: DbExecutor = pool,
): Promise<AttendanceRow | undefined> {
  const [rows] = await db.execute(
    `${ATTENDANCE_SELECT}
     WHERE member_id = ? AND check_out IS NULL
     ORDER BY check_in DESC, id DESC
     LIMIT 1`,
    [memberId],
  );

  return (rows as AttendanceRow[])[0];
}

export async function lockOpenByMember(
  memberId: number,
  db: DbExecutor,
): Promise<AttendanceRow | undefined> {
  const [rows] = await db.execute(
    `${ATTENDANCE_SELECT}
     WHERE member_id = ? AND check_out IS NULL
     ORDER BY check_in DESC, id DESC
     LIMIT 1
     FOR UPDATE`,
    [memberId],
  );

  return (rows as AttendanceRow[])[0];
}

export async function lockOpenById(
  id: number,
  db: DbExecutor,
): Promise<AttendanceRow | undefined> {
  const [rows] = await db.execute(
    `${ATTENDANCE_SELECT}
     WHERE id = ? AND check_out IS NULL
     FOR UPDATE`,
    [id],
  );

  return (rows as AttendanceRow[])[0];
}

export async function lockActiveMember(
  memberId: number,
  db: DbExecutor,
): Promise<boolean> {
  const [rows] = await db.execute(
    `SELECT id FROM members WHERE id = ? AND is_active = 1 FOR UPDATE`,
    [memberId],
  );
  return (rows as RowDataPacket[]).length > 0;
}


export async function checkIn(
  memberId: number,
  db: DbExecutor = pool,
): Promise<AttendanceRow> {
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO attendance (member_id, check_in, check_out)
     VALUES (?, NOW(), NULL)`,
    [memberId],
  );

  const opened = await findById(result.insertId, db);
  if (!opened) {
    throw new Error("Failed to load created attendance");
  }
  return opened;
}

export async function checkOut(
  id: number,
  db: DbExecutor = pool,
): Promise<AttendanceRow | undefined> {
  const [result] = await db.execute<ResultSetHeader>(
    `UPDATE attendance
     SET check_out = NOW()
     WHERE id = ? AND check_out IS NULL`,
    [id],
  );

  if (result.affectedRows === 0) {
    return undefined;
  }

  return findById(id, db);
}
