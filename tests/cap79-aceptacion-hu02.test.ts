// CAP-79 · Pruebas de aceptación del refinamiento de la HU-02 «Crear evento» (CA-06, CA-07 y CA-08).
// Rol: DevOps y calidad de diseño (George). Plan, matriz y hallazgos en docs/pruebas/HU-02/PLAN_DE_PRUEBAS.md.
//
// Recorren la historia como la vive cada persona: la organizadora guarda un borrador, lo publica o lo edita,
// y un visitante sin sesión abre la página del evento. Lo que se muestra se arma con las mismas funciones
// que la pantalla (etiquetaTipo, textoOrganiza, ContactoOrganizador) sobre la respuesta real de la API.
// No repiten las pruebas por pieza de CAP-76, CAP-77 y CAP-78: las combinan y cubren los casos que faltaban.
// Teoría: refactorizar con pruebas (diap. 140) y LSP (diap. 64–79): crear y editar son dos caminos para
// guardar el mismo evento, así que deben cumplir las mismas reglas.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ContactoOrganizador } from '../src/components/ContactoOrganizador'
import { etiquetaTipo, faltantesParaPublicar, textoOrganiza } from '../src/lib/validacionEvento'
import { MODALIDAD } from '../src/lib/formato'
import { nuevaBd, type Bd } from './bd'

// El formulario «Escribir al organizador» pide la sesión y los avisos de la app. Aquí se dibuja como lo ve
// un visitante sin sesión, así que se reemplazan esos dos contextos por lo mínimo.
vi.mock('../src/lib/app', () => ({ useApp: () => ({ api: async () => ({ ok: true }), usuario: null }) }))
vi.mock('../src/components/notificaciones', () => ({ useNotas: () => ({ exito: () => {}, error: () => {} }) }))

let bd: Bd
let token: string
const CORREO_ORG = 'carmen@unsaac.test'

beforeEach(async () => {
  bd = await nuevaBd()
  token = (await bd.organizador(CORREO_ORG)).token
  await bd.sql(`update capa.planes set permite_virtual = true`)
})

/** Datos completos de un evento, como los manda el formulario (horas desde ahora). */
async function formulario(extra: Record<string, unknown> = {}) {
  const base = await bd.ahora()
  const hora = (n: number) => new Date(base.getTime() + n * 3600_000).toISOString()
  return {
    token, nombre: 'Seminario de Ética en la Investigación', descripcion: 'Integridad científica y plagio.',
    fecha_inicio: hora(96), fecha_fin: hora(99), modalidad: 'presencial', lugar: 'Auditorio de Derecho, Ciudad Universitaria',
    cupo_maximo: 80, costo: 0, horas_academicas: 3,
    tipo: 'seminario', organizador_nombre: 'Vicerrectorado de Investigación', contacto: 'investigacion@unsaac.test',
    contacto_consentimiento: true,
    // Punto en el mapa: lo exige publicar un evento presencial desde CAP-104 (HU-19). Antes, la API lo ignora.
    latitud: -13.5208, longitud: -71.9584, ...extra,
  }
}
const guardar = async (extra: Record<string, unknown> = {}) =>
  (await bd.rpc<any>('guardar_evento', { ...(await formulario(extra)), accion: 'guardar' })).evento
const publicar = (id: string) => bd.rpc<any>('publicar_evento', { token, id })
const editar = async (id: string, extra: Record<string, unknown>) =>
  (await bd.rpc<any>('guardar_evento', { ...(await formulario(extra)), id, accion: 'guardar' })).evento
/** Lo que recibe un visitante sin sesión. */
const pagina = (id: string) => bd.rpc<any>('detalle_evento', { id })
const catalogo = async () => bd.rpc<any[]>('catalogo_eventos', {})
const contactoHtml = (e: any) => renderToStaticMarkup(h(ContactoOrganizador, { e }))

