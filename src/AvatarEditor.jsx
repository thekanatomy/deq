import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { db } from './db'
import { CloseIcon } from './icons'

const SIZE = 512 // saved photos are square, 512px: plenty for every place deq shows them
const EASE = [0.32, 0.72, 0, 1]

// Their photo, like Contacts on iPhone. With a photo: see it big, Edit in the corner.
// Without one: straight to "Take Photo / Choose from Photos". Any new or existing photo
// can be moved and scaled inside a circle before it's saved (Family and Contacts on Mobbin).
export default function AvatarEditor({ person, onClose }) {
  const [mode, setMode] = useState(person.photo ? 'view' : 'menu') // view | menu | crop
  const [source, setSource] = useState(null) // the image being cropped
  const camera = useRef(null)
  const library = useRef(null)
  const photoUrl = useBlobUrl(person.photo)

  function picked(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setSource(file)
    setMode('crop')
  }

  async function save(blob) {
    await db.cards.update(person.id, { photo: blob })
    onClose()
  }

  async function remove() {
    await db.cards.update(person.id, { photo: null })
    onClose()
  }

  const first = person.name.split(' ')[0]
  return createPortal(
    <motion.div
      className="photo-layer"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      transition={{ duration: 0.25 }}
      onClick={event => event.stopPropagation()}
    >
      {/* capture opens the back camera straight away; the other one opens Photos */}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={picked} />
      <input ref={library} type="file" accept="image/*" hidden onChange={picked} />

      {mode === 'crop' && source ? (
        <Cropper file={source} onCancel={() => (person.photo ? setMode('view') : onClose())} onDone={save} />
      ) : (
        <>
          {person.photo ? (
            <div className="photo-view">
              <div className="photo-bar">
                <button className="photo-edit" onClick={() => setMode('menu')}>
                  Edit
                </button>
                <button className="photo-close" aria-label="Close" onClick={onClose}>
                  <CloseIcon size={20} />
                </button>
              </div>
              <motion.img
                className="photo-big"
                src={photoUrl}
                alt={person.name}
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
              />
              <p className="photo-name">{person.name}</p>
            </div>
          ) : (
            <div className="photo-view empty" onClick={onClose} />
          )}

          <AnimatePresence>
            {mode === 'menu' && (
              <motion.div
                className="zoom-chooser-scrim photo-sheet"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => (person.photo ? setMode('view') : onClose())}
              >
                <motion.div
                  className="zoom-chooser"
                  role="dialog"
                  aria-label={`Photo of ${first}`}
                  initial={{ y: 40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: 40, opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
                  onClick={event => event.stopPropagation()}
                >
                  <p className="zoom-chooser-title">{person.photo ? `${first}’s photo` : `Add a photo of ${first}`}</p>
                  <button onClick={() => camera.current.click()}>Take Photo</button>
                  <button onClick={() => library.current.click()}>Choose from Photos</button>
                  {person.photo && (
                    <button
                      onClick={() => {
                        setSource(person.photo)
                        setMode('crop')
                      }}
                    >
                      Move and Scale
                    </button>
                  )}
                  {person.photo && (
                    <button className="destructive" onClick={remove}>
                      Remove Photo
                    </button>
                  )}
                  <button className="cancel" onClick={() => (person.photo ? setMode('view') : onClose())}>
                    Cancel
                  </button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>,
    document.body,
  )
}

// Move and Scale: drag to move, pinch (or scroll) to zoom; the circle is what gets saved.
function Cropper({ file, onCancel, onDone }) {
  const url = useBlobUrl(file)
  const [image, setImage] = useState(null) // { el, w, h }
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const pointers = useRef(new Map())
  const pinch = useRef(null)
  const view = Math.min(window.innerWidth - 32, 360)

  useEffect(() => {
    if (!url) return
    const el = new Image()
    el.onload = () => setImage({ el, w: el.naturalWidth, h: el.naturalHeight })
    el.src = url
  }, [url])

  const base = image ? view / Math.min(image.w, image.h) : 1
  const scale = base * zoom

  // keep the photo covering the whole circle
  function clamp(next, z = zoom) {
    if (!image) return next
    const s = base * z
    const maxX = Math.max(0, (image.w * s - view) / 2)
    const maxY = Math.max(0, (image.h * s - view) / 2)
    return { x: Math.min(maxX, Math.max(-maxX, next.x)), y: Math.min(maxY, Math.max(-maxY, next.y)) }
  }

  function onPointerDown(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom }
    }
  }
  function onPointerMove(event) {
    const last = pointers.current.get(event.pointerId)
    if (!last) return
    const now = { x: event.clientX, y: event.clientY }
    pointers.current.set(event.pointerId, now)
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()]
      const next = Math.min(4, Math.max(1, (pinch.current.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.current.distance))
      setZoom(next)
      setOffset(current => clamp(current, next))
    } else if (pointers.current.size === 1) {
      setOffset(current => clamp({ x: current.x + now.x - last.x, y: current.y + now.y - last.y }))
    }
  }
  function onPointerUp(event) {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size < 2) pinch.current = null
  }
  function onWheel(event) {
    const next = Math.min(4, Math.max(1, zoom * (event.deltaY < 0 ? 1.08 : 1 / 1.08)))
    setZoom(next)
    setOffset(current => clamp(current, next))
  }

  function choose() {
    if (!image) return
    const side = view / scale
    const sx = (image.w * scale) / 2 - view / 2 - offset.x
    const sy = (image.h * scale) / 2 - view / 2 - offset.y
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE
    canvas.getContext('2d').drawImage(image.el, sx / scale, sy / scale, side, side, 0, 0, SIZE, SIZE)
    canvas.toBlob(blob => blob && onDone(blob), 'image/jpeg', 0.86)
  }

  return (
    <motion.div className="cropper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25, ease: EASE }}>
      <p className="cropper-title">Move and Scale</p>
      <div
        className="cropper-stage"
        style={{ width: view, height: view }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      >
        {image && (
          <img
            src={url}
            alt=""
            draggable={false}
            style={{
              width: image.w * scale,
              height: image.h * scale,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          />
        )}
        <span className="cropper-ring" aria-hidden="true" />
      </div>
      <div className="cropper-bar">
        <button onClick={onCancel}>Cancel</button>
        <button className="strong" onClick={choose} disabled={!image}>
          Choose
        </button>
      </div>
    </motion.div>
  )
}

// a URL an <img> can show for a stored photo, made and freed with the component
function useBlobUrl(blob) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    if (!blob) return setUrl(null)
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}
