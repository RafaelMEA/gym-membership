import { pool } from '../../config/db.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'

export interface StaffRow extends RowDataPacket {
    id:number
    full_name:string
    email:string
    password_hash:string
    role: 'admin' | 'staff'
    is_active:number
}

export async function findByEmail(email: string): Promise<StaffRow | null> {
  const [rows] = await pool.execute(
    'SELECT id, full_name, email, password_hash, role, is_active FROM auth_staff WHERE email = ?',
    [email],
  )
  return (rows as StaffRow[])[0] ?? null
}

export async function create(data: {
  full_name: string
  email: string
  password_hash: string
  role: 'admin' | 'staff'
}): Promise<{ id: number; full_name: string; email: string; role: string }> {
  const [result] = await pool.execute(
    'INSERT INTO auth_staff (full_name, email, password_hash, role) VALUES (?, ?, ?, ?)',
    [data.full_name, data.email, data.password_hash, data.role],
  )
  const insertId = (result as ResultSetHeader).insertId
  return { id: insertId, full_name: data.full_name, email: data.email, role: data.role }
}