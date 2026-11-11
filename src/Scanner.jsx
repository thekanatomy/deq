import jsQR from 'jsqr'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { CloseIcon } from './icons'
import { frameToBlob, shrinkPhoto } from './photo'
import { parseScan } from './scan'

const SCAN_EVERY_MS = 140

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

export default function Scanner({ onResult, onType, onClose }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileRef = useRef(null)
  const galleryRef = useRef(null)
  const doneRef = useRef(false)
  const [status, setStatus] = useState('starting') // starting | live | unavailable
  const [found, setFound] = useState(false)

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
    const [photo, scanImage] = await Promise.all([frameToBlob(video), frameToBlob(video, 1280)])
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
    const [photo, scanImage] = await Promise.all([shrinkPhoto(file), shrinkPhoto(file, 1280)])
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

      <div className="scanner-shade" />

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

        <p className="scanner-hint">
          {status === 'unavailable'
            ? 'Live camera is off here. Tap the shutter to take a photo instead.'
            : found
              ? 'Got it'
              : 'Point at a QR, card, badge or screen, then tap'}
        </p>
      </div>

      <div className="scanner-bottom">
        <button className="scanner-text" onClick={onType}>Type It</button>
        <button className="shutter" aria-label="Take a photo" onClick={capture}>
          <span />
        </button>
        <button className="scanner-round gallery" aria-label="Choose from your photos" onClick={() => galleryRef.current.click()}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="16" rx="3.5" />
            <circle cx="9" cy="10" r="1.6" />
            <path d="m21 16-5-5-9 9" />
          </svg>
        </button>
      </div>
    </motion.div>
  )
}