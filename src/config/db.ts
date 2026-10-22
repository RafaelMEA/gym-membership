import mysql from 'mysql2/promise'
import type { Pool, PoolConnection } from 'mysql2/promise'
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

/**
 * Anything that can run a query.
 *
 * `Pool` and `PoolConnection` expose the exact same `.execute()` /
 * `.query()` signatures (both extend mysql2's Connection), so a
 * repository function can accept either.
 *
 * This is what lets the SAME repository function run standalone
 * (against the pool) or inside a transaction (against the
 * transaction's connection).
 */
export type DbExecutor = Pool | PoolConnection

/**
 * Run `fn` inside a database transaction.
 *
 *   await withTransaction(async (db) => {
 *     await doThing(db)
 *     await doOtherThing(db)
 *   })
 *
 * - COMMIT if `fn` resolves
 * - ROLLBACK if `fn` throws, then the error is re-thrown
 * - the connection is ALWAYS released back to the pool
 *
 * IMPORTANT: every query that must take part in the transaction has to
 * use the `db` handed to `fn`. Calling `pool.execute(...)` inside the
 * callback would grab a DIFFERENT pooled connection and run outside
 * the transaction entirely.
 */
export async function withTransaction<T>(
  fn: (db: DbExecutor) => Promise<T>,
): Promise<T> {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}
