// Keep modal keyboard navigation inside the visible controls, including when
// focus was moved outside by browser chrome or another transient interaction.
export function handleDialogKey(event, dialog, close, activeElement) {
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close()
    return
  }
  if (event.key !== 'Tab' || !dialog) return
  const controls = [...dialog.querySelectorAll(
    'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )].filter((element) => element.getClientRects().length > 0)
  if (!controls.length) {
    event.preventDefault()
    dialog.focus({ preventScroll: true })
    return
  }
  const first = controls[0]
  const last = controls.at(-1)
  const outside = !dialog.contains(activeElement)
  if (event.shiftKey && (activeElement === first || outside)) {
    event.preventDefault()
    last.focus({ preventScroll: true })
  } else if (!event.shiftKey && (activeElement === last || outside)) {
    event.preventDefault()
    first.focus({ preventScroll: true })
  }
}
