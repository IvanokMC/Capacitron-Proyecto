// CAP-106 · Pruebas de aceptación de la HU-19 «Mapa con la ubicación y la hora del evento» (CA-01 a CA-05).
// Rol: QA (Andree). Plan, matriz y hallazgos en docs/pruebas/HU-19/PLAN_DE_PRUEBAS.md.
//
// Recorren la historia: la organizadora busca la dirección (búsqueda con un servicio falso que responde como
// Nominatim), guarda el punto como lo envía el formulario, publica, y un visitante abre la página y pulsa
// «Cómo llegar». El mapa real (Leaflet) necesita un navegador: aquí se reemplaza el adaptador y el mapa
// real se prueba a mano (casos M-xx). Teoría: refactorizar con pruebas (diap. 140).
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buscarDirecciones, enlaceComoLlegar, puntoDe } from '../src/lib/mapa'
import { faltantesParaPublicar } from '../src/lib/validacionEvento'
import { BloqueUbicacion } from '../src/components/UbicacionEvento'
import { MapaEvento } from '../src/components/MapaEvento'
import { nuevaBd, type Bd } from './bd'

vi.mock('../src/components/MapaLeaflet', () => ({ default: () => null }))

const UNSAAC = { place_id: 3911790, name: 'Universidad Nacional de San Antonio Abad del Cusco',
  display_name: 'Universidad Nacional de San Antonio Abad del Cusco, 733, Avenida de la Cultura, Mariscal Gamarra, Cusco, Perú',
  lat: '-13.5217864', lon: '-71.9587621' }
const nominatimFalso = async () => ({ ok: true, json: async () => [UNSAAC] })

let bd: Bd
let token: string
beforeEach(async () => {
  bd = await nuevaBd()
  token = (await bd.organizador('carmen@unsaac.test')).token
  await bd.sql(`update capa.planes set permite_virtual = true`)
})

/** Lo que el formulario manda a guardar_evento: el punto solo si no es virtual (EditorEvento, CAP-105). */
async function guardarDesdeFormulario(extra: Record<string, unknown>, punto: { lat: number; lng: number } | null, accion = 'guardar') {
  const modalidad = (extra.modalidad as string) ?? 'presencial'
  return bd.evento(token, {
    nombre: 'Taller de Python', lugar: modalidad === 'virtual' ? null : 'Universidad Nacional de San Antonio Abad del Cusco',
    ...extra, latitud: modalidad === 'virtual' ? null : punto?.lat ?? null, longitud: modalidad === 'virtual' ? null : punto?.lng ?? null,
  }, accion)
}
/** Lo que ve el visitante en la columna lateral (EventoDetalle, CAP-105). */
async function paginaDelVisitante(id: string) {
  const e = await bd.rpc<any>('detalle_evento', { id })
  const p = puntoDe(e)
  const html = renderToStaticMarkup(h(BloqueUbicacion, {
    modalidad: e.modalidad, lugar: e.lugar, inicio: e.fecha_inicio,
    mapa: p && h(MapaEvento, { punto: p, etiqueta: `Mapa con la ubicación de ${e.lugar}` }),
    enlaceIndicaciones: p && enlaceComoLlegar(p),
  }))
  return { e, html }
}

describe('HU-19 CA-01: la organizadora marca la ubicación y se guardan latitud y longitud', () => {
  it('dado que busca la dirección y elige la sugerencia, cuando guarda y publica, entonces se guarda ese punto junto al lugar', async () => {
    const [sug] = await buscarDirecciones('UNSAAC', nominatimFalso)
    const e = await guardarDesdeFormulario({}, sug.punto, 'publicar')
    expect(e).toMatchObject({ estado: 'publicado', lugar: 'Universidad Nacional de San Antonio Abad del Cusco', latitud: -13.521786, longitud: -71.958762 })
  })

  it('dado un evento presencial sin punto, cuando intenta publicar, entonces la pantalla y la API lo impiden con «ubicacion»', async () => {
    const lleno = { modalidad: 'presencial', tipo: 'taller', lugar: 'Aula 1', organizador_nombre: 'EPIIS', contacto: 'a@b.pe' }
    expect(faltantesParaPublicar({ ...lleno, tienePunto: false })).toHaveProperty('ubicacion')
    await expect(guardarDesdeFormulario({}, null, 'publicar')).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['ubicacion'] } })
  })

  it('dado un evento mixto sin punto, cuando intenta publicar, entonces también se impide', async () => {
    await expect(guardarDesdeFormulario({ modalidad: 'mixta' }, null, 'publicar')).rejects.toMatchObject({ detalle: { campos: ['ubicacion'] } })
  })

  it('dado un borrador sin punto, cuando lo guarda, entonces se guarda y la gestión dice que falta la ubicación', async () => {
    const e = await guardarDesdeFormulario({}, null)
    expect((await bd.rpc<any>('evento_gestion', { token, id: e.id })).faltan_para_publicar).toEqual(['ubicacion'])
  })
})

