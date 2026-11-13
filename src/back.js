import { MotionGlobalConfig } from 'motion/react'
import { useEffect, useRef } from 'react'
import { isIOS, isStandalone } from './browser'

// The phone's own Back (Android's back gesture or button, the browser's back
// arrow) closes whatever is open in deq, one layer at a time, instead of leaving
// the app. Each open layer adds a step to the browser history; Back takes it away.

const stack = [] // open layers, newest last
let skip = 0 // history steps we removed ourselves, so their popstate isn't a Back

// iPhone Safari's swipe from the left edge plays its own slide, showing a picture of
// the screen underneath. deq's own closing animation on top of it looks broken, so
// after an edge swipe the layer closes instantly and Safari's slide is the only movement.
let edgeTouchAt = 0
const safariTab = isIOS && !isStandalone()

if (typeof window !== 'undefined') {
  if (safariTab) {
    window.addEventListener(
      'touchstart',
      event => {
        const x = event.touches[0]?.clientX ?? 100
        if (x < 30 || x > window.innerWidth - 30) edgeTouchAt = Date.now()
      },
      { passive: true },
    )
  }

  window.addEventListener('popstate', () => {
    if (skip > 0) {
      skip--
      return
    }
    // how many layers this history step says should be open
    const depth = history.state?.deqLayer ?? 0
    if (depth > stack.length) {
      // a forward swipe onto a layer that's already closed: step back again, quietly
      skip++
      history.go(stack.length - depth)
      return
    }
    const swiped = safariTab && Date.now() - edgeTouchAt < 2000
    if (swiped) MotionGlobalConfig.skipAnimations = true
    while (stack.length > depth) stack.pop().close()
    if (swiped) setTimeout(() => (MotionGlobalConfig.skipAnimations = false), 600)
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
export function useBack(open, close, step = 0) {
  const closeRef = useRef(close)
  useEffect(() => {
    closeRef.current = close
  })

  useEffect(() => {
    if (!open) return undefined
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
