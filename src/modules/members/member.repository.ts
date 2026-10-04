import { pool } from '../../config/db.js'
import type { RowDataPacket } from 'mysql2'

export interface MemberRow extends RowDataPacket {
  id: number
  membership_no: string
  first_name: string
  last_name: string
  email: string
}

export async function findByEmail(email: string) {
  const [rows] = await pool.execute(
    `SELECT id, membership_no, first_name, last_name, email
     FROM members WHERE email = ?`, [email])
     console.log('findByEmail rows:', rows)
  return rows as MemberRow[]
}