describe('HU-02 CA-06: la página del evento muestra tipo, lugar, organizador y contacto', () => {
  it('dado un borrador completo, cuando la organizadora lo publica, entonces el visitante ve los cuatro datos', async () => {
    const borrador = await guardar()
    expect(borrador.estado).toBe('borrador')
    await publicar(borrador.id)
    const e = await pagina(borrador.id)
    expect(etiquetaTipo(e.tipo)).toBe('Seminario')
    expect(e.lugar).toBe('Auditorio de Derecho, Ciudad Universitaria')
    expect(textoOrganiza(e)).toContain('Vicerrectorado de Investigación')
    expect(contactoHtml(e)).toContain('href="mailto:investigacion@unsaac.test"')
  })

  it('dado un evento «Virtual», cuando se publica sin lugar, entonces la página dice «Virtual» y no inventa un lugar', async () => {
    const borrador = await guardar({ modalidad: 'virtual', lugar: null, tipo: 'curso' })
    await publicar(borrador.id)
    const e = await pagina(borrador.id)
    expect(MODALIDAD[e.modalidad]).toBe('Virtual')
    expect(e.lugar).toBeNull()
    expect(etiquetaTipo(e.tipo)).toBe('Curso')
  })

  it('dado un teléfono con consentimiento, cuando se publica, entonces la página ofrece llamar', async () => {
    const borrador = await guardar({ contacto: '984 555 123' })
    await publicar(borrador.id)
    expect(contactoHtml(await pagina(borrador.id))).toContain('href="tel:984555123"')
  })

  it('dado un evento publicado sin inscritos, cuando la organizadora cambia tipo y organizador, entonces la página y el catálogo lo reflejan', async () => {
    const borrador = await guardar()
    await publicar(borrador.id)
    await editar(borrador.id, { tipo: 'congreso', organizador_nombre: 'Escuela de Posgrado' })
    const e = await pagina(borrador.id)
    expect(etiquetaTipo(e.tipo)).toBe('Congreso')
    expect(textoOrganiza(e)).toContain('Escuela de Posgrado')
    expect((await catalogo()).find((x) => x.id === borrador.id)).toMatchObject({ tipo: 'congreso', organizador_nombre: 'Escuela de Posgrado' })
  })
})

describe('HU-02 CA-07: sin tipo, lugar, organizador o contacto no se publica', () => {
  // Cada campo por separado: la API nombra exactamente ese campo y el formulario resalta el mismo.
  // El lugar de un evento presencial ya se exige al guardar el borrador (CA-01); se prueba aparte.
  const casos: [string, Record<string, unknown>][] = [
    ['tipo', { tipo: null }],
    ['organizador_nombre', { organizador_nombre: null }],
    ['contacto', { contacto: null }],
  ]

  it.each(casos)('dado que falta «%s», cuando intenta publicar, entonces se impide, se nombra ese campo y el formulario resalta el mismo', async (campo, falta) => {
    const borrador = await guardar(falta)
    const err = await publicar(borrador.id).catch((x) => x)
    expect(err.codigo).toBe('CAMPOS')
    expect(err.detalle.campos).toEqual([campo])
    // El formulario (CAP-77) marca exactamente el mismo campo, con su mensaje.
    const f = await formulario(falta)
    const enPantalla = faltantesParaPublicar({
      modalidad: String(f.modalidad), tipo: String(f.tipo ?? ''), lugar: String(f.lugar ?? ''),
      organizador_nombre: String(f.organizador_nombre ?? ''), contacto: String(f.contacto ?? ''),
    })
    expect(Object.keys(enPantalla)).toEqual([campo])
    // Y el evento sigue sin verse en público.
    await expect(pagina(borrador.id)).rejects.toBeTruthy()
    expect((await catalogo()).some((x) => x.id === borrador.id)).toBe(false)
  })

  it('dado un evento presencial sin lugar, cuando intenta guardarlo o publicarlo, entonces se impide desde el borrador y el formulario resalta el lugar', async () => {
    await expect(guardar({ lugar: null })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['lugar'] } })
    await expect(bd.rpc('guardar_evento', { ...(await formulario({ lugar: '  ' })), accion: 'publicar' }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['lugar'] } })
    expect(Object.keys(faltantesParaPublicar({ modalidad: 'mixta', tipo: 'taller', lugar: '', organizador_nombre: 'X', contacto: 'x@y.pe' })))
      .toEqual(['lugar'])
    expect(await catalogo()).toEqual([])
  })

  it('dado un campo con solo espacios, cuando intenta publicar, entonces cuenta como vacío', async () => {
    const borrador = await guardar({ organizador_nombre: '   ', contacto: '  ' })
    await expect(publicar(borrador.id)).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['organizador_nombre', 'contacto'] } })
  })

  it('dado que faltan datos, cuando completa lo resaltado y vuelve a publicar, entonces se publica', async () => {
    const borrador = await guardar({ tipo: null, contacto: null })
    await expect(publicar(borrador.id)).rejects.toMatchObject({ codigo: 'CAMPOS' })
    await editar(borrador.id, { tipo: 'taller', contacto: 'eventos@unsaac.test' })
    expect((await publicar(borrador.id)).evento?.estado ?? (await pagina(borrador.id)).estado).toBe('publicado')
  })

  // D-01 (ver el plan de pruebas): editar un evento ya publicado no debe dejarlo sin estos datos.
  it('dado un evento publicado, cuando la organizadora borra el tipo, el organizador o el contacto al editar, entonces se impide y sigue con sus datos', async () => {
    const borrador = await guardar()
    await publicar(borrador.id)
    const err = await editar(borrador.id, { tipo: null, organizador_nombre: null, contacto: null }).catch((x) => x)
    expect(err.codigo).toBe('CAMPOS')
    expect(err.detalle.campos).toEqual(['tipo', 'organizador_nombre', 'contacto'])
    const e = await pagina(borrador.id)
    expect(e).toMatchObject({ tipo: 'seminario', organizador_nombre: 'Vicerrectorado de Investigación', contacto: 'investigacion@unsaac.test' })
  })
})

