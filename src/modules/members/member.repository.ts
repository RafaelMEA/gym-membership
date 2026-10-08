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

export interface UpdateMemberData extends Partial<CreateMemberData> {
  first_name?: string
  last_name?: string
  email?: string
  phone?: string | null
  gender?: string
}

export async function findByEmail(email: string) {
  const [rows] = await pool.execute(
    `SELECT id, membership_no, first_name, last_name, email
     FROM members WHERE email = ?`, [email])
  return rows as MemberRow[]
}

// get all members
export async function findAll(): Promise<MemberRow[]> {
  const [rows] = await pool.query(
  'SELECT id, membership_no, first_name, last_name, email FROM members WHERE is_active = 1')
  return rows as MemberRow[]
}

// get member by id
export async function findById(id: number): Promise<MemberRow | null> {
  const [rows] = await pool.execute(
  `SELECT id, membership_no, first_name, last_name, email
   FROM members WHERE id = ? AND is_active = 1`, [id])
  return (rows as MemberRow[])[0] ?? null
}

// create members
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
  return (rows as MemberRow[])[0]!
}

// update member
const ALLOWED_FIELDS = ['first_name', 'last_name', 'email', 'phone', 'gender']

export async function update(id: number, data: Partial<UpdateMemberData>): Promise<MemberRow | null> {
  const fields = Object.keys(data).filter(f => ALLOWED_FIELDS.includes(f))
  if (fields.length === 0) return findById(id)

  const setClause = fields.map(f => `${f} = ?`).join(', ')
  const values = fields.map(f => data[f as keyof UpdateMemberData] ?? null)

  await pool.execute(`UPDATE members SET ${setClause} WHERE id = ?`, [...values, id])
  return findById(id)
}

// delete member
export async function remove(id: number): Promise<number> {
  const [result] = await pool.execute(
    'UPDATE members SET is_active = 0 WHERE id = ? AND is_active = 1',
    [id],
  )
  return (result as ResultSetHeader).affectedRows
}
