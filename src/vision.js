// Sends a photo to Deq's server, which reads it with AI and sends back
// whatever details it can see: name, role, company, email, LinkedIn…
// Resolves to {} when the photo can't be read, so adding someone never gets stuck.

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function readPhoto(blob, { signal } = {}) {
  if (!blob) return {}
  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: await toBase64(blob), mimeType: blob.type || 'image/jpeg' }),
      signal,
    })
    if (!response.ok) return {}
    return await response.json()
  } catch {
    return {}
  }
}