/**
 * Small behaviors for the server-rendered pages:
 *  - modals open via [data-open-modal="#id"], close via [data-close-modal]
 *    (backdrop and X button) or Escape
 *  - [data-toast] banners dismiss themselves
 * No frameworks — the server owns the state, JS only toggles visibility.
 */

function openModal(modal) {
  modal.classList.remove('hidden')
  modal.classList.add('flex')
  document.body.classList.add('overflow-hidden')
  const first = modal.querySelector('input:not([type=hidden]), select, textarea')
  if (first instanceof HTMLElement) first.focus()
}

function closeModal(modal) {
  modal.classList.add('hidden')
  modal.classList.remove('flex')
  document.body.classList.remove('overflow-hidden')
}

document.addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target : null
  if (!target) return

  const opener = target.closest('[data-open-modal]')
  if (opener) {
    const selector = opener.getAttribute('data-open-modal') || ''
    const modal = document.querySelector(selector)
    if (modal) openModal(modal)
    return
  }

  const closer = target.closest('[data-close-modal]')
  if (closer) {
    const modal = closer.closest('[data-modal]')
    if (modal) closeModal(modal)
  }
})

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return
  document.querySelectorAll('[data-modal]').forEach((modal) => {
    if (!modal.classList.contains('hidden')) closeModal(modal)
  })
})

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
