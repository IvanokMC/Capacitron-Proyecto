// CAP-77 · Validaciones de tipo, lugar, organizador y contacto al publicar (HU-02, CA-07).
// Rol: Frontend (José). Teoría: refactorizar con pruebas (diap. 140): estas pruebas fijan la
// regla en la API y en el formulario, y las 86 anteriores confirman que nada más cambió.
import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'
import { faltantesParaPublicar } from '../src/lib/validacionEvento'

let bd: Bd
let token: string
beforeEach(async () => {
  bd = await nuevaBd()
  token = (await bd.organizador('org@test.pe')).token
})

const sinCampos = { tipo: null, organizador_nombre: null, contacto: null }

describe('CAP-77 API: publicar exige tipo, lugar, organizador y contacto', () => {
  it('CA-07: publicar sin los campos nuevos se rechaza y nombra cada campo faltante', async () => {
    const err = await bd.evento(token, sinCampos).catch((e) => e)
    expect(err.codigo).toBe('CAMPOS')
    expect(err.detalle.campos).toEqual(['tipo', 'organizador_nombre', 'contacto'])
  })

  it('CA-07: falta solo el contacto, se resalta solo el contacto', async () => {
    const err = await bd.evento(token, { contacto: null }).catch((e) => e)
    expect(err.detalle.campos).toEqual(['contacto'])
  })

  it('CA-02 se mantiene: el borrador se guarda sin los campos nuevos', async () => {
    const e = await bd.evento(token, sinCampos, 'borrador')
    expect(e.estado).toBe('borrador')
  })

  it('publicar_evento (desde la gestión) también exige los campos', async () => {
    const e = await bd.evento(token, sinCampos, 'borrador')
    await expect(bd.rpc('publicar_evento', { token, id: e.id })).rejects.toMatchObject({ codigo: 'CAMPOS' })
  })

  it('un evento virtual no necesita lugar para publicarse', async () => {
    await bd.sql(`update capa.planes set permite_virtual = true`)
    const e = await bd.evento(token, { modalidad: 'virtual', lugar: null })
    expect(e.estado).toBe('publicado')
  })

  it('un tipo distinto de seminario, congreso, taller o curso se rechaza', async () => {
    await expect(bd.evento(token, { tipo: 'charla' })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['tipo'] } })
  })

  it('con todos los campos se publica y se guardan tal cual', async () => {
    const e = await bd.evento(token, { tipo: 'congreso', organizador_nombre: 'EPIIS UNSAAC', contacto: '984111222',
      contacto_consentimiento: true })
    expect(e.estado).toBe('publicado')
    const [fila] = await bd.sql(`select tipo, organizador_nombre, contacto, contacto_consentimiento from capa.eventos where id = $1`, [e.id])
    expect(fila).toEqual({ tipo: 'congreso', organizador_nombre: 'EPIIS UNSAAC', contacto: '984111222', contacto_consentimiento: true })
  })

  it('el organizador ve sus campos en evento_gestion y el público no ve el contacto', async () => {
    const e = await bd.evento(token, { contacto: 'privado@test.pe' })
    const gestion = await bd.rpc('evento_gestion', { token, id: e.id })
    expect(gestion).toMatchObject({ tipo: 'taller', organizador_nombre: 'Organización de prueba', contacto: 'privado@test.pe',
      contacto_consentimiento: false, faltan_para_publicar: [] })
    const publico = JSON.stringify([await bd.rpc('catalogo_eventos'), await bd.rpc('detalle_evento', { id: e.id })])
    expect(publico).toContain(e.id)
    expect(publico).not.toContain('privado@test.pe')
  })

  it('al editar un borrador, evento_gestion dice qué falta para publicar', async () => {
    const e = await bd.evento(token, sinCampos, 'borrador')
    const gestion = await bd.rpc('evento_gestion', { token, id: e.id })
    expect(gestion.faltan_para_publicar).toEqual(['tipo', 'organizador_nombre', 'contacto'])
  })
})

describe('CAP-77 formulario: regla de publicación', () => {
  const lleno = { modalidad: 'presencial', tipo: 'taller', lugar: 'Aula 1', organizador_nombre: 'EPIIS', contacto: 'a@b.pe' }

  it('con todo lleno no falta nada', () => {
    expect(faltantesParaPublicar(lleno)).toEqual({})
  })

  it('marca cada campo vacío con su mensaje (los espacios cuentan como vacío)', () => {
    const f = faltantesParaPublicar({ ...lleno, tipo: '', organizador_nombre: '   ', contacto: '' })
    expect(Object.keys(f)).toEqual(['tipo', 'organizador_nombre', 'contacto'])
    expect(f.contacto).toMatch(/correo o teléfono/)
  })

  it('el lugar solo se exige en eventos presenciales o mixtos', () => {
    expect(faltantesParaPublicar({ ...lleno, lugar: '' })).toHaveProperty('lugar')
    expect(faltantesParaPublicar({ ...lleno, modalidad: 'mixta', lugar: '' })).toHaveProperty('lugar')
    expect(faltantesParaPublicar({ ...lleno, modalidad: 'virtual', lugar: '' })).toEqual({})
  })
})
