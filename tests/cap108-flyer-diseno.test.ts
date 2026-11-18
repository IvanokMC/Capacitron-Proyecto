// CAP-108 · Estados del diseño del flyer y de la imagen del lugar (HU-20, CA-01 a CA-03).
// Rol: Diseño UI/UX (Medaly). Teoría: refactorizar con pruebas (diap. 140) y cohesión (diap. 26–28):
// un mismo componente de imagen para el catálogo, la página del evento y el lugar.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CampoImagen, FlyerEvento, ImagenEvento, ImagenLugar, PortadaTarjeta, TEXTOS_IMAGEN } from '../src/components/ImagenEvento'
import { BloqueUbicacion } from '../src/components/UbicacionEvento'

const FLYER = 'https://x.pe/flyer.webp'
const LUGAR = 'https://x.pe/lugar.jpg'
const INICIO = '2026-11-28T09:00:00-05:00'
const nada = () => {}
const campo = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(h(CampoImagen, {
  etiqueta: TEXTOS_IMAGEN.flyer, ayuda: TEXTOS_IMAGEN.ayudaFlyer, onElegir: nada, alt: '', onAlt: nada,
  altEjemplo: TEXTOS_IMAGEN.altEjemploFlyer, ...extra,
}))

describe('CAP-108 un solo componente de imagen (cohesión)', () => {
  it('el flyer se ve entero (contain); la foto del lugar se recorta (cover)', () => {
    expect(renderToStaticMarkup(h(ImagenEvento, { src: FLYER, alt: 'Afiche', variante: 'cabecera' }))).toContain('object-contain')
    expect(renderToStaticMarkup(h(ImagenEvento, { src: LUGAR, alt: 'Auditorio', variante: 'lugar' }))).toContain('object-cover')
  })

  it('carga diferida y con su texto alternativo', () => {
    const html = renderToStaticMarkup(h(ImagenEvento, { src: FLYER, alt: 'Afiche del taller', variante: 'tarjeta' }))
    expect(html).toContain('loading="lazy"')
    expect(html).toContain('alt="Afiche del taller"')
  })
})

describe('CAP-108 catálogo (CA-01)', () => {
  it('con flyer: la miniatura con el día encima, para no perder la fecha', () => {
    const html = renderToStaticMarkup(h(PortadaTarjeta, { flyer: FLYER, alt: 'Afiche', fecha: INICIO }))
    expect(html).toContain(`src="${FLYER}"`)
    expect(html).toContain('28 nov')
  })

  it('sin flyer: el bloque de fecha de siempre, sin imagen inventada', () => {
    const html = renderToStaticMarkup(h(PortadaTarjeta, { flyer: null, fecha: INICIO }))
    expect(html).not.toContain('<img')
    expect(html).toContain('>28<')
  })

  it('la miniatura mide lo mismo que el bloque de fecha (los títulos quedan alineados)', () => {
    expect(renderToStaticMarkup(h(PortadaTarjeta, { flyer: FLYER, fecha: INICIO }))).toContain('w-14')
  })
})

describe('CAP-108 página del evento (CA-01 a CA-03)', () => {
  it('el flyer va en un panel con «Ver flyer completo» en otra pestaña', () => {
    const html = renderToStaticMarkup(h(FlyerEvento, { src: FLYER, alt: 'Afiche del taller' }))
    expect(html).toContain('alt="Afiche del taller"')
    expect(html).toContain(`href="${FLYER}"`)
    expect(html).toContain('target="_blank"')
    expect(html).toContain(TEXTOS_IMAGEN.verCompleto)
  })

  it('sin flyer no se muestra nada', () => {
    expect(renderToStaticMarkup(h(FlyerEvento, { src: null }))).toBe('')
  })

  it('CA-02: la imagen del lugar va en el bloque de ubicación, junto al mapa', () => {
    const html = renderToStaticMarkup(h(BloqueUbicacion, {
      modalidad: 'presencial', lugar: 'Auditorio', inicio: INICIO, mapa: h('div', { 'data-mapa': 'si' }),
      imagen: h(ImagenLugar, { src: LUGAR, alt: 'Entrada del auditorio' }),
    }))
    expect(html.indexOf('data-mapa')).toBeLessThan(html.indexOf(LUGAR))
    expect(html).toContain('alt="Entrada del auditorio"')
  })

  it('la imagen del lugar también se ve si el evento no tiene punto en el mapa', () => {
    const html = renderToStaticMarkup(h(BloqueUbicacion, {
      modalidad: 'presencial', lugar: 'Auditorio', inicio: INICIO, imagen: h(ImagenLugar, { src: LUGAR, alt: 'Entrada' }),
    }))
    expect(html).toContain(LUGAR)
  })

  it('sin texto alternativo, la imagen se describe con su nombre, nunca vacía', () => {
    expect(renderToStaticMarkup(h(FlyerEvento, { src: FLYER }))).toContain(`alt="${TEXTOS_IMAGEN.flyer}"`)
    expect(renderToStaticMarkup(h(ImagenLugar, { src: LUGAR }))).toContain(`alt="${TEXTOS_IMAGEN.lugar}"`)
  })
})

describe('CAP-108 carga en el formulario', () => {
  it('vacío: «Subir imagen», formatos y peso, solo JPG/PNG/WEBP, sin «Quitar» ni descripción', () => {
    const html = campo()
    expect(html).toContain('Subir imagen')
    expect(html).toContain(TEXTOS_IMAGEN.formatos)
    expect(html).toContain('accept="image/jpeg,image/png,image/webp"')
    expect(html).not.toContain('Quitar')
    expect(html).not.toContain(TEXTOS_IMAGEN.alt)
  })

  it('con vista previa: «Cambiar», «Quitar», el aviso de guardar y el campo de descripción', () => {
    const html = campo({ vista: FLYER, vistaPrevia: true, onQuitar: nada, alt: 'Afiche' })
    expect(html).toContain('Cambiar')
    expect(html).toContain('Quitar')
    expect(html).toContain(TEXTOS_IMAGEN.vistaPrevia)
    expect(html).toContain(TEXTOS_IMAGEN.alt)
    expect(html).toContain('value="Afiche"')
  })

  it('archivo rechazado: el motivo como alerta, en lugar de la ayuda', () => {
    const html = campo({ error: 'El flyer pesa 4,2 MB y el límite es 3 MB.' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('El flyer pesa 4,2 MB y el límite es 3 MB.')
    expect(html).not.toContain(TEXTOS_IMAGEN.formatos)
  })

  it('subiendo: lo dice y desactiva las acciones', () => {
    const html = campo({ vista: LUGAR, cargando: true, onQuitar: nada, proporcion: 'lugar' })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Subiendo…')
    expect(html).toMatch(/<input[^>]*type="file"[^>]*disabled=""/)
  })
})
