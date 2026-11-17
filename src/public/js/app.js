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

// Toasts fade out of the DOM after a few seconds
document.querySelectorAll('[data-toast]').forEach((toast) => {
  setTimeout(() => toast.remove(), 5000)
})
