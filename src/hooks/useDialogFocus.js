import { useEffect, useRef } from 'react'

export function useDialogFocus(dialogRef, onClose, enabled = true) {
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!enabled) return undefined
    const restoreTarget = document.activeElement
    let focusFrame = null
    const frame = window.requestAnimationFrame(() => {
      focusFrame = window.requestAnimationFrame(() => {
        const dialog = dialogRef.current
        const initial = dialog?.querySelector('[data-dialog-initial="true"]') ||
          focusableElements(dialog)[0]
        initial?.focus({ preventScroll: true })
      })
    })
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current?.()
        return
      }
      if (event.key !== 'Tab') return
      trapTabKey(event, dialogRef.current)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      if (focusFrame !== null) window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', onKeyDown)
      if (restoreTarget instanceof HTMLElement && document.contains(restoreTarget)) {
        restoreTarget.focus({ preventScroll: true })
      }
    }
  }, [dialogRef, enabled])
}

function trapTabKey(event, dialog) {
  const focusable = focusableElements(dialog)
  if (!focusable.length) {
    event.preventDefault()
    dialog?.focus({ preventScroll: true })
    return
  }
  const first = focusable[0]
  const last = focusable.at(-1)
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function focusableElements(container) {
  if (!container) return []
  return [...container.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hasAttribute('hidden'))
}
