// CAP-96 · Pruebas de aceptación de la HU-17 «Perfil del usuario con foto y datos» (CA-01 a CA-05).
// Rol: QA (Andree). Plan, matriz y hallazgos en docs/pruebas/HU-17/PLAN_DE_PRUEBAS.md.
//
// Recorren la historia como la vive la persona: elige un archivo en Mi perfil (reducirFoto), se sube con el
// módulo común de almacenamiento (CAP-97), se guarda la ruta con actualizar_perfil (CAP-94) y se ve en el
// perfil, el menú y la lista de inscritos (CAP-95). No repiten las pruebas por pieza; las combinan.
// Teoría: refactorizar con pruebas (diap. 140) y mantenibilidad (diap. 137).
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import type { Almacenamiento } from '../src/lib/almacenamiento/contrato'
import { FOTO_INICIAL, fotoVisible, guardarFoto, reducirFoto, type EstadoFoto } from '../src/lib/fotoPerfil'
import { Avatar } from '../src/components/ui'
import { nuevaBd, type Bd } from './bd'
// Importada al inicio: un import dinámico dentro de la prueba puede pasar el tiempo límite con la suite en paralelo.
import Perfil from '../src/pages/Perfil'

// Mi perfil se dibuja con una sesión de prueba: se reemplazan el contexto de la app y los avisos.
const sesion = vi.hoisted(() => ({ usuario: null as any }))
vi.mock('../src/lib/app', () => ({ useApp: () => ({ usuario: sesion.usuario, api: async () => ({}), refrescarUsuario: async () => {} }) }))
vi.mock('../src/components/notificaciones', () => ({ useNotas: () => ({ exito: () => {}, error: () => {} }) }))

const MB = 1024 * 1024
const archivo = (tipo: string, bytes = 50 * 1024) => new Blob([new Uint8Array(bytes)], { type: tipo })
const elegir = (a: Blob) => reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: a, url: 'blob:previa' })

let bd: Bd
let alm: Almacenamiento
beforeEach(async () => {
  bd = await nuevaBd()
  alm = almacenamientoLocal({ persistir: false })
})
const idDe = async (correo: string) => (await bd.sql<{ id: string }>(`select id from capa.usuarios where correo = $1`, [correo]))[0].id
/** Lo que hace «Guardar cambios» en Mi perfil: subir si hace falta y luego guardar el perfil. */
async function guardarPerfil(token: string, id: string, estado: EstadoFoto, extra: Record<string, unknown> = {}) {
  const cambio = await guardarFoto(alm, id, estado)
  return (await bd.rpc<any>('actualizar_perfil', { token, nombres: 'Ana', apellidos: 'Huamán', recordatorios_activos: true, ...cambio, ...extra })).usuario
}

describe('HU-17 CA-01: subir una foto JPG, PNG o WEBP de hasta 2 MB', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('dado un %s, cuando lo subo y guardo, entonces es mi foto en la sesión y se puede mostrar', async (tipo) => {
    const token = await bd.cuenta('ana@test.pe')
    const id = await idDe('ana@test.pe')
    const estado = elegir(archivo(tipo))
    expect(estado.error).toBeNull()
    const u = await guardarPerfil(token, id, estado)
    expect(u.foto_url.startsWith(`${id}/`)).toBe(true)
    expect((await bd.rpc<any>('sesion_actual', { token })).usuario.foto_url).toBe(u.foto_url)
    const url = await alm.url('fotos', u.foto_url)
    expect(url).toEqual(expect.any(String))
    expect(renderToStaticMarkup(h(Avatar, { nombre: 'Ana Huamán', foto: url, alt: 'Tu foto de perfil' }))).toContain('<img')
  })

  it('dado un archivo de exactamente 2 MB, cuando lo elijo, entonces se acepta (el límite incluye los 2 MB)', () => {
    expect(elegir(archivo('image/png', 2 * MB)).error).toBeNull()
  })

  it('dada una foto nueva, cuando la cambio por otra, entonces queda la nueva y la anterior no se pisa', async () => {
    const token = await bd.cuenta('ana@test.pe')
    const id = await idDe('ana@test.pe')
    const primera = (await guardarPerfil(token, id, elegir(archivo('image/png')))).foto_url
    const segunda = (await guardarPerfil(token, id, elegir(archivo('image/webp')))).foto_url
    expect(segunda).not.toBe(primera)
    expect(segunda.endsWith('.webp')).toBe(true)
    expect((await bd.rpc<any>('sesion_actual', { token })).usuario.foto_url).toBe(segunda)
  })
})

