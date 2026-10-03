import { pool } from './config/db.js'
import { env } from './config/env.js'

const [rows] = await pool.query('SELECT 1 AS ok')
console.log('DB reachable:', rows)
console.log(`Listening on http://localhost:${env.PORT}`)

await pool.end()   // close cleanly instead of hanging the process