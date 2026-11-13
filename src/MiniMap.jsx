import 'maplibre-gl/dist/maplibre-gl.css'
import maplibregl from 'maplibre-gl'
import { useEffect, useRef } from 'react'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'

// A small, still map of where you met: no dragging, no zooming. Tapping it opens the big map.
export default function MiniMap({ lat, lng, colour = '#ff8a00' }) {
  const box = useRef(null)
  useEffect(() => {
    const probe = document.createElement('canvas')
    if (!probe.getContext('webgl2') && !probe.getContext('webgl')) return undefined
    const map = new maplibregl.Map({
      container: box.current,
      style: STYLE,
      center: [lng, lat],
      zoom: 14.5,
      interactive: false,
      attributionControl: false,
    })
    const pin = document.createElement('span')
    pin.className = 'mini-map-pin'
    pin.style.background = colour
    new maplibregl.Marker({ element: pin }).setLngLat([lng, lat]).addTo(map)
    return () => map.remove()
  }, [lat, lng, colour])
  return <div ref={box} className="mini-map-canvas" aria-hidden="true" />
}
