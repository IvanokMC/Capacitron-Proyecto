// CAP-105 · Componente de mapa para mostrar y elegir la ubicación (HU-19, CA-01 a CA-04). Rol: Frontend (José).
// Teoría: refactorizar con pruebas (diap. 140), Adapter y DIP (diap. 126–132 y 92–106): las pantallas usan
// MapaEvento y solo MapaLeaflet conoce Leaflet. Leaflet necesita un navegador; aquí se reemplaza el adaptador
// y el mapa real se revisa en las capturas.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { buscarDirecciones, CENTRO_INICIAL, enlaceComoLlegar, puntoDe, redondear } from '../src/lib/mapa'
import { faltantesParaPublicar } from '../src/lib/validacionEvento'
import { MapaEvento } from '../src/components/MapaEvento'
import { BloqueUbicacion } from '../src/components/UbicacionEvento'
import { nuevaBd } from './bd'

vi.mock('../src/components/MapaLeaflet', () => ({ default: () => null }))

const PUNTO = { lat: -13.5208, lng: -71.9584 }

describe('CAP-105 punto del evento y «Cómo llegar» (CA-02 y CA-03)', () => {
  it('lee el punto que devuelve la API; sin coordenadas no hay punto', () => {
    expect(puntoDe({ latitud: -13.5208, longitud: -71.9584 })).toEqual(PUNTO)
    expect(puntoDe({ latitud: null, longitud: null })).toBeNull()
    expect(puntoDe({})).toBeNull()
  })

  it('redondea a 6 decimales, como guarda la base de datos', () => {
    expect(redondear({ lat: -13.520812345, lng: -71.9584499 })).toEqual({ lat: -13.520812, lng: -71.95845 })
  })

  it('«Cómo llegar» abre las indicaciones de Google Maps hacia el punto', () => {
    expect(enlaceComoLlegar(PUNTO)).toBe('https://www.google.com/maps/dir/?api=1&destination=-13.5208,-71.9584')
  })

  it('el centro inicial del formulario es el Cusco', () => {
    expect(CENTRO_INICIAL.lat).toBeCloseTo(-13.52, 1)
    expect(CENTRO_INICIAL.lng).toBeCloseTo(-71.98, 1)
  })

  it('con el punto de la API, la página muestra el bloque con el mapa y el botón', async () => {
    const bd = await nuevaBd()
    const { token } = await bd.organizador('org@test.pe')
    const e = await bd.evento(token, { lugar: 'Auditorio de Ingeniería', ...{ latitud: PUNTO.lat, longitud: PUNTO.lng } })
    const d = await bd.rpc<any>('detalle_evento', { id: e.id })
    const p = puntoDe(d)!
    const html = renderToStaticMarkup(h(BloqueUbicacion, {
      modalidad: d.modalidad, lugar: d.lugar, inicio: d.fecha_inicio,
      mapa: h(MapaEvento, { punto: p, etiqueta: 'Mapa' }), enlaceIndicaciones: enlaceComoLlegar(p),
    }))
    expect(html).toContain('Auditorio de Ingeniería')
    expect(html).toContain('href="https://www.google.com/maps/dir/?api=1&amp;destination=-13.5208,-71.9584"')
  })
})

describe('CAP-105 búsqueda de direcciones (CA-01)', () => {
  const respuesta = [
    { place_id: 1, name: 'Universidad Nacional de San Antonio Abad del Cusco', display_name: 'Universidad Nacional de San Antonio Abad del Cusco, 733, Avenida de la Cultura, Wanchaq, Cusco, Perú', lat: '-13.52081234', lon: '-71.95844' },
  ]

  it('pide a Nominatim en español, solo en Perú y con el texto codificado', async () => {
    let pedida = ''
    const falso = async (url: string) => { pedida = url; return { ok: true, json: async () => respuesta } }
    const r = await buscarDirecciones('UNSAAC Perayoc', falso)
    expect(pedida).toContain('https://nominatim.openstreetmap.org/search?')
    expect(pedida).toContain('countrycodes=pe')
    expect(pedida).toContain('accept-language=es')
    expect(pedida).toContain('q=UNSAAC%20Perayoc')
    expect(r).toEqual([{
      id: '1', nombre: 'Universidad Nacional de San Antonio Abad del Cusco',
      detalle: 'Avenida de la Cultura, Wanchaq, Cusco', punto: { lat: -13.520812, lng: -71.95844 },
    }])
  })

  it('con menos de 3 letras no busca', async () => {
    let llamadas = 0
    const falso = async () => { llamadas++; return { ok: true, json: async () => [] } }
    expect(await buscarDirecciones('Au', falso)).toEqual([])
    expect(llamadas).toBe(0)
  })

  it('si el servicio falla, lo dice', async () => {
    await expect(buscarDirecciones('Auditorio', async () => ({ ok: false, json: async () => [] }))).rejects.toThrow('No se pudo buscar la dirección.')
  })
})

