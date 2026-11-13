import { useEffect, useRef } from 'react'
import { isIOS } from './browser'

// The phone's own Back (Android's back gesture or button, the browser's back
// arrow) closes whatever is open in deq, one layer at a time, instead of leaving
// the app. Each open layer adds a step to the browser history; Back takes it away.

const stack = [] // open layers, newest last
let skip = 0 // history steps we removed ourselves, so their popstate isn't a Back

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (skip > 0) {
      skip--
      return
    }
    stack.pop()?.close()
  })
}

// Several layers can close at once (closing a card also closes its detail view):
// gather them into one jump back, which fires a single popstate.
let owed = 0
function takeBack() {
  owed++
  if (owed > 1) return
  queueMicrotask(() => {
    const steps = owed
    owed = 0
    skip++
    history.go(-steps)
  })
}

// While `open` is true, Back calls `close`. Change `step` to give Back another
// stop inside the same layer (each question of the add flow, say).
// iPhone keeps its normal web Back: Safari's own swipe can't be matched smoothly,
// so only Android (and other browsers) get the layer-by-layer Back.
const enabled = !isIOS

export function useBack(open, close, step = 0) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    if (!enabled || !open) return undefined
    const layer = {
      backed: false,
      close() {
        layer.backed = true
        closeRef.current()
      },
    }
    stack.push(layer)
    history.pushState({ ...(history.state ?? {}), deqLayer: stack.length }, '')
    return () => {
      const index = stack.indexOf(layer)
      if (index !== -1) stack.splice(index, 1)
      // closed from inside the app: take back the history step it added
      if (!layer.backed) takeBack()
    }
  }, [open, step])
}
