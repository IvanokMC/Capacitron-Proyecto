// CAP-80 · Búsqueda y filtros del catálogo por tema, tipo, fechas y ubicación (HU-15, CA-01 a CA-03 y CA-05).
// Rol: Backend (Carlos). Teoría: refactorizar con pruebas (diap. 140): estas pruebas fijan cada filtro
// y la última confirma que las llamadas que ya usaba el catálogo devuelven lo mismo (OCP, diap. 50–63).
import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let token: string
beforeEach(async () => {
  bd = await nuevaBd()
  token = (await bd.organizador('org@test.pe')).token
  await bd.sql(`update capa.planes set permite_virtual = true`)
})

const buscar = async (p: Record<string, unknown> = {}) =>
  (await bd.rpc<any[]>('catalogo_eventos', p)).map((e) => e.nombre).sort()

/** Fecha AAAA-MM-DD en Lima (UTC−5) de un evento creado con `inicioH` horas desde ahora. */
async function diaLima(inicioH: number) {
  const base = await bd.ahora()
  return new Date(base.getTime() + inicioH * 3600_000 - 5 * 3600_000).toISOString().slice(0, 10)
}

describe('CAP-80 CA-01: buscar por tema', () => {
  it('encuentra el tema en el nombre o en la descripción, sin importar mayúsculas', async () => {
    await bd.evento(token, { nombre: 'Taller de Python', descripcion: 'Introducción' })
    await bd.evento(token, { nombre: 'Curso de datos', descripcion: 'Análisis con PYTHON y pandas', tipo: 'curso' })
    await bd.evento(token, { nombre: 'Seminario de ética', tipo: 'seminario' })
    expect(await buscar({ q: 'python' })).toEqual(['Curso de datos', 'Taller de Python'])
  })

  it('también busca en el nombre público del organizador', async () => {
    await bd.evento(token, { nombre: 'Evento A', organizador_nombre: 'Círculo de Robótica EPIIS' })
    await bd.evento(token, { nombre: 'Evento B' })
    expect(await buscar({ q: 'robótica' })).toEqual(['Evento A'])
  })

  it('un % o _ escrito por la persona se busca como texto y no como comodín', async () => {
    await bd.evento(token, { nombre: 'Descuento del 50% para estudiantes' })
    await bd.evento(token, { nombre: 'Evento sin porcentaje' })
    expect(await buscar({ q: '50%' })).toEqual(['Descuento del 50% para estudiantes'])
    expect(await buscar({ q: '%' })).toEqual(['Descuento del 50% para estudiantes'])
    expect(await buscar({ q: '_' })).toEqual([])
  })
})

describe('CAP-80 CA-02: rango de fechas', () => {
  it('solo lista los eventos que inician dentro del rango, con ambos días incluidos', async () => {
    await bd.evento(token, { nombre: 'En 3 días', inicioH: 72 })
    await bd.evento(token, { nombre: 'En 10 días', inicioH: 240 })
    await bd.evento(token, { nombre: 'En 20 días', inicioH: 480 })
    const d3 = await diaLima(72)
    const d10 = await diaLima(240)
    expect(await buscar({ desde: d3, hasta: d10 })).toEqual(['En 10 días', 'En 3 días'])
    expect(await buscar({ desde: d10 })).toEqual(['En 10 días', 'En 20 días'])
    expect(await buscar({ hasta: d3 })).toEqual(['En 3 días'])
  })

  it('un día sin eventos devuelve la lista vacía', async () => {
    await bd.evento(token, { nombre: 'En 3 días', inicioH: 72 })
    const d10 = await diaLima(240)
    expect(await buscar({ desde: d10, hasta: d10 })).toEqual([])
  })

  it('una fecha final anterior a la inicial se rechaza nombrando «hasta»', async () => {
    await expect(bd.rpc('catalogo_eventos', { desde: '2026-12-10', hasta: '2026-12-01' }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['hasta'] } })
  })

  it('una fecha mal escrita se rechaza nombrando el campo', async () => {
    await expect(bd.rpc('catalogo_eventos', { desde: '31/12/2026' }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['desde'] } })
  })
})

describe('CAP-80 CA-03: tipo, ubicación y «Virtual», combinados', () => {
  beforeEach(async () => {
    await bd.evento(token, { nombre: 'Taller en Perayoc', tipo: 'taller', lugar: 'Ciudad Universitaria de Perayoc' })
    await bd.evento(token, { nombre: 'Curso en Perayoc', tipo: 'curso', lugar: 'Pabellón de Ingeniería, Perayoc' })
    await bd.evento(token, { nombre: 'Taller en Wanchaq', tipo: 'taller', lugar: 'Auditorio de Wanchaq' })
    await bd.evento(token, { nombre: 'Congreso virtual', tipo: 'congreso', modalidad: 'virtual', lugar: null })
  })

  it('filtra por tipo', async () => {
    expect(await buscar({ tipo: 'taller' })).toEqual(['Taller en Perayoc', 'Taller en Wanchaq'])
  })

  it('filtra por ubicación (parte del lugar)', async () => {
    expect(await buscar({ ubicacion: 'perayoc' })).toEqual(['Curso en Perayoc', 'Taller en Perayoc'])
  })

  it('«Virtual» es la modalidad virtual', async () => {
    expect(await buscar({ modalidad: 'virtual' })).toEqual(['Congreso virtual'])
  })

  it('los filtros se combinan', async () => {
    expect(await buscar({ tipo: 'taller', ubicacion: 'perayoc' })).toEqual(['Taller en Perayoc'])
    expect(await buscar({ tipo: 'curso', ubicacion: 'wanchaq' })).toEqual([])
  })

  it('un tipo que no existe se rechaza', async () => {
    await expect(bd.rpc('catalogo_eventos', { tipo: 'charla' }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['tipo'] } })
  })
})

describe('CAP-80 reglas de la HU-15', () => {
  it('solo busca eventos publicados', async () => {
    await bd.evento(token, { nombre: 'Taller publicado' })
    await bd.evento(token, { nombre: 'Taller en borrador' }, 'borrador')
    expect(await buscar({ q: 'taller' })).toEqual(['Taller publicado'])
  })

  it('CA-05: funciona sin sesión y no guarda nada del visitante', async () => {
    await bd.evento(token, { nombre: 'Taller abierto' })
    const contar = async () => (await bd.sql(`select (select count(*) from capa.sesiones) + (select count(*) from capa.auditoria)
      + (select count(*) from capa.correos) as n`))[0].n
    const antes = await contar()
    expect(await buscar({ q: 'taller', tipo: 'taller' })).toEqual(['Taller abierto'])
    expect(await contar()).toBe(antes)
  })

  it('sin filtros nuevos, el catálogo devuelve lo mismo que antes', async () => {
    await bd.evento(token, { nombre: 'Gratis', costo: 0 })
    await bd.evento(token, { nombre: 'De pago', costo: 20 })
    expect(await buscar()).toEqual(['De pago', 'Gratis'])
    expect(await buscar({ precio: 'gratis' })).toEqual(['Gratis'])
    expect(await buscar({ q: '', tipo: '', desde: '', ubicacion: '  ' })).toEqual(['De pago', 'Gratis'])
  })

  it('usa el índice nuevo por tipo y fecha', async () => {
    const [i] = await bd.sql(`select indexdef from pg_indexes where indexname = 'eventos_publicados_tipo_fecha_idx'`)
    expect(i.indexdef).toContain('(tipo, fecha_inicio)')
  })
})
