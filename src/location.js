// Where you are right now, as a place name people recognise ("Memorial Union, Tempe").
// The phone gives coordinates; OpenStreetMap's free lookup turns them into a name.
// Only the coordinates are sent, once per new person, and only after the phone asks you.

function position() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no location on this device'))
    navigator.geolocation.getCurrentPosition(
      result => resolve(result.coords),
      reject,
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    )
  })
}

function nameFrom(result) {
  const address = result.address ?? {}
  const spot =
    result.name ||
    address.amenity ||
    address.building ||
    address.university ||
    address.college ||
    address.shop ||
    address.leisure ||
    address.tourism ||
    address.road
  const area = address.city || address.town || address.village || address.suburb
  return [spot, area].filter(Boolean).filter((part, i, all) => all.indexOf(part) === i).join(', ')
}

export async function detectPlace() {
  const { latitude, longitude } = await position()
  const url =
    'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1' +
    `&lat=${latitude.toFixed(5)}&lon=${longitude.toFixed(5)}`
  const response = await fetch(url, { headers: { 'Accept-Language': navigator.language || 'en' } })
  if (!response.ok) throw new Error('place lookup failed')
  const place = nameFrom(await response.json())
  return { place, lat: latitude, lng: longitude }
}