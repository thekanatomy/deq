import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl from 'maplibre-gl'
import { useEffect, useRef, useState } from 'react'
import { meshImage } from './brands'
import { db } from './db'
import { placeOf } from './filters'

// A quiet, Apple Maps-like map: OpenFreeMap's "Positron" style. Free, no API key,
// no account. Each person is a small round pin; tap one to see who it is.
const STYLE = 'https://tiles.openfreemap.org/styles/positron'
const TEMPE = [-111.9281, 33.4242]

// Cards saved without coordinates (typed place, or location was off) get them
// from the place name once, through OpenStreetMap's free lookup, one per second
// as its rules ask. The answer is kept on the card, so it's only asked once.
const asked = new Set()
async function findCoordinates(people) {
  for (const person of people) {
    if (asked.has(person.id)) continue
    asked.add(person.id)
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(person.place)}`
      const [hit] = await (await fetch(url)).json()
      if (hit) await db.cards.update(person.id, { lat: Number(hit.lat), lng: Number(hit.lon) })
    } catch {
      // offline or no match: the card just stays off the map
    }
    await new Promise(resolve => setTimeout(resolve, 1100))
  }
}

const NEAR_METRES = 80 // close enough to be the same spot, not the building next door

function metresBetween(a, b) {
  const rad = Math.PI / 180
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad)
  const y = (b.lat - a.lat) * rad
  return Math.hypot(x, y) * 6371000
}

// Everyone met at the same place as this person: the same spot by name, or
// within about 80 metres.
export function sameSpot(person, people) {
  const here = placeOf(person)
  return people.filter(
    other =>
      other.id !== person.id &&
      ((here && placeOf(other) === here) ||
        (Number.isFinite(person.lat) && Number.isFinite(other.lat) && metresBetween(person, other) < NEAR_METRES)),
  )
}

// focusId: opened from a card's place. The map flies close to that person and
// draws threads to everyone else you met there, a small web of who was where.
export default function PeopleMap({ people, focusId, onOpenPerson }) {
  const box = useRef(null)
  const map = useRef(null)
  const pins = useRef([])
  const framed = useRef(false)
  // "Show all" lets go of the person you came from; "Back to …" returns to them
  const [showAll, setShowAll] = useState(false)
  const origin = people.find(person => person.id === focusId) ?? null
  const focus = showAll ? null : origin
  const [picked, setPicked] = useState(origin)
  const [problem, setProblem] = useState(null)
  const [ready, setReady] = useState(false)
  const placed = people.filter(person => Number.isFinite(person.lat) && Number.isFinite(person.lng))
  const unplaced = people.filter(person => person.place && !Number.isFinite(person.lat))

  useEffect(() => {
    if (unplaced.length) findCoordinates(unplaced)
  }, [unplaced.map(person => person.id).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // the map draws with WebGL; without it, say so instead of a blank box
    const probe = document.createElement('canvas')
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) {
      setProblem('This browser can’t draw maps (WebGL is off).')
      return undefined
    }
    map.current = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: TEMPE,
      zoom: 12,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.current.touchZoomRotate.disableRotation()
    map.current.on('click', () => setPicked(null))
    // a style or tile that won't load: show why, so it can be fixed
    map.current.on('error', event => setProblem(event.error?.message || 'The map couldn’t load.'))
    map.current.on('load', () => {
      setProblem(null)
      setReady(true)
    })
    return () => map.current.remove()
  }, [])

  useEffect(() => {
    if (!map.current) return
    pins.current.forEach(pin => pin.remove())
    pins.current = placed.map(person => {
      const element = document.createElement('button')
      element.className = person.id === focus?.id ? 'person-pin focus' : 'person-pin'
      element.setAttribute('aria-label', person.name)
      element.style.backgroundImage = meshImage(person.company)
      element.textContent = person.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(word => word[0].toUpperCase())
        .join('')
      element.addEventListener('click', event => {
        event.stopPropagation()
        setPicked(person)
      })
      return new maplibregl.Marker({ element }).setLngLat([person.lng, person.lat]).addTo(map.current)
    })
    const centre = focus && Number.isFinite(focus.lat) ? focus : null
    // the first framing is instant; switching between one person and everyone glides
    const move = framed.current ? { duration: 900, essential: true } : { duration: 0 }
    framed.current = true
    if (centre) {
      // a little closer than street level, so the people around them show too
      map.current.easeTo({ center: [centre.lng, centre.lat], zoom: 16.2, ...move })
    } else if (placed.length === 1) {
      map.current.easeTo({ center: [placed[0].lng, placed[0].lat], zoom: 14, ...move })
    } else if (placed.length > 1) {
      const bounds = new maplibregl.LngLatBounds()
      placed.forEach(person => bounds.extend([person.lng, person.lat]))
      map.current.fitBounds(bounds, { padding: { top: 56, left: 56, right: 56, bottom: 170 }, maxZoom: 15, ...move })
    }
  }, [placed.map(person => person.id).join(), focus?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // the threads: one soft line from the focused person to each person met there
  useEffect(() => {
    if (!ready || !map.current) return
    const from = focus && Number.isFinite(focus.lat) ? focus : null
    const others = from ? sameSpot(from, placed) : []
    const data = {
      type: 'FeatureCollection',
      features: others.map(other => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [[from.lng, from.lat], [other.lng, other.lat]] },
        properties: {},
      })),
    }
    const source = map.current.getSource('web')
    if (source) source.setData(data)
    else {
      map.current.addSource('web', { type: 'geojson', data })
      map.current.addLayer({
        id: 'web',
        type: 'line',
        source: 'web',
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#0071e3', 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [1.5, 1.5] },
      })
    }
  }, [ready, focus?.id, placed.map(person => `${person.id}:${person.lat}`).join()]) // eslint-disable-line react-hooks/exhaustive-deps

  const metHere = picked ? sameSpot(picked, people) : []

  return (
    <div className="people-map">
      <div ref={box} className="people-map-canvas" />
      {problem ? (
        <p className="map-empty">{problem}</p>
      ) : (
        placed.length === 0 && (
          <p className="map-empty">
            {unplaced.length ? 'Finding the places you’ve saved…' : 'People you add with a location show up here.'}
          </p>
        )
      )}
      {/* after "Show all": one pill at the bottom to go back to the person you came from */}
      {origin && showAll && !picked && (
        <button
          className="map-toggle"
          onClick={() => {
            setShowAll(false)
            setPicked(origin)
          }}
        >
          Back to {origin.name.split(' ')[0]}
        </button>
      )}
      {picked && (
        <div className="map-card">
          <button className="map-card-main" onClick={() => onOpenPerson(picked)}>
            <b>{picked.name}</b>
            <span>{[picked.place, picked.company].filter(Boolean).join(' · ')}</span>
          </button>
          {metHere.length > 0 && (
            <div className="map-card-web">
              <p>Also met here</p>
              <div className="map-card-people">
                {metHere.slice(0, 8).map(other => (
                  <button key={other.id} onClick={() => setPicked(other)}>
                    {other.name.split(' ')[0]}
                  </button>
                ))}
              </div>
            </div>
          )}
          {origin && !showAll && placed.length > 1 && (
            <button
              className="map-show-all"
              onClick={() => {
                setShowAll(true)
                setPicked(null)
              }}
            >
              Show everyone · {placed.length}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