describe('CAP-105 regla de publicación en el formulario (CA-01 y CA-04)', () => {
  const lleno = { modalidad: 'presencial', tipo: 'taller', lugar: 'Aula 1', organizador_nombre: 'EPIIS', contacto: 'a@b.pe' }

  it('sin punto en un evento presencial o mixto falta «ubicacion»; en uno virtual, no', () => {
    expect(faltantesParaPublicar({ ...lleno, tienePunto: false })).toHaveProperty('ubicacion')
    expect(faltantesParaPublicar({ ...lleno, modalidad: 'mixta', tienePunto: false })).toHaveProperty('ubicacion')
    expect(faltantesParaPublicar({ ...lleno, modalidad: 'virtual', lugar: '', tienePunto: false })).toEqual({})
    expect(faltantesParaPublicar({ ...lleno, tienePunto: true })).toEqual({})
  })

  it('el formulario marca los mismos campos, en el mismo orden, que la API (CAP-104)', async () => {
    const bd = await nuevaBd()
    const { token } = await bd.organizador('org@test.pe')
    const borrador = await bd.evento(token, { tipo: null, latitud: null, longitud: null }, 'guardar')
    const err = await bd.rpc('publicar_evento', { token, id: borrador.id }).catch((x) => x)
    const pantalla = faltantesParaPublicar({ ...lleno, tipo: '', tienePunto: false })
    expect(Object.keys(pantalla)).toEqual(err.detalle.campos)
  })
})

describe('CAP-105 el proveedor queda detrás del componente propio (Adapter y DIP)', () => {
  const archivos = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? archivos(p) : /\.tsx?$/.test(f) ? [p] : []
  })

  it('solo MapaLeaflet.tsx importa Leaflet', () => {
    const conLeaflet = archivos(new URL('../src', import.meta.url).pathname.replace(/^\/(\w:)/, '$1'))
      .filter((p) => /from 'leaflet'|import 'leaflet/.test(readFileSync(p, 'utf8')))
      .map((p) => p.split(/[\\/]/).pop())
    expect(conLeaflet).toEqual(['MapaLeaflet.tsx'])
  })

  it('la página del evento y el formulario usan MapaEvento con el diseño de CAP-103', () => {
    const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8')
    const detalle = leer('../src/pages/EventoDetalle.tsx')
    const editor = leer('../src/pages/organizador/EditorEvento.tsx')
    expect(detalle).toContain('<BloqueUbicacion')
    expect(detalle).toContain('<MapaEvento punto={puntoDe(e)}')
    expect(editor).toContain('<SelectorUbicacion')
    expect(editor).toMatch(/<MapaEvento punto=\{punto\}[\s\S]*onElegir=/)
    expect(editor).toContain("latitud: f.modalidad === 'virtual' ? null : punto?.lat ?? null")
  })

  it('MapaEvento carga Leaflet aparte (lazy) y mientras tanto dice «Cargando mapa…»', () => {
    // El render depende de si el módulo ya cargó en otra prueba; por eso se revisa la fuente.
    const fuente = readFileSync(new URL('../src/components/MapaEvento.tsx', import.meta.url), 'utf8')
    expect(fuente).toContain("lazy(() => import('./MapaLeaflet'))")
    expect(fuente).toMatch(/<Suspense fallback=\{[^}]*Cargando mapa…/)
  })
})
