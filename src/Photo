// Shrinks a camera photo to at most 512px on its longest side, so each card
// stays small in the phone's storage (a full camera photo is several MB).
export async function shrinkPhoto(file, maxSize = 512) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
}

// Grabs the current camera frame as a JPEG, shrunk the same way as uploaded photos.
export function frameToBlob(video, maxSize = 512) {
  const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(video.videoWidth * scale)
  canvas.height = Math.round(video.videoHeight * scale)
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
  return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
}