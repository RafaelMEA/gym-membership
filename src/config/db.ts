import mysql from 'mysql2/promise'
import { env } from './env.js'

export const pool = mysql.createPool({
  host:     env.DB_HOST,
  port:     env.DB_PORT,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: 10,        // max concurrent connections
  waitForConnections: true,   // queue instead of throwing when full
  enableKeepAlive: true,      // detect dead connections
  timezone: 'Z',              // see the date section below
  dateStrings: true,   // ← add: DATE/DATETIME as 'YYYY-MM-DD', not Date objects
})
