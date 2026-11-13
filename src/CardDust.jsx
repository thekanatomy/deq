import { useEffect, useRef } from 'react'

// Apple Wallet's "Adding Card": before the card exists it's a field of tiny glittering
// dots in its shape, which twinkle and then dissolve as the real card fades in under them.
// One canvas, drawn for about two seconds, then it stops.
const SPACING = 4.5 // css px between dots
const TINTS = ['255,255,255', '214,226,255', '230,214,255', '255,240,214']

// slow at both ends, so nothing starts or stops abruptly
const ease = x => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2)

export default function CardDust({ appearAt = 0, appearFor = 400, dissolveAt = 500, dissolveFor = 700 }) {
  const ref = useRef(null)
  useEffect(() => {
    const canvas = ref.current
    const { width, height } = canvas.getBoundingClientRect()
    if (!width || !height) return undefined
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    const context = canvas.getContext('2d')
    context.scale(ratio, ratio)

    const radius = width * 0.085 // the card's corner
    const inside = (x, y) => {
      const cx = Math.min(Math.max(x, radius), width - radius)
      const cy = Math.min(Math.max(y, radius), height - radius)
      return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius
    }
    const dots = []
    for (let y = SPACING / 2; y < height; y += SPACING) {
      for (let x = SPACING / 2; x < width; x += SPACING) {
        const jx = x + (Math.random() - 0.5) * SPACING * 0.8
        const jy = y + (Math.random() - 0.5) * SPACING * 0.8
        if (!inside(jx, jy)) continue
        dots.push({
          x: jx,
          y: jy,
          size: 0.5 + Math.random() * 0.9,
          tint: TINTS[(Math.random() * TINTS.length) | 0],
          phase: Math.random() * Math.PI * 2,
          speed: 6 + Math.random() * 8,
          base: 0.25 + Math.random() * 0.55,
          // dissolves sweep from the top-left, each dot a little on its own
          leave: dissolveAt + ((jx / width) * 0.45 + (jy / height) * 0.35 + Math.random() * 0.2) * dissolveFor,
        })
      }
    }

    const start = performance.now()
    let frame
    const draw = now => {
      const t = now - start
      context.clearRect(0, 0, width, height)
      const shown = ease((t - appearAt) / appearFor)
      let alive = false
      for (const dot of dots) {
        const gone = ease((t - dot.leave) / 420)
        if (gone >= 1) continue
        alive = true
        const twinkle = 0.55 + 0.45 * Math.sin(dot.phase + (t / 1000) * dot.speed)
        const alpha = dot.base * twinkle * shown * (1 - gone)
        if (alpha < 0.02) continue
        context.fillStyle = `rgba(${dot.tint},${alpha})`
        context.fillRect(dot.x, dot.y - gone * 3, dot.size, dot.size)
      }
      if (alive || t < dissolveAt) frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [appearAt, appearFor, dissolveAt, dissolveFor])

  return <canvas ref={ref} className="card-dust" aria-hidden="true" />
}
