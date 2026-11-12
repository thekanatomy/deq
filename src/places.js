// Place search as you type, with Photon (photon.komoot.io): free, no key, built
// on OpenStreetMap and made for search-as-you-type. Results lean towards where
// you are, so "Memorial Union" finds the one in Tempe first.

export async function searchPlaces(query, near, signal) {
  const params = new URLSearchParams({ q: query, limit: '5', lang: 'en' })
  if (near) {
    params.set('lat', near.lat.toFixed(4))
    params.set('lon', near.lng.toFixed(4))
  }
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal })
  if (!response.ok) return []
  const { features = [] } = await response.json()
  const seen = new Set()
  return features
    .map(({ properties: p, geometry }) => {
      const name = p.name || [p.housenumber, p.street].filter(Boolean).join(' ')
      const area = [p.city || p.town || p.village || p.district, p.state, p.country].filter(Boolean)
      return {
        name,
        detail: area.join(', '),
        // what's saved on the card: the spot and its town, like the automatic ones
        place: [name, area[0]].filter(Boolean).filter((part, index, all) => all.indexOf(part) === index).join(', '),
        lng: geometry.coordinates[0],
        lat: geometry.coordinates[1],
      }
    })
    .filter(result => result.name && !seen.has(result.place) && seen.add(result.place))
}
