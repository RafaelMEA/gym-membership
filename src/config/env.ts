
import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT:        z.coerce.number().int().positive().default(3000),   // coerce: "3000" → 3000
  DB_HOST:     z.string().min(1),
  DB_PORT:     z.coerce.number().int().default(3306),
  DB_USER:     z.string().min(1),
  DB_PASSWORD: z.string().default(''),   // XAMPP root has no password
  DB_NAME:     z.string().min(1).default('gym_membership'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment variables:')
  console.error(parsed.error.format())
  process.exit(1)     // fail NOW, loudly, at boot
}

export const env = parsed.data
