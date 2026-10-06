import { pool } from '../../config/db.js'
import type { ResultSetHeader, RowDataPacket } from 'mysql2'

export interface MemberRow extends RowDataPacket {
  id: number
  membership_no: string
  first_name: string
  last_name: string
  email: string
}

export interface CreateMemberData {
  first_name: string
  last_name: string
  email: string
  phone: string | null
  gender: string
}

export async function findByEmail(email: string) {
  const [rows] = await pool.execute(
    `SELECT id, membership_no, first_name, last_name, email
     FROM members WHERE email = ?`, [email])
     console.log('findByEmail rows:', rows)
  return rows as MemberRow[]
}

export async function findAll(): Promise<MemberRow[]> {
  const [rows] = await pool.query('SELECT id, membership_no, first_name, last_name, email FROM members')
  return rows as MemberRow[]
}

export async function create(data: CreateMemberData): Promise<MemberRow> {
  const [result] = await pool.execute(
    `INSERT INTO members (first_name, last_name, email, phone, gender)
     VALUES (?, ?, ?, ?, ?)`,
    [data.first_name, data.last_name, data.email, data.phone, data.gender],
  )

  const insertId = (result as ResultSetHeader).insertId

  const [rows] = await pool.execute(
    `SELECT id, membership_no, first_name, last_name, email
     FROM members WHERE id = ?`,
    [insertId],
  )
  return (rows as MemberRow[])[0]!   // we just inserted it, it exists
}