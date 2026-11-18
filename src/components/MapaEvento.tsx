// CAP-105 · Componente propio de mapa (HU-19). Rol: Frontend (José).
//
// DIP (diap. 92–106): las pantallas dependen de esta interfaz (`PropsMapa`), no de Leaflet. Dos modos:
// · mostrar un punto: sin `onElegir` (página del evento, CA-02);
// · elegir un punto: con `onElegir`, que recibe el punto tocado (formulario del evento, CA-01).
// Leaflet se carga aparte (lazy): las páginas sin mapa no lo descargan.
import { lazy, Suspense } from 'react'
import type { Punto } from './UbicacionEvento'

export interface PropsMapa {
  punto: Punto | null
  /** Si está, el mapa sirve para elegir: cada toque avisa el punto. */
  onElegir?: (p: Punto) => void
  /** Texto para lectores de pantalla, por ejemplo «Mapa con la ubicación de …». */
  etiqueta: string
}

const MapaLeaflet = lazy(() => import('./MapaLeaflet'))

export function MapaEvento(props: PropsMapa) {
  return (
    <Suspense fallback={<div className="absolute inset-0 grid place-items-center text-[13px] text-tinta-3">Cargando mapa…</div>}>
      <MapaLeaflet {...props} />
    </Suspense>
  )
}
