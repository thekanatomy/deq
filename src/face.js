// Finds the person's face in a scan (a badge photo, a LinkedIn picture, the person
// themselves) and cuts it out as a square avatar. Runs on the phone with Google's
// MediaPipe face detector: free, private, and loaded only the first time it's needed.

const VERSION = '1.2.2' // keep in step with @mediapipe/tasks-vision in package.json
const WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`
const MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite'

let detector
function loadDetector() {
  detector ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision')
    const files = await FilesetResolver.forVisionTasks(WASM)
    return FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.5,
    })
  })().catch(error => {
    detector = undefined // try again next time
    throw error
  })
  return detector
}

// Resolves to a square JPEG of the biggest face, or null when there's no clear face.
export async function cropFace(blob, size = 512) {
  if (!blob) return null
  try {
    const [faces, bitmap] = await Promise.all([loadDetector(), createImageBitmap(blob)])
    const found = faces.detect(bitmap).detections
    const best = found
      .map(face => face.boundingBox)
      .filter(Boolean)
      .sort((a, b) => b.width * b.height - a.width * a.height)[0]
    // a face smaller than 4% of the photo's width is too blurry to be an avatar
    if (!best || best.width < bitmap.width * 0.04) return bitmap.close(), null

    // room around the face for hair and shoulders, like a profile picture
    const side = Math.min(Math.max(best.width, best.height) * 1.9, bitmap.width, bitmap.height)
    const centreX = best.originX + best.width / 2
    const centreY = best.originY + best.height * 0.45
    const left = Math.min(Math.max(centreX - side / 2, 0), bitmap.width - side)
    const top = Math.min(Math.max(centreY - side / 2, 0), bitmap.height - side)

    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = Math.min(size, Math.round(side))
    canvas.getContext('2d').drawImage(bitmap, left, top, side, side, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.86))
  } catch {
    return null // no detector (offline, old phone): the card just keeps its initials
  }
}
