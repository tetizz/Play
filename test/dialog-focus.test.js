import assert from 'node:assert/strict'
import { test } from 'node:test'
import { handleDialogKey } from '../src/lib/dialogFocus.js'

function fixture() {
  let focused = null
  const control = (name, visible = true) => ({
    name,
    getClientRects: () => visible ? [{}] : [],
    focus: () => { focused = name },
  })
  const close = control('close'), text = control('text'), copy = control('copy')
  const hidden = control('hidden', false)
  const dialog = {
    querySelectorAll: () => [close, text, copy, hidden],
    contains: (node) => [close, text, copy, hidden].includes(node),
    focus: () => { focused = 'dialog' },
  }
  const key = (value, shiftKey = false) => ({
    key: value, shiftKey, prevented: false, stopped: false,
    preventDefault() { this.prevented = true },
    stopPropagation() { this.stopped = true },
  })
  return { close, text, copy, dialog, key, focused: () => focused }
}

test('Tab from the final visible copy control wraps to close rather than escaping the modal', () => {
  const f = fixture(), event = f.key('Tab')
  handleDialogKey(event, f.dialog, () => {}, f.copy)
  assert.equal(event.prevented, true)
  assert.equal(f.focused(), 'close')
})

test('reverse Tab and an outside focus target remain inside visible modal controls', () => {
  const f = fixture()
  handleDialogKey(f.key('Tab', true), f.dialog, () => {}, f.close)
  assert.equal(f.focused(), 'copy')
  handleDialogKey(f.key('Tab'), f.dialog, () => {}, {})
  assert.equal(f.focused(), 'close')
})

test('Escape closes once and suppresses underlying page keyboard handlers', () => {
  const f = fixture(), event = f.key('Escape')
  let closes = 0
  handleDialogKey(event, f.dialog, () => { closes++ }, f.text)
  assert.equal(closes, 1)
  assert.equal(event.prevented, true)
  assert.equal(event.stopped, true)
})

test('ordinary input preserves native text behavior and empty dialogs retain focus', () => {
  const f = fixture(), letter = f.key('a')
  handleDialogKey(letter, f.dialog, () => {}, f.text)
  assert.equal(letter.prevented, false)
  const tab = f.key('Tab')
  f.dialog.querySelectorAll = () => []
  handleDialogKey(tab, f.dialog, () => {}, {})
  assert.equal(tab.prevented, true)
  assert.equal(f.focused(), 'dialog')
})