describe('HU-17 CA-02: otro tipo o más de 2 MB se rechaza con el motivo', () => {
  it.each([
    ['image/gif', 'GIF'], ['image/svg+xml', 'SVG (puede llevar código)'], ['application/pdf', 'PDF'], ['image/heic', 'HEIC del celular'], ['', 'sin tipo'],
  ])('dado un archivo %s (%s), cuando lo elijo, entonces se rechaza nombrando los formatos válidos y no se sube nada', async (tipo) => {
    const estado = elegir(archivo(tipo))
    expect(estado.error).toBe('La foto debe ser una imagen JPG, PNG o WEBP.')
    expect(estado.archivo).toBeNull()
    expect(await guardarFoto(alm, 'x', estado)).toEqual({})
  })

  it('dado un archivo de 3,1 MB, cuando lo elijo, entonces dice cuánto pesa y cuál es el límite', () => {
    expect(elegir(archivo('image/jpeg', 3.1 * MB)).error).toBe('La foto pesa 3,1 MB y el límite es 2 MB.')
  })

  // H-01 (ver el plan de pruebas): decía «pesa 2,0 MB y el límite es 2 MB». Corregido en CAP-97 el 17/11/2026.
  it('dado un archivo apenas mayor a 2 MB, cuando lo elijo, entonces el peso que muestra es mayor que el límite (H-01)', () => {
    expect(elegir(archivo('image/png', 2 * MB + 1)).error).toBe('La foto pesa 2,1 MB y el límite es 2 MB.')
  })

  it('dado que alguien salta la pantalla, cuando guarda una ruta que no es JPG, PNG o WEBP, entonces la API también la rechaza', async () => {
    const token = await bd.cuenta('ana@test.pe')
    const id = await idDe('ana@test.pe')
    await expect(bd.rpc('actualizar_perfil', { token, nombres: 'Ana', apellidos: 'Huamán', foto_url: `${id}/foto.gif` }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['foto_url'] } })
  })

  it('dado un archivo rechazado, cuando ya tenía otra elegida, entonces conserva la vista previa anterior y muestra el motivo', () => {
    const conPrevia = elegir(archivo('image/png'))
    const e = reducirFoto(conPrevia, { tipo: 'elegir', archivo: archivo('application/pdf'), url: '' })
    expect(fotoVisible(e, null)).toBe('blob:previa')
    expect(e.error).toMatch(/JPG, PNG o WEBP/)
  })
})

describe('HU-17 CA-03: quitar la foto vuelve a mostrar las iniciales', () => {
  it('dado que tengo foto, cuando la quito y guardo, entonces la sesión queda sin foto y el avatar muestra mis iniciales', async () => {
    const token = await bd.cuenta('ana@test.pe')
    const id = await idDe('ana@test.pe')
    await guardarPerfil(token, id, elegir(archivo('image/png')))
    const u = await guardarPerfil(token, id, reducirFoto(FOTO_INICIAL, { tipo: 'quitar' }))
    expect(u.foto_url).toBeNull()
    expect(renderToStaticMarkup(h(Avatar, { nombre: 'Ana Huamán', foto: null }))).toContain('>AH<')
  })

  it('dado que quito la foto, cuando el organizador abre la lista de inscritos, entonces ya no la ve', async () => {
    const org = await bd.organizador('org@test.pe')
    const e = await bd.evento(org.token)
    const token = await bd.cuenta('ana@test.pe')
    const id = await idDe('ana@test.pe')
    await guardarPerfil(token, id, elegir(archivo('image/png')))
    await bd.rpc('inscribirse', { token, evento_id: e.id })
    expect((await bd.rpc<any>('evento_gestion', { token: org.token, id: e.id })).inscritos[0].foto_url).toMatch(new RegExp(`^${id}/`))
    await guardarPerfil(token, id, reducirFoto(FOTO_INICIAL, { tipo: 'quitar' }))
    expect((await bd.rpc<any>('evento_gestion', { token: org.token, id: e.id })).inscritos[0].foto_url).toBeNull()
  })
})

