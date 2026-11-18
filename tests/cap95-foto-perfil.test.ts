// CAP-95 · Subir, cambiar y quitar la foto de perfil; avatar en el menú y en la lista de inscritos
// (HU-17, CA-01 a CA-04). Rol: Frontend (José). Teoría: refactorizar con pruebas (diap. 140): la lógica
// de la foto se prueba sin navegador porque está separada de la pantalla (SRP, diap. 39–49).
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import { FOTO_INICIAL, fotoVisible, guardarFoto, reducirFoto, type EstadoFoto } from '../src/lib/fotoPerfil'
import { AvatarUsuario } from '../src/components/AvatarUsuario'
import { nuevaBd, type Bd } from './bd'

const png = (bytes = 1024) => new Blob([new Uint8Array(bytes)], { type: 'image/png' })
const GUARDADA = 'https://x.pe/guardada.png'

describe('CAP-95 estados de la foto en Mi perfil', () => {
  it('CA-01: elegir una imagen válida muestra la vista previa', () => {
    const e = reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(), url: 'blob:previa' })
    expect(e).toMatchObject({ previa: 'blob:previa', error: null, quitar: false })
    expect(fotoVisible(e, GUARDADA)).toBe('blob:previa')
  })

  it('CA-02: un archivo de otro tipo se rechaza con el motivo y no cambia la foto', () => {
    const e = reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: new Blob(['x'], { type: 'image/gif' }), url: '' })
    expect(e.error).toBe('La foto debe ser una imagen JPG, PNG o WEBP.')
    expect(e.archivo).toBeNull()
    expect(fotoVisible(e, GUARDADA)).toBe(GUARDADA)
  })

  it('CA-02: más de 2 MB se rechaza diciendo cuánto pesa', () => {
    const e = reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(3.1 * 1024 * 1024), url: '' })
    expect(e.error).toBe('La foto pesa 3,1 MB y el límite es 2 MB.')
  })

  it('un rechazo no borra la vista previa que ya estaba elegida', () => {
    const conPrevia = reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(), url: 'blob:previa' })
    const e = reducirFoto(conPrevia, { tipo: 'elegir', archivo: new Blob(['x'], { type: 'text/plain' }), url: '' })
    expect(e.previa).toBe('blob:previa')
    expect(e.error).not.toBeNull()
  })

  it('«Quitar» con vista previa la descarta y vuelve a la foto guardada', () => {
    const conPrevia = reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(), url: 'blob:previa' })
    const e = reducirFoto(conPrevia, { tipo: 'quitar' })
    expect(e).toEqual(FOTO_INICIAL)
    expect(fotoVisible(e, GUARDADA)).toBe(GUARDADA)
  })

  it('CA-03: «Quitar» sin vista previa marca la foto guardada para quitarla y se ven las iniciales', () => {
    const e = reducirFoto(FOTO_INICIAL, { tipo: 'quitar' })
    expect(e.quitar).toBe(true)
    expect(fotoVisible(e, GUARDADA)).toBeNull()
  })
})

describe('CAP-95 guardar la foto con el módulo de almacenamiento (CAP-97) y la API (CAP-94)', () => {
  let bd: Bd
  let token: string
  let id: string
  beforeEach(async () => {
    bd = await nuevaBd()
    token = await bd.cuenta('ana@test.pe')
    id = await idDe('ana@test.pe')
  })
  const idDe = async (correo: string) => (await bd.sql<{ id: string }>(`select id from capa.usuarios where correo = $1`, [correo]))[0].id
  const perfil = (extra: Record<string, unknown>) =>
    bd.rpc<any>('actualizar_perfil', { token, nombres: 'Ana', apellidos: 'Prueba', recordatorios_activos: true, ...extra })

  it('CA-01: sube la foto a la carpeta de la persona y la ruta queda guardada en su perfil', async () => {
    const alm = almacenamientoLocal({ persistir: false })
    const estado = reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(), url: 'blob:previa' })
    const cambio = await guardarFoto(alm, id, estado)
    expect(cambio.foto_url!.startsWith(`${id}/`)).toBe(true)
    const r = await perfil(cambio)
    expect(r.usuario.foto_url).toBe(cambio.foto_url)
    expect(await alm.url('fotos', cambio.foto_url!)).toEqual(expect.any(String))
  })

  it('CA-03: quitar la foto la deja en null y se vuelven a ver las iniciales', async () => {
    const alm = almacenamientoLocal({ persistir: false })
    await perfil(await guardarFoto(alm, id, reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(), url: 'blob:x' })))
    const cambio = await guardarFoto(alm, id, reducirFoto(FOTO_INICIAL, { tipo: 'quitar' }))
    expect(cambio).toEqual({ foto_url: null })
    expect((await perfil(cambio)).usuario.foto_url).toBeNull()
  })

  it('si no se tocó la foto, no se manda foto_url y la foto guardada se conserva', async () => {
    const alm = almacenamientoLocal({ persistir: false })
    const { foto_url } = await guardarFoto(alm, id, reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(), url: 'blob:x' }))
    await perfil({ foto_url })
    const cambio = await guardarFoto(alm, id, FOTO_INICIAL as EstadoFoto)
    expect(cambio).toEqual({})
    expect((await perfil({ ...cambio, nombres: 'Ana María' })).usuario.foto_url).toBe(foto_url)
  })

  it('CA-05: no se puede usar como foto propia un archivo de la carpeta de otra persona', async () => {
    await bd.cuenta('otra@test.pe')
    const cambio = await guardarFoto(almacenamientoLocal({ persistir: false }), await idDe('otra@test.pe'),
      reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(), url: 'blob:x' }))
    await expect(perfil(cambio)).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['foto_url'] } })
  })

  it('la lista de inscritos del organizador trae la foto de cada asistente', async () => {
    const org = await bd.organizador('org@test.pe')
    const e = await bd.evento(org.token)
    const alm = almacenamientoLocal({ persistir: false })
    const { foto_url } = await guardarFoto(alm, id, reducirFoto(FOTO_INICIAL, { tipo: 'elegir', archivo: png(), url: 'blob:x' }))
    await perfil({ foto_url })
    await bd.rpc('inscribirse', { token, evento_id: e.id })
    const g = await bd.rpc<any>('evento_gestion', { token: org.token, id: e.id })
    expect(g.inscritos[0].foto_url).toBe(foto_url)
  })
})

describe('CAP-95 avatar en el menú, el perfil y los inscritos', () => {
  it('sin ruta muestra las iniciales', () => {
    expect(renderToStaticMarkup(h(AvatarUsuario, { nombre: 'Ana Prueba' }))).toContain('>AP<')
  })

  it('el menú y la lista de inscritos usan el mismo AvatarUsuario', () => {
    const shell = readFileSync(new URL('../src/components/Shell.tsx', import.meta.url), 'utf8')
    const gestion = readFileSync(new URL('../src/pages/organizador/GestionEvento.tsx', import.meta.url), 'utf8')
    expect(shell).toMatch(/<AvatarUsuario[^>]*ruta=\{usuario\.foto_url\}[^>]*tono="oscuro"/)
    expect(gestion).toMatch(/<AvatarUsuario[^>]*ruta=\{i\.foto_url\}/)
  })
})
