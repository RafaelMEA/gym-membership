/**
 * Small behaviors for the server-rendered pages:
 *  - mobile navigation drawer (focus trap, Escape, restore focus)
 *  - modals open via [data-open-modal="#id"], close via [data-close-modal]
 *    (backdrop and X button) or Escape
 *  - [data-toast] banners dismiss themselves
 * No frameworks — the server owns the state, JS only toggles visibility.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function visibleFocusable(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(
    (el) => el instanceof HTMLElement && el.getClientRects().length > 0,
  )
}

function trapFocus(container, event) {
  const items = visibleFocusable(container)
  if (items.length === 0) {
    event.preventDefault()
    return
  }

  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement

  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault()
      last.focus()
    }
  } else if (active === last || !container.contains(active)) {
    event.preventDefault()
    first.focus()
  }
}

// One scroll lock shared by the nav drawer and modals, so closing one
// never unlocks the page while another is still open.
function syncScrollLock() {
  const modalOpen = Array.from(document.querySelectorAll('[data-modal]')).some(
    (modal) => !modal.classList.contains('hidden'),
  )
  const navOpen = document.querySelector('[data-nav-panel].is-open') !== null
  document.body.classList.toggle('overflow-hidden', modalOpen || navOpen)
}

// Mobile navigation: the desktop sidebar becomes a modal drawer below md.
// It traps focus while open, closes on Escape/backdrop, locks page scroll,
// and returns focus to the menu button. Resizing to desktop resets it.
function initMobileNav() {
  const panel = document.querySelector('[data-nav-panel]')
  const backdrop = document.querySelector('[data-nav-backdrop]')
  const openBtn = document.querySelector('[data-open-nav]')
  const closeBtns = document.querySelectorAll('[data-close-nav]')
  if (!(panel instanceof HTMLElement) || !(openBtn instanceof HTMLElement)) return

  const main = document.querySelector('main')
  const desktop = window.matchMedia('(min-width: 768px)')
  let opener = null

  const isOpen = () => panel.classList.contains('is-open')

  const open = () => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : openBtn
    panel.classList.add('is-open')
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-modal', 'true')
    if (backdrop instanceof HTMLElement) backdrop.classList.add('is-open')
    openBtn.setAttribute('aria-expanded', 'true')
    syncScrollLock()
    if (main instanceof HTMLElement) main.inert = true

    const first = visibleFocusable(panel)[0]
    if (first instanceof HTMLElement) first.focus()
    else panel.focus()
  }

  const close = (restoreFocus = true) => {
    if (!isOpen()) return
    panel.classList.remove('is-open')
    panel.removeAttribute('role')
    panel.removeAttribute('aria-modal')
    if (backdrop instanceof HTMLElement) backdrop.classList.remove('is-open')
    openBtn.setAttribute('aria-expanded', 'false')
    syncScrollLock()
    if (main instanceof HTMLElement) main.inert = false

    if (!restoreFocus) return
    if (desktop.matches) {
      const current = panel.querySelector('a[aria-current="page"]')
      if (current instanceof HTMLElement) current.focus()
    } else if (opener instanceof HTMLElement) {
      opener.focus()
    }
  }

  openBtn.addEventListener('click', open)
  closeBtns.forEach((btn) => btn.addEventListener('click', () => close()))
  if (backdrop instanceof HTMLElement) {
    backdrop.addEventListener('click', () => close())
  }

  document.addEventListener('keydown', (e) => {
    if (!isOpen()) return
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'Tab') trapFocus(panel, e)
  })

  desktop.addEventListener('change', (e) => {
    if (!e.matches) return
    const wasOpen = isOpen()
    close(false)
    if (wasOpen) {
      const current = panel.querySelector('a[aria-current="page"]')
      if (current instanceof HTMLElement) current.focus()
    }
  })
}

initMobileNav()

// ── Modals ─────────────────────────────────────────────────
// Every [data-modal] is a dialog with a [data-modal-panel]. Opening one
// locks the page, makes the background inert, moves focus inside and
// remembers the trigger so focus can return. Escape closes; Tab is trapped.
const modalOpeners = new WeakMap()
const modalInerted = new WeakMap()

function modalPanel(modal) {
  return modal.querySelector('[data-modal-panel]') ?? modal
}

// Inert everything that is not an ancestor of the modal (other page
// sections, the sidebar, the footer), skipping the toast layer so status
// announcements still reach assistive tech.
function setBackgroundInert(modal, inert) {
  if (inert) {
    if (modalInerted.has(modal)) return
    const blocked = []
    let node = modal
    while (node && node !== document.body) {
      const parent = node.parentElement
      if (!parent) break
      for (const sibling of Array.from(parent.children)) {
        if (sibling === node) continue
        if (sibling.hasAttribute('data-toast-layer')) continue
        if (sibling instanceof HTMLElement && !sibling.inert) {
          sibling.inert = true
          blocked.push(sibling)
        }
      }
      node = parent
    }
    modalInerted.set(modal, blocked)
  } else {
    const blocked = modalInerted.get(modal) ?? []
    blocked.forEach((el) => {
      el.inert = false
    })
    modalInerted.delete(modal)
  }
}

function openModal(modal, opener) {
  const active = document.activeElement
  modalOpeners.set(
    modal,
    opener instanceof HTMLElement ? opener : active instanceof HTMLElement ? active : null,
  )

  modal.classList.remove('hidden')
  modal.classList.add('flex')
  setBackgroundInert(modal, true)
  syncScrollLock()

  const panel = modalPanel(modal)
  const first =
    panel.querySelector('[data-initial-focus]') ??
    panel.querySelector('input:not([type=hidden]), select, textarea') ??
    visibleFocusable(panel)[0]
  if (first instanceof HTMLElement) first.focus()
  else if (panel instanceof HTMLElement) {
    panel.tabIndex = -1
    panel.focus()
  }
}

function closeModal(modal) {
  modal.classList.add('hidden')
  modal.classList.remove('flex')
  setBackgroundInert(modal, false)
  syncScrollLock()

  const opener = modalOpeners.get(modal)
  modalOpeners.delete(modal)
  if (
    opener instanceof HTMLElement &&
    opener.isConnected &&
    opener.getClientRects().length > 0
  ) {
    opener.focus()
  }
}

document.addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target : null
  if (!target) return

  const opener = target.closest('[data-open-modal]')
  if (opener) {
    const selector = opener.getAttribute('data-open-modal') || ''
    const modal = document.querySelector(selector)
    if (modal) openModal(modal, opener instanceof HTMLElement ? opener : null)
    return
  }

  const closer = target.closest('[data-close-modal]')
  if (closer) {
    const modal = closer.closest('[data-modal]')
    if (modal) closeModal(modal)
  }
})

document.addEventListener('keydown', (e) => {
  const openModals = Array.from(document.querySelectorAll('[data-modal]')).filter(
    (modal) => !modal.classList.contains('hidden'),
  )
  const modal = openModals[openModals.length - 1]
  if (!modal) return

  if (e.key === 'Escape') {
    e.preventDefault()
    closeModal(modal)
    return
  }
  if (e.key === 'Tab') trapFocus(modalPanel(modal), e)
})

// A validation failure re-renders the page with the modal already open.
// Apply the same lock, background inertness and initial focus on load.
document.querySelectorAll('[data-modal]').forEach((modal) => {
  if (modal.classList.contains('hidden')) return
  setBackgroundInert(modal, true)
  const panel = modalPanel(modal)
  const first = panel.querySelector('input:not([type=hidden]), select, textarea')
  if (first instanceof HTMLElement) first.focus()
})
syncScrollLock()

// Toasts: slide in from the right (CSS), auto-dismiss after 5s, or
// dismiss immediately via the X button. Animationend removes the node;
// the timer is a fallback for prefers-reduced-motion.
function dismissToast(toast) {
  if (toast.classList.contains('toast-leave')) return
  toast.classList.remove('toast-enter')
  toast.classList.add('toast-leave')
  const remove = () => toast.remove()
  toast.addEventListener('animationend', remove, { once: true })
  setTimeout(remove, 400)
}

document.addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target : null
  if (!target) return
  const dismiss = target.closest('[data-dismiss-toast]')
  if (!dismiss) return
  const toast = dismiss.closest('[data-toast]')
  if (toast) dismissToast(toast)
})

document.querySelectorAll('[data-toast]').forEach((toast) => {
  setTimeout(() => dismissToast(toast), 5000)
})

// Live search: enhances server-rendered GET forms. Filtering stays on
// the server — we fetch the same page and swap the results region plus
// any synced counters. Debounced, aborts stale requests, keeps focus in
// the input, updates the URL, and falls back to a normal GET on errors.
function initLiveSearch(form) {
  const input = form.querySelector('input[name="q"]')
  const results = document.querySelector('[data-live-results]')
  if (!(input instanceof HTMLInputElement) || !(results instanceof HTMLElement)) return

  const clearBtn = form.querySelector('[data-live-clear]')
  const submitBtn = form.querySelector('button[type="submit"]')
  let debounce = null
  let current = null

  const syncClear = () => {
    if (clearBtn) clearBtn.classList.toggle('hidden', input.value.trim() === '')
  }

  const setBusy = (busy) => {
    results.setAttribute('aria-busy', busy ? 'true' : 'false')
    results.classList.toggle('opacity-60', busy)
    if (submitBtn instanceof HTMLButtonElement) submitBtn.disabled = busy
  }

  const buildUrl = () => {
    const url = new URL(
      form.getAttribute('action') || window.location.pathname,
      window.location.origin,
    )
    const q = input.value.trim()
    if (q) url.searchParams.set('q', q)
    else url.searchParams.delete('q')
    return url
  }

  const run = async () => {
    if (current) current.abort()
    const controller = new AbortController()
    current = controller
    const url = buildUrl()

    setBusy(true)
    try {
      const response = await fetch(url, { signal: controller.signal })
      if (!response.ok) throw new Error('Live search failed')
      const html = await response.text()
      if (current !== controller) return

      const doc = new DOMParser().parseFromString(html, 'text/html')
      const fresh = doc.getElementById(results.id)
      if (!fresh) throw new Error('Live search results missing')
      results.innerHTML = fresh.innerHTML

      document.querySelectorAll('[data-live-sync]').forEach((el) => {
        if (!el.id) return
        const updated = doc.getElementById(el.id)
        if (updated) el.innerHTML = updated.innerHTML
      })

      history.replaceState(null, '', url.pathname + url.search)
      setBusy(false)
    } catch (err) {
      if (err && err.name === 'AbortError') return
      // Unsupported/failed request: let the normal form navigation handle it.
      window.location.assign(url.toString())
    }
  }

  input.addEventListener('input', () => {
    syncClear()
    clearTimeout(debounce)
    debounce = setTimeout(run, 250)
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    clearTimeout(debounce)
    run()
  })

  if (clearBtn) {
    clearBtn.addEventListener('click', (e) => {
      e.preventDefault()
      input.value = ''
      syncClear()
      clearTimeout(debounce)
      run()
      input.focus()
    })
  }

  syncClear()
}

document.querySelectorAll('form[data-live-search]').forEach(initLiveSearch)
