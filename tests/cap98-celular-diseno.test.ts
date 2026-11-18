// CAP-98 · Campo de celular con consentimiento y celda de celular en la lista de inscritos
// (HU-18, CA-01 a CA-03 y CA-05). Rol: Diseño UI/UX (Medaly). Teoría: refactorizar con pruebas
// (diap. 140): cada estado del prototipo queda fijado, así CAP-100 no rompe el diseño sin que se note.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CampoCelular, CeldaCelular, TEXTOS_CELULAR } from '../src/components/ui'
import { celular } from '../src/lib/formato'

const nada = () => {}
const campo = (props: Partial<Parameters<typeof CampoCelular>[0]> = {}) =>
  renderToStaticMarkup(h(CampoCelular, { valor: '', onCambio: nada, comparte: false, onComparte: nada, ...props }))

describe('CAP-98 CampoCelular (registro y perfil)', () => {
  it('CA-01: campo numérico de 9 dígitos con prefijo +51 y la ayuda del formato', () => {
    const html = campo()
    expect(html).toContain('+51')
    expect(html).toContain('inputMode="numeric"')
    expect(html).toContain('maxLength="9"')
    expect(html).toContain(TEXTOS_CELULAR.ayuda)
  })

  it('CA-01: con error, el campo se resalta y el motivo se anuncia', () => {
    const html = campo({ valor: '88412345', error: 'El celular debe tener 9 dígitos y empezar con 9.' })
    expect(html).toContain('aria-invalid="true"')
    expect(html).toContain('role="alert"')
    expect(html).toContain('El celular debe tener 9 dígitos y empezar con 9.')
    expect(html).not.toContain(TEXTOS_CELULAR.ayuda)
  })

  it('CA-02: el consentimiento va en el mismo grupo que el dato y explica para qué se usa', () => {
    const html = campo()
    expect(html).toMatch(/<fieldset[\s\S]*type="tel"[\s\S]*type="checkbox"[\s\S]*<\/fieldset>/)
    expect(html).toContain(TEXTOS_CELULAR.consentimiento)
    expect(html).toContain('Ley N.° 29733')
  })

  it('CA-02: la casilla empieza sin marcar (el permiso es explícito)', () => {
    expect(campo()).not.toMatch(/type="checkbox"[^>]*checked/)
    expect(campo({ comparte: true })).toMatch(/type="checkbox"[^>]*checked/)
  })

  it('CA-03: al retirar el permiso en el perfil, avisa qué pasará al guardar', () => {
    const html = campo({ valor: '984123456', comparteAntes: true, comparte: false })
    expect(html).toContain(TEXTOS_CELULAR.retirado)
    expect(campo({ valor: '984123456', comparteAntes: true, comparte: true })).not.toContain(TEXTOS_CELULAR.retirado)
  })
})

describe('CAP-98 CeldaCelular (lista de inscritos)', () => {
  it('CA-05: con permiso muestra el número legible y el botón de WhatsApp', () => {
    const html = renderToStaticMarkup(h(CeldaCelular, { celular: '984123456', nombre: 'Ana Prueba', enlaceWhatsapp: 'https://wa.me/51984123456' }))
    expect(html).toContain('984 123 456')
    expect(html).toContain('href="tel:+51984123456"')
    expect(html).toContain('href="https://wa.me/51984123456"')
    expect(html).toContain('aria-label="Escribir por WhatsApp a Ana Prueba"')
    expect(html).toContain('rel="noreferrer"')
  })

  it('CA-02: sin permiso muestra «No compartido» y ningún enlace', () => {
    const html = renderToStaticMarkup(h(CeldaCelular, { celular: null, nombre: 'Ana Prueba', enlaceWhatsapp: 'https://wa.me/51984123456' }))
    expect(html).toContain(TEXTOS_CELULAR.noCompartido)
    expect(html).not.toContain('href=')
  })

  it('sin enlace de WhatsApp, solo muestra el número', () => {
    const html = renderToStaticMarkup(h(CeldaCelular, { celular: '984123456', nombre: 'Ana Prueba' }))
    expect(html).toContain('984 123 456')
    expect(html).not.toContain('WhatsApp')
  })

  it('el formato agrupa de tres en tres solo si hay 9 dígitos', () => {
    expect(celular('984123456')).toBe('984 123 456')
    expect(celular('98412')).toBe('98412')
  })
})