describe('HU-17 CA-04: Mi perfil muestra los datos y deja editar solo los que no son de solo lectura', () => {
  const usuarioDePrueba = {
    id: '00000000-0000-4000-8000-000000000001', nombres: 'Ana', apellidos: 'Huamán', nombre_completo: 'Ana Huamán',
    correo: 'ana@test.pe', rol: 'organizador', estado: 'activa', recordatorios_activos: true, foto_url: null,
    celular: '984123456', comparte_celular: false,
    institucion: { id: 'i', nombre: 'Universidad Nacional de San Antonio Abad del Cusco', siglas: 'UNSAAC', estado: 'activa', plan: {} },
  }

  it('dado que abro Mi perfil, entonces veo nombres y apellidos editables y correo, rol e institución de solo lectura', async () => {
    sesion.usuario = usuarioDePrueba
    const html = renderToStaticMarkup(h(Perfil))
    expect(html).toMatch(/value="Ana"(?![^>]*disabled)/)
    expect(html).toMatch(/value="Huamán"(?![^>]*disabled)/)
    expect(html).toMatch(/value="ana@test.pe"[^>]*disabled|disabled[^>]*value="ana@test.pe"/)
    expect(html).toContain('Universidad Nacional de San Antonio Abad del Cusco')
    expect(html).toContain('Organizador')
  })

  // El celular llega en la sesión desde CAP-99; la pantalla lo muestra con CAP-100 (José, 22/11).
  it.todo('dado que abro Mi perfil, entonces también veo mi celular y si lo comparto (CAP-100)')

  it('dado que alguien manda rol, correo o institución al guardar el perfil, cuando se guarda, entonces no cambian', async () => {
    const token = await bd.cuenta('ana@test.pe')
    const u = (await bd.rpc<any>('actualizar_perfil', {
      token, nombres: 'Ana María', apellidos: 'Huamán', rol: 'admin', correo: 'otra@test.pe', institucion_id: '00000000-0000-4000-8000-000000000009',
    })).usuario
    expect(u).toMatchObject({ nombres: 'Ana María', rol: 'asistente', correo: 'ana@test.pe', institucion: null })
  })
})

describe('HU-17 CA-05: solo yo puedo cambiar o quitar mi foto', () => {
  it('dada la foto de Ana, cuando Beto intenta usarla como suya, entonces se rechaza y la foto de Ana sigue igual', async () => {
    const ana = await bd.cuenta('ana@test.pe')
    const idAna = await idDe('ana@test.pe')
    const fotoAna = (await guardarPerfil(ana, idAna, elegir(archivo('image/png')))).foto_url
    const beto = await bd.cuenta('beto@test.pe')
    await expect(bd.rpc('actualizar_perfil', { token: beto, nombres: 'Beto', apellidos: 'Prueba', foto_url: fotoAna }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['foto_url'] } })
    expect((await bd.rpc<any>('sesion_actual', { token: ana })).usuario.foto_url).toBe(fotoAna)
  })

  it('dado que Beto cambia o quita su propia foto, entonces la de Ana no cambia', async () => {
    const ana = await bd.cuenta('ana@test.pe')
    const fotoAna = (await guardarPerfil(ana, await idDe('ana@test.pe'), elegir(archivo('image/png')))).foto_url
    const beto = await bd.cuenta('beto@test.pe')
    const idBeto = await idDe('beto@test.pe')
    await guardarPerfil(beto, idBeto, elegir(archivo('image/jpeg')))
    await guardarPerfil(beto, idBeto, reducirFoto(FOTO_INICIAL, { tipo: 'quitar' }))
    expect((await bd.rpc<any>('sesion_actual', { token: ana })).usuario.foto_url).toBe(fotoAna)
  })

  it('dado un archivo ya subido, cuando alguien intenta subir otro en la misma ruta, entonces el almacenamiento no lo reemplaza', async () => {
    const ruta = await alm.subir('fotos', '00000000-0000-4000-8000-000000000001/a.png', archivo('image/png'))
    await expect(alm.subir('fotos', ruta, archivo('image/png', 10))).rejects.toBeTruthy()
  })

  it('dado que no hay sesión, cuando se intenta cambiar una foto, entonces se pide iniciar sesión', async () => {
    await expect(bd.rpc('actualizar_perfil', { nombres: 'X', apellidos: 'Y', foto_url: null })).rejects.toMatchObject({ codigo: 'NO_AUTH' })
  })
})

describe('HU-17 dónde se ve la foto: perfil, menú e inscritos', () => {
  it('el menú, el perfil y la lista de inscritos usan la ruta guardada con el mismo avatar', () => {
    const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8')
    expect(leer('../src/components/Shell.tsx')).toMatch(/<AvatarUsuario[^>]*ruta=\{usuario\.foto_url\}/)
    expect(leer('../src/pages/organizador/GestionEvento.tsx')).toMatch(/<AvatarUsuario[^>]*ruta=\{i\.foto_url\}/)
    expect(leer('../src/pages/Perfil.tsx')).toContain("useUrlArchivo('fotos', usuario?.foto_url)")
  })
})
