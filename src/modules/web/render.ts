import ejs from 'ejs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Response } from 'express'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const viewsDir = path.resolve(currentDir, '../../views')

export interface PageLocals {
  title: string
  /** which sidebar item is active, e.g. 'dashboard' */
  activeNav?: string
  /** set by requirePageAuth */
  staff?: {
    id: number
    full_name: string
    email: string
    role: string
  }
  [key: string]: unknown
}

/**
 * Two-pass rendering without a layout plugin:
 *
 *  1. render the page content view into a string
 *  2. render layout.ejs with that string as `body`
 *
 * express-ejs-layouts could do this too, but the two-pass helper keeps
 * the flow explicit and dependency-free.
 */
export async function renderPage(
  res: Response,
  contentTemplate: string,
  data: PageLocals,
): Promise<void> {
  const body = await ejs.renderFile(path.join(viewsDir, contentTemplate), data)
  const html = await ejs.renderFile(path.join(viewsDir, 'layout/layout.ejs'), {
    ...data,
    body,
  })
  res.send(html)
}

/** Render one template on its own — the login page has no sidebar. */
export async function renderStandalone(
  res: Response,
  template: string,
  data: Record<string, unknown>,
): Promise<void> {
  const html = await ejs.renderFile(path.join(viewsDir, template), data)
  res.send(html)
}
