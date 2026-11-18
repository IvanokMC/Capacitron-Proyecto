// CAP-78 · Campos públicos del evento y contacto con consentimiento (HU-02, CA-06 y CA-08).
// Rol: Frontend (José). Teoría: refactorizar con pruebas (diap. 140): estas pruebas fijan qué ve
// el público, y las de CAP-76 y CAP-77 confirman que la privacidad del contacto no cambió.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'
import { etiquetaTipo, textoOrganiza } from '../src/lib/validacionEvento'
import { ContactoOrganizador } from '../src/components/ContactoOrganizador'

let bd: Bd
let token: string
let correoOrg: string
beforeEach(async () => {
  bd = await nuevaBd()
  correoOrg = 'org@test.pe'
  token = (await bd.organizador(correoOrg)).token
})

const catalogo = async () => (await bd.rpc<any[]>('catalogo_eventos', {}))
const detalle = (id: string) => bd.rpc<any>('detalle_evento', { id })
const mensaje = (evento_id: string, extra: Record<string, unknown> = {}) => bd.rpc('contactar_organizador', {
  evento_id, nombre: 'Lucía Visitante', correo: 'lucia@correo.pe', mensaje: '¿El taller entrega materiales impresos?', ...extra,
})

describe('CAP-78 API: datos públicos del evento (CA-06)', () => {
  it('el catálogo muestra el tipo y el nombre del organizador', async () => {
    const e = await bd.evento(token, { tipo: 'congreso', organizador_nombre: 'EPIIS UNSAAC' })
    const fila = (await catalogo()).find((x) => x.id === e.id)
    expect(fila).toMatchObject({ tipo: 'congreso', organizador_nombre: 'EPIIS UNSAAC' })
  })

  it('la página del evento muestra tipo, lugar y organizador', async () => {
    const e = await bd.evento(token, { tipo: 'seminario', lugar: 'Auditorio de Ingeniería' })
    expect(await detalle(e.id)).toMatchObject({ tipo: 'seminario', lugar: 'Auditorio de Ingeniería', organizador_nombre: 'Organización de prueba' })
  })

  it('CA-06: con consentimiento, el contacto se publica', async () => {
    const e = await bd.evento(token, { contacto: '984 111 222', contacto_consentimiento: true })
    expect(await detalle(e.id)).toMatchObject({ contacto_publico: true, contacto: '984 111 222' })
  })

  it('CA-08: sin consentimiento, el contacto no viaja ni en el detalle ni en el catálogo', async () => {
    const e = await bd.evento(token, { contacto: 'privado@test.pe', contacto_consentimiento: false })
    const d = await detalle(e.id)
    expect(d).toMatchObject({ contacto_publico: false, contacto: null })
    expect(JSON.stringify(d)).not.toContain('privado@test.pe')
    expect(JSON.stringify(await catalogo())).not.toContain('privado@test.pe')
  })
})

describe('CAP-78 API: formulario «Escribir al organizador» (CA-08)', () => {
  it('el mensaje le llega por correo al organizador, con el correo para responder', async () => {
    const e = await bd.evento(token, { contacto: 'privado@test.pe' })
    expect(await mensaje(e.id)).toEqual({ ok: true })
    const [c] = (await bd.correos(correoOrg)).filter((x: any) => x.tipo === 'contacto_evento')
    expect(c.asunto).toBe('Consulta sobre Evento de prueba')
    expect(c.cuerpo).toContain('lucia@correo.pe')
    expect(c.cuerpo).toContain('¿El taller entrega materiales impresos?')
    expect(c.accion_url).toBe(`/eventos/${e.id}`)
  })

  it('el visitante no recibe el contacto privado en la respuesta', async () => {
    const e = await bd.evento(token, { contacto: 'privado@test.pe' })
    expect(JSON.stringify(await mensaje(e.id))).not.toContain('privado@test.pe')
    expect(await bd.correos('lucia@correo.pe')).toEqual([])
  })

  it('nombre vacío, correo inválido y mensaje corto se rechazan nombrando cada campo', async () => {
    const e = await bd.evento(token)
    await expect(mensaje(e.id, { nombre: '', correo: 'no-es-correo', mensaje: 'hola' }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['nombre', 'correo', 'mensaje'] } })
  })

  it('un mensaje de más de 1000 caracteres se rechaza', async () => {
    const e = await bd.evento(token)
    await expect(mensaje(e.id, { mensaje: 'a'.repeat(1001) })).rejects.toMatchObject({ codigo: 'CAMPOS' })
  })

  it('no se puede escribir sobre un borrador', async () => {
    const e = await bd.evento(token, {}, 'borrador')
    await expect(mensaje(e.id)).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' })
  })

  it('después de 10 mensajes en una hora, el siguiente espera', async () => {
    const e = await bd.evento(token)
    for (let i = 0; i < 10; i++) await mensaje(e.id)
    await expect(mensaje(e.id)).rejects.toMatchObject({ codigo: 'LIMITE' })
    await bd.adelantar(61)
    expect(await mensaje(e.id)).toEqual({ ok: true })
  })
})

describe('CAP-78 pantalla', () => {
  it('etiquetaTipo usa las mismas etiquetas que el formulario', () => {
    expect(etiquetaTipo('congreso')).toBe('Congreso')
    expect(etiquetaTipo(null)).toBeNull()
  })

  it('textoOrganiza junta el nombre público con la institución sin repetirla', () => {
    const inst = { nombre: 'UNSAAC' }
    expect(textoOrganiza({ organizador_nombre: 'EPIIS', organizador: 'Ana Ruiz', institucion: inst })).toBe('EPIIS · UNSAAC')
    expect(textoOrganiza({ organizador_nombre: 'UNSAAC', organizador: 'Ana Ruiz', institucion: inst })).toBe('UNSAAC')
    expect(textoOrganiza({ organizador_nombre: null, organizador: 'Ana Ruiz', institucion: null })).toBe('Ana Ruiz')
  })

  it('con consentimiento, el contacto se muestra como enlace de correo o de teléfono', () => {
    const base = { id: 'x', organizador: 'Ana Ruiz', organizador_nombre: 'EPIIS', contacto_publico: true }
    expect(renderToStaticMarkup(h(ContactoOrganizador, { e: { ...base, contacto: 'epiis@unsaac.edu.pe' } })))
      .toContain('href="mailto:epiis@unsaac.edu.pe"')
    expect(renderToStaticMarkup(h(ContactoOrganizador, { e: { ...base, contacto: '984 111 222' } })))
      .toContain('href="tel:984111222"')
  })
})
