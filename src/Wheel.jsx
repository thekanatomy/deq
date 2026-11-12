import { useEffect, useLayoutEffect, useRef } from 'react'

// iOS-style picker wheel, like Clock's timer: rows roll on a drum, the middle
// one sits in a soft band, the rest tilt away and fade. Snaps row by row, with
// a tiny tick on Android as each number passes.
const ROW = 40

export function WheelColumn({ items, index, onChange, label, align = 'center' }) {
  const box = useRef(null)
  const settle = useRef(null)
  const shown = useRef(index)
  const frame = useRef(0)

  // tilt each row by its distance from the middle, like a drum
  function paint() {
    const el = box.current
    if (!el) return
    const middle = el.scrollTop / ROW
    for (const [row, child] of [...el.children].entries()) {
      const distance = row - middle
      // squash rows vertically as they roll away (a drum seen from the front);
      // only up-down changes, so nothing ever drifts sideways
      const angle = Math.min(80, Math.abs(distance) * 22) * (Math.PI / 180)
      child.style.transform = `scaleY(${Math.max(0.35, Math.cos(angle)).toFixed(3)})`
      child.style.opacity = String(Math.max(0.15, 1 - Math.abs(distance) * 0.3))
    }
    const nearest = Math.round(middle)
    if (nearest !== shown.current) {
      shown.current = nearest
      navigator.vibrate?.(4)
    }
  }

  useLayoutEffect(() => {
    // jump to the chosen row when it changes from outside (or the list shrinks)
    const el = box.current
    if (Math.round(el.scrollTop / ROW) !== index) el.scrollTop = index * ROW
    shown.current = index
    paint()
  }, [index, items.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(frame.current), [])

  function onScroll() {
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(paint)
    clearTimeout(settle.current)
    settle.current = setTimeout(() => {
      const row = Math.max(0, Math.min(items.length - 1, Math.round(box.current.scrollTop / ROW)))
      if (row !== index) onChange(row)
    }, 90)
  }

  return (
    <div
      ref={box}
      className={`wheel-column ${align}`}
      role="listbox"
      aria-label={label}
      aria-activedescendant={`${label}-${index}`}
      tabIndex={0}
      onScroll={onScroll}
      onKeyDown={event => {
        if (event.key === 'ArrowDown') onChange(Math.min(items.length - 1, index + 1))
        if (event.key === 'ArrowUp') onChange(Math.max(0, index - 1))
      }}
    >
      {items.map((item, row) => (
        <div
          key={item}
          id={`${label}-${row}`}
          role="option"
          aria-selected={row === index}
          className="wheel-row"
          onClick={() => box.current.scrollTo({ top: row * ROW, behavior: 'smooth' })}
        >
          {item}
        </div>
      ))}
    </div>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

// Month · day · year, three wheels side by side, like iOS's date picker.
export default function DateWheel({ value, years, onChange }) {
  const year = value.getFullYear()
  const month = value.getMonth()
  const days = new Date(year, month + 1, 0).getDate()
  const day = Math.min(value.getDate(), days)

  function set(nextYear, nextMonth, nextDay) {
    const last = new Date(nextYear, nextMonth + 1, 0).getDate()
    onChange(new Date(nextYear, nextMonth, Math.min(nextDay, last)))
  }

  return (
    <div className="wheel">
      <span className="wheel-band" aria-hidden="true" />
      <WheelColumn label="Month" align="start" items={MONTHS} index={month} onChange={next => set(year, next, day)} />
      <WheelColumn
        label="Day"
        items={Array.from({ length: days }, (_, i) => String(i + 1))}
        index={day - 1}
        onChange={next => set(year, month, next + 1)}
      />
      <WheelColumn
        label="Year"
        align="end"
        items={years.map(String)}
        index={Math.max(0, years.indexOf(year))}
        onChange={next => set(years[next], month, day)}
      />
    </div>
  )
}
