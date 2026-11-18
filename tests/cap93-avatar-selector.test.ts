// CAP-93 · Avatar y selector de foto (HU-17, CA-01 a CA-04): estados visuales del diseño.
// Rol: Diseño UI/UX (Medaly). Teoría: refactorizar con pruebas (diap. 140): cada estado del
// prototipo queda fijado, así los cambios de CAP-95 no rompen el diseño sin que se note.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Avatar, SelectorFoto } from '../src/components/ui'

const nada = () => {}
const selector = (props: Partial<Parameters<typeof SelectorFoto>[0]> = {}) =>
  renderToStaticMarkup(h(SelectorFoto, { nombre: 'Ana Prueba', onElegir: nada, onQuitar: nada, ...props }))

describe('CAP-93 Avatar', () => {
  it('CA-03: sin foto muestra las iniciales', () => {
    const html = renderToStaticMarkup(h(Avatar, { nombre: 'Ana Prueba' }))
    expect(html).toContain('>AP<')
    expect(html).not.toContain('<img')
  })

  it('con foto muestra la imagen', () => {
    const html = renderToStaticMarkup(h(Avatar, { nombre: 'Ana Prueba', foto: 'https://x.pe/a.png', alt: 'Foto de Ana' }))
    expect(html).toContain('<img')
    expect(html).toContain('alt="Foto de Ana"')
  })

  it('el tono oscuro sirve para el menú granate', () => {
    expect(renderToStaticMarkup(h(Avatar, { nombre: 'Ana Prueba', tono: 'oscuro' }))).toContain('bg-white/15')
  })

  it('un nombre vacío no deja el avatar en blanco', () => {
    expect(renderToStaticMarkup(h(Avatar, { nombre: '' }))).toContain('>?<')
  })
})

describe('CAP-93 Selector de foto', () => {
  it('sin foto: botón «Subir foto», ayuda con formatos y tamaño, sin «Quitar»', () => {
    const html = selector()
    expect(html).toContain('Subir foto')
    expect(html).toContain('JPG, PNG o WEBP de hasta 2 MB.')
    expect(html).not.toContain('Quitar foto')
  })

  it('con foto: «Cambiar foto» y «Quitar foto»', () => {
    const html = selector({ foto: 'https://x.pe/a.png' })
    expect(html).toContain('Cambiar foto')
    expect(html).toContain('Quitar foto')
  })

  it('CA-01 vista previa: insignia y aviso de que falta guardar', () => {
    const html = selector({ foto: 'blob:previa', vistaPrevia: true })
    expect(html).toContain('Vista previa')
    expect(html).toContain('Guarda los cambios para usarla.')
  })

  it('cargando: marca ocupado y desactiva los botones', () => {
    const html = selector({ foto: 'https://x.pe/a.png', cargando: true })
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Subiendo la foto')
    expect(html).toMatch(/<input[^>]*disabled/)
  })

  it('CA-02 archivo rechazado: muestra el motivo como alerta accesible', () => {
    const html = selector({ error: 'La foto pesa 3,1 MB y el límite es 2 MB.' })
    expect(html).toContain('role="alert"')
    expect(html).toContain('La foto pesa 3,1 MB y el límite es 2 MB.')
    expect(html).toContain('aria-invalid="true"')
  })

  it('solo acepta los formatos del criterio CA-01', () => {
    expect(selector()).toContain('accept="image/jpeg,image/png,image/webp"')
  })
})
