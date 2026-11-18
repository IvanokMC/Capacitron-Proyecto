// CAP-104 · Latitud y longitud del evento (HU-19, CA-01, CA-04 y CA-05). Rol: Backend (Carlos).
// Teoría: refactorizar con pruebas (diap. 140) y encapsulación (diap. 20–24): las coordenadas solo entran
// validadas, y la regla «presencial o mixto lleva ubicación» es la misma al publicar y al editar.
import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let token: string
beforeEach(async () => {
  bd = await nuevaBd()
  token = (await bd.organizador('org@test.pe')).token
  await bd.sql(`update capa.planes set permite_virtual = true`)
})
const MENSAJE = 'Las coordenadas están fuera de rango. Vuelve a marcar el punto en el mapa.'
const SIN_PUNTO = { latitud: null, longitud: null }
const detalle = (id: string) => bd.rpc<any>('detalle_evento', { id })
const filaCatalogo = async (id: string) => (await bd.rpc<any[]>('catalogo_eventos', {})).find((e) => e.id === id)
async function editar(e: any, extra: Record<string, unknown>) {
  const g = await bd.rpc<any>('evento_gestion', { token, id: e.id })
  const { latitud, longitud, ...sinPunto } = g
  void latitud; void longitud
  return (await bd.rpc<any>('guardar_evento', { ...sinPunto, token, id: e.id, accion: 'guardar', ...extra })).evento
}

describe('CAP-104 CA-01: guardar el punto del lugar', () => {
  it('guarda la latitud y la longitud, redondeadas a 6 decimales, y las devuelven el detalle y el catálogo', async () => {
    const e = await bd.evento(token, { latitud: -13.52081234, longitud: '-71.958449' })
    expect(await detalle(e.id)).toMatchObject({ latitud: -13.520812, longitud: -71.958449 })
    expect(await filaCatalogo(e.id)).toMatchObject({ latitud: -13.520812, longitud: -71.958449 })
  })

  it('publicar un evento presencial o mixto sin punto se impide nombrando «ubicacion»', async () => {
    await expect(bd.evento(token, SIN_PUNTO)).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['ubicacion'] } })
    await expect(bd.evento(token, { ...SIN_PUNTO, modalidad: 'mixta' })).rejects.toMatchObject({ detalle: { campos: ['ubicacion'] } })
  })

  it('un borrador se guarda sin punto y la gestión dice que falta para publicar', async () => {
    const e = await bd.evento(token, SIN_PUNTO, 'guardar')
    expect(e.estado).toBe('borrador')
    expect((await bd.rpc<any>('evento_gestion', { token, id: e.id })).faltan_para_publicar).toEqual(['ubicacion'])
  })

  it('la regla es una sola: lugar y punto se piden juntos y en el orden del formulario', async () => {
    await expect(bd.evento(token, { ...SIN_PUNTO, tipo: null }, 'guardar').then((e) => bd.rpc('publicar_evento', { token, id: e.id })))
      .rejects.toMatchObject({ detalle: { campos: ['tipo', 'ubicacion'] } })
  })
})

describe('CAP-104 CA-04: un evento virtual no tiene punto', () => {
  it('se publica sin coordenadas y, si las mandan, se descartan', async () => {
    const e = await bd.evento(token, { modalidad: 'virtual', lugar: null, latitud: -13.5, longitud: -71.9 })
    expect(e.estado).toBe('publicado')
    expect(await detalle(e.id)).toMatchObject({ latitud: null, longitud: null })
  })

  it('al pasar un evento a virtual, se borra su punto', async () => {
    const e = await bd.evento(token, {}, 'guardar')
    const v = await editar(e, { modalidad: 'virtual', lugar: null })
    expect(v).toMatchObject({ modalidad: 'virtual', latitud: null, longitud: null })
  })
})

describe('CAP-104 CA-05: coordenadas fuera de rango o mal escritas se rechazan', () => {
  it.each([
    [{ latitud: 91, longitud: -71.9 }, ['latitud']],
    [{ latitud: -90.0001, longitud: -71.9 }, ['latitud']],
    [{ latitud: -13.5, longitud: 180.5 }, ['longitud']],
    [{ latitud: 'norte', longitud: -71.9 }, ['latitud']],
    [{ latitud: -13.5, longitud: null }, ['longitud']],
    [{ latitud: null, longitud: -71.9 }, ['latitud']],
  ])('%j se rechaza nombrando %j y no se guarda nada', async (punto, campos) => {
    const antes = (await bd.sql<{ n: number }>(`select count(*)::int as n from capa.eventos`))[0].n
    await expect(bd.evento(token, punto, 'guardar')).rejects.toMatchObject({ codigo: 'CAMPOS', message: MENSAJE, detalle: { campos } })
    expect((await bd.sql<{ n: number }>(`select count(*)::int as n from capa.eventos`))[0].n).toBe(antes)
  })

  it('los extremos válidos se aceptan', async () => {
    const e = await bd.evento(token, { latitud: 90, longitud: -180 }, 'guardar')
    expect(e).toMatchObject({ latitud: 90, longitud: -180 })
  })

  it('la tabla también lo impide si alguien escribe directo', async () => {
    const e = await bd.evento(token)
    await expect(bd.sql(`update capa.eventos set latitud = 100 where id = $1`, [e.id])).rejects.toThrow()
    await expect(bd.sql(`update capa.eventos set longitud = null where id = $1`, [e.id])).rejects.toThrow()
  })
})

describe('CAP-104 editar un evento publicado', () => {
  it('si la llamada no trae coordenadas, se conservan', async () => {
    const e = await bd.evento(token)
    await editar(e, { nombre: 'Taller con nombre nuevo' })
    expect(await detalle(e.id)).toMatchObject({ nombre: 'Taller con nombre nuevo', latitud: -13.5208, longitud: -71.9584 })
  })

  it('mover el punto se guarda', async () => {
    const e = await bd.evento(token)
    await editar(e, { latitud: -13.5167, longitud: -71.9789 })
    expect(await detalle(e.id)).toMatchObject({ latitud: -13.5167, longitud: -71.9789 })
  })

  it('borrar el punto de un evento publicado se impide y el punto queda', async () => {
    const e = await bd.evento(token)
    await expect(editar(e, SIN_PUNTO)).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['ubicacion'] } })
    expect(await detalle(e.id)).toMatchObject({ latitud: -13.5208, longitud: -71.9584 })
  })

  it('un evento publicado antes de la HU-19 (sin punto) se puede seguir editando sin marcarlo', async () => {
    const e = await bd.evento(token)
    await bd.sql(`update capa.eventos set latitud = null, longitud = null where id = $1`, [e.id])
    const editado = await editar(e, { nombre: 'Evento antiguo corregido' })
    expect(editado).toMatchObject({ nombre: 'Evento antiguo corregido', estado: 'publicado', latitud: null })
  })

  it('pero si a ese evento antiguo le borran el contacto, se sigue impidiendo (D-01)', async () => {
    const e = await bd.evento(token)
    await bd.sql(`update capa.eventos set latitud = null, longitud = null where id = $1`, [e.id])
    await expect(editar(e, { contacto: null })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['ubicacion', 'contacto'] } })
  })
})