describe('HU-02 CA-08: sin consentimiento, el contacto no se muestra y hay un formulario (Ley N.° 29733)', () => {
  it('dado que no marca el consentimiento, cuando se publica, entonces ni la página ni el catálogo traen su correo y se ofrece el formulario', async () => {
    const borrador = await guardar({ contacto: 'carmen.privado@unsaac.test', contacto_consentimiento: false })
    await publicar(borrador.id)
    const e = await pagina(borrador.id)
    const publico = JSON.stringify([e, await catalogo()])
    expect(publico).not.toContain('carmen.privado@unsaac.test')
    const html = contactoHtml(e)
    expect(html).toContain('Escribir al organizador')
    expect(html).not.toMatch(/mailto:|tel:/)
  })

  it('dado que no dice nada sobre el consentimiento, cuando se publica, entonces se trata como «no» (privado por defecto)', async () => {
    const borrador = await guardar({ contacto: '984 000 111', contacto_consentimiento: undefined })
    await publicar(borrador.id)
    const e = await pagina(borrador.id)
    expect(e.contacto_publico).toBe(false)
    expect(JSON.stringify(e)).not.toContain('984 000 111')
  })

  it('dado un contacto público, cuando la organizadora retira el consentimiento, entonces deja de mostrarse', async () => {
    const borrador = await guardar({ contacto: 'difusion@unsaac.test' })
    await publicar(borrador.id)
    expect((await pagina(borrador.id)).contacto).toBe('difusion@unsaac.test')
    await editar(borrador.id, { contacto: 'difusion@unsaac.test', contacto_consentimiento: false })
    const e = await pagina(borrador.id)
    expect(JSON.stringify([e, await catalogo()])).not.toContain('difusion@unsaac.test')
    expect(contactoHtml(e)).toContain('Escribir al organizador')
  })

  it('dado el formulario, cuando un visitante escribe, entonces el mensaje le llega a la organizadora y el visitante no recibe su contacto', async () => {
    const borrador = await guardar({ contacto: 'carmen.privado@unsaac.test', contacto_consentimiento: false })
    await publicar(borrador.id)
    const r = await bd.rpc('contactar_organizador', {
      evento_id: borrador.id, nombre: 'Rosa Quispe', correo: 'rosa@correo.test', mensaje: '¿Habrá constancia para estudiantes de pregrado?',
    })
    expect(JSON.stringify(r)).not.toContain('carmen.privado@unsaac.test')
    const recibidos = (await bd.correos(CORREO_ORG)).filter((c) => c.tipo === 'contacto_evento')
    expect(recibidos).toHaveLength(1)
    expect(recibidos[0].cuerpo).toContain('¿Habrá constancia para estudiantes de pregrado?')
    expect(recibidos[0].cuerpo).toContain('rosa@correo.test')
  })
})
