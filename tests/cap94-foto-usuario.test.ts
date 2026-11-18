// CAP-94 · Foto del usuario en la base de datos (HU-17, CA-01 a CA-05).
// Rol: Backend y base de datos (Carlos). Teoría: refactorizar con pruebas (diap. 140) y
// encapsulación (diap. 20–24): las pruebas fijan que la foto solo la cambia su dueño.
import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let ana: string
let anaId: string
beforeEach(async () => {
  bd = await nuevaBd()
  ana = await bd.cuenta('ana@test.pe')
  anaId = (await bd.sql<{ id: string }>(`select id from capa.usuarios where correo = 'ana@test.pe'`))[0].id
})

const perfil = (token: string, extra: Record<string, unknown> = {}) =>
  bd.rpc('actualizar_perfil', { token, nombres: 'Ana', apellidos: 'Prueba', ...extra })

describe('CAP-94 Foto del usuario', () => {
  it('una cuenta nueva no tiene foto (se muestran las iniciales)', async () => {
    const { usuario } = await bd.rpc('sesion_actual', { token: ana })
    expect(usuario.foto_url).toBeNull()
  })

  it('CA-01: guarda una foto JPG, PNG o WEBP de su propia carpeta y la devuelve en la sesión', async () => {
    for (const ext of ['jpg', 'png', 'webp']) {
      const r = await perfil(ana, { foto_url: `${anaId}/perfil.${ext}` })
      expect(r.usuario.foto_url).toBe(`${anaId}/perfil.${ext}`)
    }
    const { usuario } = await bd.rpc('sesion_actual', { token: ana })
    expect(usuario.foto_url).toBe(`${anaId}/perfil.webp`)
  })

  it('CA-02: rechaza archivos que no son JPG, PNG o WEBP', async () => {
    for (const malo of [`${anaId}/perfil.gif`, `${anaId}/documento.pdf`, `${anaId}/sin-extension`]) {
      await expect(perfil(ana, { foto_url: malo })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['foto_url'] } })
    }
  })

  it('CA-03: quitar la foto (valor vacío) deja el perfil sin foto', async () => {
    await perfil(ana, { foto_url: `${anaId}/perfil.png` })
    const r = await perfil(ana, { foto_url: null })
    expect(r.usuario.foto_url).toBeNull()
  })

  it('si no se envía la foto, editar nombres no la borra', async () => {
    await perfil(ana, { foto_url: `${anaId}/perfil.png` })
    const r = await perfil(ana, { nombres: 'Ana María' })
    expect(r.usuario).toMatchObject({ nombres: 'Ana María', foto_url: `${anaId}/perfil.png` })
  })

  it('CA-05: no se puede usar una foto de la carpeta de otro usuario', async () => {
    const beto = await bd.cuenta('beto@test.pe')
    await expect(perfil(beto, { foto_url: `${anaId}/perfil.png` }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['foto_url'] } })
  })

  it('CA-05: lo que hace otro usuario en su perfil no cambia la foto de Ana', async () => {
    await perfil(ana, { foto_url: `${anaId}/perfil.png` })
    const beto = await bd.cuenta('beto@test.pe')
    const betoId = (await bd.sql<{ id: string }>(`select id from capa.usuarios where correo = 'beto@test.pe'`))[0].id
    await perfil(beto, { foto_url: `${betoId}/yo.jpg` })
    const [fila] = await bd.sql(`select foto_url from capa.usuarios where id = $1`, [anaId])
    expect(fila.foto_url).toBe(`${anaId}/perfil.png`)
  })

  it('la base rechaza una ruta mal formada aunque se escriba directo en la tabla', async () => {
    await expect(bd.sql(`update capa.usuarios set foto_url = 'http://otro.sitio/foto.png' where id = $1`, [anaId])).rejects.toThrow()
  })

  it('el organizador ve la foto de cada inscrito en la gestión del evento', async () => {
    await perfil(ana, { foto_url: `${anaId}/perfil.jpg` })
    const { token } = await bd.organizador('org@test.pe')
    const e = await bd.evento(token)
    await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    const gestion = await bd.rpc('evento_gestion', { token, id: e.id })
    expect(gestion.inscritos[0].foto_url).toBe(`${anaId}/perfil.jpg`)
  })
})
