import jsQR from 'jsqr'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './icons'
import { frameToBlob, shrinkPhoto } from './photo'
import { parseScan } from './scan'

const SCAN_EVERY_MS = 140
// what the AI reads: big enough for small print, small enough to keep each scan cheap
const SCAN_SIZE = 1024

// Reads a QR code from the middle of a video frame or a still image.
function readQR(source, width, height, canvas) {
  const side = Math.min(width, height) * 0.8
  const size = Math.min(480, Math.round(side))
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(source, (width - side) / 2, (height - side) / 2, side, side, 0, 0, size, size)
  const image = context.getImageData(0, 0, size, size)
  return jsQR(image.data, size, size, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

// How much the picture moved since the last look: a tiny grey copy of the frame,
// compared pixel by pixel. A still hand barely changes it; a shaky one changes a lot.
const SHAKE_SIZE = 32
const SHAKY = 16 // average change per pixel (0-255) that blurs small print
function movement(video, canvas, previous) {
  canvas.width = SHAKE_SIZE
  canvas.height = SHAKE_SIZE
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(video, 0, 0, SHAKE_SIZE, SHAKE_SIZE)
  const { data } = context.getImageData(0, 0, SHAKE_SIZE, SHAKE_SIZE)
  const grey = new Uint8Array(SHAKE_SIZE * SHAKE_SIZE)
  for (let i = 0; i < grey.length; i++) grey[i] = (data[i * 4] + data[i * 4 + 1] * 2 + data[i * 4 + 2]) >> 2
  if (!previous) return { grey, change: 0 }
  let total = 0
  for (let i = 0; i < grey.length; i++) total += Math.abs(grey[i] - previous[i])
  return { grey, change: total / grey.length }
}

const SCANNABLE = ['LinkedIn profile', 'Business card', 'Event badge', 'QR code', 'Screenshot']

export default function Scanner({ onResult, onType, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const galleryRef = useRef(null)
  const doneRef = useRef(false)
  const [status, setStatus] = useState('starting') // starting | live | unavailable
  const [found, setFound] = useState(false)
  const [shaky, setShaky] = useState(false)
  const shakeRef = useRef({ canvas: null, previous: null, rough: 0, calm: 0 })

  function finish(result) {
    if (doneRef.current) return
    doneRef.current = true
    setFound(true)
    navigator.vibrate?.(25)
    // let the viewfinder flash before moving on
    setTimeout(() => onResult(result), 260)
  }

  useEffect(() => {
    let stream
    let timer
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) return setStatus('unavailable')
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
          audio: false,
        })
      } catch {
        return setStatus('unavailable')
      }
      if (cancelled) return stream.getTracks().forEach(track => track.stop())
      const video = videoRef.current
      video.srcObject = stream
      await video.play().catch(() => {})
      setStatus('live')

      const tick = () => {
        if (cancelled || doneRef.current) return
        if (video.readyState >= 2) {
          const text = readQR(video, video.videoWidth, video.videoHeight, canvasRef.current)
          if (text) {
            const fields = parseScan(text)
            if (Object.keys(fields).length) return finish(fields)
          }
          // "Hold still" after two shaky looks in a row, gone after three calm ones
          const shake = shakeRef.current
          shake.canvas ??= document.createElement('canvas')
          const { grey, change } = movement(video, shake.canvas, shake.previous)
          shake.previous = grey
          if (change > SHAKY) {
            shake.rough += 1
            shake.calm = 0
            if (shake.rough === 2) setShaky(true)
          } else {
            shake.calm += 1
            shake.rough = 0
            if (shake.calm === 3) setShaky(false)
          }
        }
        timer = setTimeout(tick, SCAN_EVERY_MS)
      }
      tick()
    }

    start()
    return () => {
      cancelled = true
      clearTimeout(timer)
      stream?.getTracks().forEach(track => track.stop())
    }
    // finish and onResult are stable for the life of the scanner
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Shutter: photograph whatever is in front — a card, a badge, a LinkedIn screen, the person.
  // A QR in the frame is read straight away; otherwise the AI reads the sharper copy.
  async function capture() {
    const video = videoRef.current
    if (status !== 'live' || !video.videoWidth) return fileRef.current.click()
    const text = readQR(video, video.videoWidth, video.videoHeight, canvasRef.current)
    const [photo, scanImage] = await Promise.all([frameToBlob(video), frameToBlob(video, SCAN_SIZE)])
    finish({ photo, scanImage, ...(text ? parseScan(text) : {}) })
  }

  // A picked photo (gallery) or the fallback camera app: read it the same way as the shutter.
  async function fromFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const bitmap = await createImageBitmap(file)
    const text = readQR(bitmap, bitmap.width, bitmap.height, canvasRef.current)
    bitmap.close()
    const [photo, scanImage] = await Promise.all([shrinkPhoto(file), shrinkPhoto(file, SCAN_SIZE)])
    finish({ photo, scanImage, ...(text ? parseScan(text) : {}) })
  }

  return (
    <motion.div
      className="scanner"
      initial={{ opacity: 0, scale: 1.04 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
    >
      <video ref={videoRef} className="scanner-video" playsInline muted />
      <canvas ref={canvasRef} hidden />
      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={fromFile} />
      {/* no capture attribute, so the phone offers its photo library */}
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={fromFile} />

      <div className="scanner-top">
        <button className="scanner-round" aria-label="Close scanner" onClick={onClose}>
          <CloseIcon />
        </button>
      </div>

      <div className="scanner-middle">
        <motion.div
          className={found ? 'viewfinder found' : 'viewfinder'}
          animate={{ scale: found ? 0.94 : 1 }}
          transition={{ type: 'spring', bounce: 0.3, duration: 0.35 }}
        >
          <span className="corner tl" />
          <span className="corner tr" />
          <span className="corner bl" />
          <span className="corner br" />
          {status === 'live' && !found && <span className="scan-line" />}
        </motion.div>

        {found ? (
          <p className="scanner-hint">Got it</p>
        ) : (
          <div className="scanner-guide">
            <p className="scanner-hint">
              {status === 'unavailable' ? 'Tap the shutter to take a photo' : 'Scan anything with their name on it'}
            </p>
            {/* what counts: so nobody thinks it's business cards only */}
            <ul className="scanner-kinds" aria-label="Things you can scan">
              {SCANNABLE.map(kind => (
                <li key={kind}>{kind}</li>
              ))}
            </ul>
            {shaky ? (
              <p className="scanner-steady" role="status">Hold still for a sharp scan</p>
            ) : (
              <p className="scanner-tip">Hold it steady so the words are sharp</p>
            )}
          </div>
        )}
      </div>

      {/* iOS Camera's bottom bar: photos on the left, the shutter, typing on the right */}
      <div className="scanner-bottom">
        <button className="scanner-side" aria-label="Choose from your photos" onClick={() => galleryRef.current.click()}>
          <span className="scanner-round">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="3.5" />
              <circle cx="9" cy="10" r="1.6" />
              <path d="m21 16-5-5-9 9" />
            </svg>
          </span>
          <small>Photos</small>
        </button>
        <button className="shutter" aria-label="Take a photo" onClick={capture}>
          <span />
        </button>
        <button className="scanner-side" aria-label="Type it in" onClick={onType}>
          <span className="scanner-round">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
              <path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M8 14h8" />
            </svg>
          </span>
          <small>Type</small>
        </button>
      </div>
    </motion.div>
  )
}