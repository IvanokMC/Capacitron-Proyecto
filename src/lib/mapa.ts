// CAP-105 · Lógica del mapa del evento (HU-19, CA-01 a CA-03). Rol: Frontend (José).
//
// SRP (diap. 39–49): aquí van el enlace de Google Maps, la lectura del punto y la búsqueda de direcciones.
// El dibujo del mapa está en components/MapaLeaflet.tsx y el diseño en components/UbicacionEvento.tsx (CAP-103).
// DIP (diap. 92–106): la búsqueda recibe `fetch` por parámetro; las pruebas le pasan uno falso y, si se cambia
// de proveedor (por ejemplo, a Google), solo cambia esta función.
import { useEffect, useState } from 'react'
import type { Punto, Sugerencia } from '../components/UbicacionEvento'

/** Plaza de Armas del Cusco: centro inicial cuando el evento todavía no tiene punto. */
export const CENTRO_INICIAL: Punto = { lat: -13.5167, lng: -71.9787 }

/** El punto de un evento, o null si no tiene (virtual o publicado antes de la HU-19). */
export function puntoDe(e: { latitud?: number | null; longitud?: number | null }): Punto | null {
  return e.latitud == null || e.longitud == null ? null : { lat: Number(e.latitud), lng: Number(e.longitud) }
}

/** 6 decimales, como guarda la base de datos (CAP-104). */
export function redondear(p: Punto): Punto {
  const r = (n: number) => Math.round(n * 1e6) / 1e6
  return { lat: r(p.lat), lng: r(p.lng) }
}

/** CA-03: indicaciones en Google Maps hacia el punto (abre la app en el celular si está instalada). */
export function enlaceComoLlegar(p: Punto): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}`
}

export interface ResultadoBusqueda extends Sugerencia { punto: Punto }

type Buscador = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; json(): Promise<unknown> }>

/**
 * Busca direcciones en Perú con Nominatim (OpenStreetMap), sin clave. Se piden pocas (5) y en español.
 * El texto que se envía es la dirección pública del evento, no datos de la persona.
 */
export async function buscarDirecciones(texto: string, buscador: Buscador = fetch, signal?: AbortSignal): Promise<ResultadoBusqueda[]> {
  const q = texto.trim()
  if (q.length < 3) return []
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=pe&accept-language=es&q=${encodeURIComponent(q)}`
  const r = await buscador(url, { signal, headers: { Accept: 'application/json' } })
  if (!r.ok) throw new Error('No se pudo buscar la dirección.')
  const datos = (await r.json()) as { place_id: number; name?: string; display_name: string; lat: string; lon: string }[]
  return datos.map((d) => {
    // El nombre del lugar («Universidad Nacional…») y debajo la dirección corta (calle, barrio, ciudad).
    const partes = d.display_name.split(',').map((x) => x.trim())
    const nombre = d.name?.trim() || partes[0]
    const resto = partes[0] === nombre ? partes.slice(1) : partes
    return {
      id: String(d.place_id),
      nombre,
      detalle: resto.filter((x) => !/^\d+$/.test(x)).slice(0, 3).join(', ') || undefined,
      punto: redondear({ lat: Number(d.lat), lng: Number(d.lon) }),
    }
  })
}

/**
 * Sugerencias mientras se escribe el lugar. Espera 600 ms a que la persona termine (y respeta el límite de
 * Nominatim de una consulta por segundo); `texto = null` apaga la búsqueda (por ejemplo, al cargar un evento).
 */
export function useBusquedaDirecciones(texto: string | null, buscador?: Buscador) {
  const [estado, setEstado] = useState<{ resultados: ResultadoBusqueda[]; buscando: boolean; sinResultados: boolean }>(
    { resultados: [], buscando: false, sinResultados: false })
  useEffect(() => {
    if (texto === null || texto.trim().length < 3) {
      setEstado({ resultados: [], buscando: false, sinResultados: false })
      return
    }
    const control = new AbortController()
    const id = window.setTimeout(() => {
      setEstado((e) => ({ ...e, buscando: true, sinResultados: false }))
      buscarDirecciones(texto, buscador, control.signal)
        .then((resultados) => setEstado({ resultados, buscando: false, sinResultados: resultados.length === 0 }))
        .catch(() => { if (!control.signal.aborted) setEstado({ resultados: [], buscando: false, sinResultados: true }) })
    }, 600)
    return () => { window.clearTimeout(id); control.abort() }
  }, [texto, buscador])
  return estado
}
