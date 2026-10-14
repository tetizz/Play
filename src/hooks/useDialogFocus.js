import { useEffect, useRef } from 'react'
import { handleDialogKey } from '../lib/dialogFocus'

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
    const onKeyDown = (event) => handleDialogKey(
      event, dialogRef.current, () => closeRef.current?.(), document.activeElement,
    )
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

function focusableElements(container) {
  if (!container) return []
  return [...container.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => !element.hasAttribute('hidden'))
}
