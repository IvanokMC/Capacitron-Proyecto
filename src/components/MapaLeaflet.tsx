// CAP-105 · Adaptador de Leaflet con OpenStreetMap (HU-19). Rol: Frontend (José).
//
// Adapter (diap. 126–132): es el ÚNICO archivo que importa Leaflet. Traduce la interfaz propia del proyecto
// (`PropsMapa`: un punto y, si se puede elegir, `onElegir`) a la de Leaflet. Las pantallas usan MapaEvento y
// no saben qué librería hay detrás; cambiar a Google Maps sería escribir otro adaptador con las mismas props.
// Se carga aparte (React.lazy en MapaEvento) para que Leaflet no pese en las páginas que no tienen mapa.
import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { PropsMapa } from './MapaEvento'
import { CENTRO_INICIAL, redondear } from '../lib/mapa'

// Marcador propio (SVG en línea, color grana del sistema): el ícono por defecto de Leaflet depende de imágenes
// que el empaquetador no encuentra.
const ICONO = L.divIcon({
  className: '',
  iconSize: [36, 36],
  iconAnchor: [18, 34],
  html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="36" height="36" aria-hidden="true">'
    + '<path fill="#9d1748" stroke="#fff" stroke-width="10" d="M128 16a88 88 0 0 0-88 88c0 75.3 80 132.2 83.4 134.6a8 8 0 0 0 9.2 0C136 236.2 216 179.3 216 104a88 88 0 0 0-88-88Z"/>'
    + '<circle cx="128" cy="104" r="30" fill="#fff"/></svg>',
})

export default function MapaLeaflet({ punto, onElegir, etiqueta }: PropsMapa) {
  const contenedor = useRef<HTMLDivElement>(null)
  const mapa = useRef<L.Map | null>(null)
  const marcador = useRef<L.Marker | null>(null)
  const elegir = useRef(onElegir)
  elegir.current = onElegir

  // Se crea una sola vez. En modo «mostrar» no captura la rueda del ratón, para no secuestrar el desplazamiento.
  useEffect(() => {
    if (!contenedor.current) return
    const m = L.map(contenedor.current, { scrollWheelZoom: !!onElegir, attributionControl: true })
      .setView(punto ?? CENTRO_INICIAL, punto ? 17 : 14)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m)
    m.on('click', (ev: L.LeafletMouseEvent) => elegir.current?.(redondear({ lat: ev.latlng.lat, lng: ev.latlng.lng })))
    mapa.current = m
    return () => { m.remove(); mapa.current = null; marcador.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // El marcador sigue al punto: aparece, se mueve o se quita.
  useEffect(() => {
    const m = mapa.current
    if (!m) return
    if (!punto) {
      marcador.current?.remove()
      marcador.current = null
      return
    }
    if (marcador.current) {
      // Mover un punto que ya estaba: el mapa solo se desplaza si el punto quedó fuera de la vista.
      marcador.current.setLatLng(punto)
      if (!m.getBounds().pad(-0.2).contains(punto)) m.panTo(punto)
    } else {
      // Primer punto (elegido en la búsqueda o tocado): se centra y se acerca para ver la calle.
      marcador.current = L.marker(punto, { icon: ICONO, keyboard: false, title: etiqueta }).addTo(m)
      m.setView(punto, Math.max(m.getZoom(), 17))
    }
  }, [punto?.lat, punto?.lng, etiqueta]) // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={contenedor} className="absolute inset-0 z-0" role="region" aria-label={etiqueta} />
}
