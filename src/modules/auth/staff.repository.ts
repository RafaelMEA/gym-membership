import { pool } from '../../config/db.js'
import type { RowDataPacket } from 'mysql2'

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