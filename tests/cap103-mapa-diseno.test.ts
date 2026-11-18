// CAP-103 · Estados del diseño del mapa del evento y del selector de ubicación (HU-19, CA-01 a CA-04).
// Rol: Diseño UI/UX (Medaly). Teoría: refactorizar con pruebas (diap. 140): cada estado del prototipo
// queda fijado, así CAP-105 (José) puede conectar el mapa real sin romper el diseño sin que se note.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { BloqueUbicacion, SelectorUbicacion, TEXTOS_UBICACION, textoPunto } from '../src/components/UbicacionEvento'

const LUGAR = 'Auditorio de Ingeniería, Ciudad Universitaria de Perayoc'
const INICIO = '2026-11-24T15:00:00-05:00'
const ENLACE = 'https://www.google.com/maps/dir/?api=1&destination=-13.5208,-71.9584'
const MAPA = h('div', { 'data-mapa': 'si' })
const nada = () => {}
const bloque = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(h(BloqueUbicacion, {
  modalidad: 'presencial', lugar: LUGAR, inicio: INICIO, mapa: MAPA, enlaceIndicaciones: ENLACE, ...extra,
}))
const selector = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(h(SelectorUbicacion, {
  lugar: '', onLugar: nada, punto: null, onQuitarPunto: nada, mapa: MAPA, ...extra,
}))

describe('CAP-103 página del evento (CA-02 a CA-04)', () => {
  it('CA-02: muestra el mapa, la dirección y la fecha y hora de inicio en hora de Lima', () => {
    const html = bloque()
    expect(html).toContain('data-mapa="si"')
    expect(html).toContain(LUGAR)
    expect(html).toContain('24 de noviembre de 2026')
    expect(html).toContain('empieza a las 15:00 h')
  })

  it('CA-03: «Cómo llegar» abre Google Maps en otra pestaña y dice a dónde lleva', () => {
    const html = bloque()
    expect(html).toContain(`href="${ENLACE.replace(/&/g, '&amp;')}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain('rel="noreferrer"')
    expect(html).toContain(`aria-label="Cómo llegar a ${LUGAR} (abre Google Maps en otra pestaña)"`)
  })

  it('CA-04: un evento virtual no muestra nada', () => {
    expect(bloque({ modalidad: 'virtual' })).toBe('')
  })

  it('sin punto marcado se ve la dirección con un aviso, sin mapa ni botón', () => {
    const html = bloque({ mapa: null, enlaceIndicaciones: null })
    expect(html).toContain(LUGAR)
    expect(html).toContain(TEXTOS_UBICACION.sinPunto)
    expect(html).not.toContain('data-mapa')
    expect(html).not.toContain('Cómo llegar')
  })
})

describe('CAP-103 selector de ubicación en el formulario (CA-01)', () => {
  it('sin punto: campo de lugar con su ayuda y la instrucción sobre el mapa', () => {
    const html = selector()
    expect(html).toContain('Lugar y punto en el mapa')
    expect(html).toContain(TEXTOS_UBICACION.ayudaLugar)
    expect(html).toContain(TEXTOS_UBICACION.instruccion)
    expect(html).not.toContain(TEXTOS_UBICACION.marcado)
  })

  it('al escribir muestra las sugerencias como lista de opciones accesible', () => {
    const html = selector({ lugar: 'Auditorio Perayoc', sugerencias: [{ id: '1', nombre: LUGAR, detalle: 'Av. de la Cultura, Cusco' }] })
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('role="listbox"')
    expect(html).toContain('role="option"')
    expect(html).toContain('Av. de la Cultura, Cusco')
  })

  it('mientras busca y cuando no encuentra, lo dice y sugiere tocar el mapa', () => {
    expect(selector({ lugar: 'Auditorio', buscando: true })).toContain(TEXTOS_UBICACION.buscando)
    expect(selector({ lugar: 'Local comunal', sinResultados: true })).toContain(TEXTOS_UBICACION.sinResultados)
  })

  it('con punto: muestra las coordenadas legibles y el botón para quitarlo, sin la instrucción', () => {
    const html = selector({ lugar: LUGAR, punto: { lat: -13.5208, lng: -71.9584 } })
    expect(html).toContain('13,5208° S · 71,9584° O')
    expect(html).toContain(TEXTOS_UBICACION.quitar)
    expect(html).not.toContain(TEXTOS_UBICACION.instruccion)
  })

  it('un error del punto (CA-05) se anuncia y marca el mapa', () => {
    const html = selector({ error: 'Las coordenadas están fuera de rango.' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('Las coordenadas están fuera de rango.')
    expect(html).toContain('border-error')
  })

  it('un error del lugar reemplaza la ayuda y marca el campo', () => {
    const html = selector({ errorLugar: 'Indica el lugar del evento presencial o mixto.' })
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('Indica el lugar del evento presencial o mixto.')
    expect(html).not.toContain(TEXTOS_UBICACION.ayudaLugar)
  })

  it('las sugerencias largas no ensanchan el formulario en celular', () => {
    const html = selector({ lugar: 'Aud', sugerencias: [{ id: '1', nombre: LUGAR }] })
    expect(html).toContain('min-w-0 space-y-3')
    expect(html).toContain('[contain:inline-size]')
  })
})

describe('CAP-103 coordenadas legibles', () => {
  it('usa hemisferio y coma decimal con 4 decimales (unos 11 m)', () => {
    expect(textoPunto({ lat: -13.52081234, lng: -71.95844 })).toBe('13,5208° S · 71,9584° O')
    expect(textoPunto({ lat: 40.4168, lng: 3.7038 })).toBe('40,4168° N · 3,7038° E')
  })
})