describe('HU-19 CA-02: la página muestra el mapa, la dirección y la fecha y hora de inicio', () => {
  it('dado un evento presencial con punto, cuando el visitante abre la página, entonces ve el mapa, la dirección y la hora en Lima', async () => {
    const e = await guardarDesdeFormulario({ fecha_inicio: '2026-12-05T15:00:00-05:00', fecha_fin: '2026-12-05T18:00:00-05:00' },
      { lat: -13.521786, lng: -71.958762 }, 'publicar')
    const { html } = await paginaDelVisitante(e.id)
    expect(html).toContain('Cargando mapa…')
    expect(html).toContain('Universidad Nacional de San Antonio Abad del Cusco')
    expect(html).toContain('5 de diciembre de 2026')
    expect(html).toContain('empieza a las 15:00 h')
  })

  it('dado un evento mixto con punto, entonces también muestra el mapa', async () => {
    const e = await guardarDesdeFormulario({ modalidad: 'mixta' }, { lat: -13.5, lng: -71.9 }, 'publicar')
    expect((await paginaDelVisitante(e.id)).html).toContain('Cómo llegar')
  })

  it('dado un evento publicado antes de la HU-19 (sin punto), entonces se ve la dirección con un aviso y sin mapa', async () => {
    const e = await guardarDesdeFormulario({}, { lat: -13.5, lng: -71.9 }, 'publicar')
    await bd.sql(`update capa.eventos set latitud = null, longitud = null where id = $1`, [e.id])
    const { html } = await paginaDelVisitante(e.id)
    expect(html).toContain('El organizador todavía no marcó el lugar en el mapa.')
    expect(html).not.toContain('Cómo llegar')
  })
})

describe('HU-19 CA-03: «Cómo llegar» lleva al punto correcto', () => {
  it('dado el punto elegido en la búsqueda, cuando el visitante pulsa «Cómo llegar», entonces Google Maps recibe exactamente ese punto', async () => {
    const [sug] = await buscarDirecciones('UNSAAC', nominatimFalso)
    const e = await guardarDesdeFormulario({}, sug.punto, 'publicar')
    const { html } = await paginaDelVisitante(e.id)
    expect(html).toContain('href="https://www.google.com/maps/dir/?api=1&amp;destination=-13.521786,-71.958762"')
    expect(html).toContain('target="_blank"')
  })

  it('dado que la organizadora mueve el punto, entonces el enlace apunta al punto nuevo', async () => {
    const e = await guardarDesdeFormulario({}, { lat: -13.5218, lng: -71.9588 }, 'publicar')
    const g = await bd.rpc<any>('evento_gestion', { token, id: e.id })
    await bd.rpc('guardar_evento', { ...g, token, id: e.id, accion: 'guardar', latitud: -13.5167, longitud: -71.9787 })
    expect((await paginaDelVisitante(e.id)).html).toContain('destination=-13.5167,-71.9787')
  })
})

describe('HU-19 CA-04: un evento virtual no muestra mapa', () => {
  it('dado un evento virtual, cuando se publica sin lugar ni punto, entonces la página no muestra el bloque', async () => {
    const e = await guardarDesdeFormulario({ modalidad: 'virtual' }, { lat: -13.5, lng: -71.9 }, 'publicar')
    const { e: d, html } = await paginaDelVisitante(e.id)
    expect(d).toMatchObject({ latitud: null, longitud: null })
    expect(html).toBe('')
  })

  it('dado un evento presencial con punto, cuando pasa a virtual, entonces el punto se borra y desaparece el mapa', async () => {
    const e = await guardarDesdeFormulario({}, { lat: -13.5, lng: -71.9 }, 'publicar')
    const g = await bd.rpc<any>('evento_gestion', { token, id: e.id })
    await bd.rpc('guardar_evento', { ...g, token, id: e.id, accion: 'guardar', modalidad: 'virtual', lugar: null })
    expect((await paginaDelVisitante(e.id)).html).toBe('')
  })
})

describe('HU-19 CA-05: coordenadas fuera de rango se rechazan', () => {
  it.each([[91, -71.9], [-13.5, 181], [-13.5, -431.97]])('dado (%s, %s), cuando se guarda, entonces se rechaza y no se guarda nada', async (lat, lng) => {
    await expect(guardarDesdeFormulario({}, { lat, lng })).rejects.toMatchObject({
      codigo: 'CAMPOS', message: 'Las coordenadas están fuera de rango. Vuelve a marcar el punto en el mapa.',
    })
    expect(await bd.sql(`select 1 from capa.eventos where nombre = 'Taller de Python'`)).toEqual([])
  })

  // H-01 (ver el plan): un toque en una «copia» del mapa (arrastrado más allá del borde del mundo) da una longitud
  // fuera de -180..180, y la API la rechaza aunque el lugar sea válido. El adaptador debería normalizarla.
  it.todo('dado un toque en el mapa arrastrado más allá del borde, entonces la longitud se normaliza antes de guardar (H-01)')
})
