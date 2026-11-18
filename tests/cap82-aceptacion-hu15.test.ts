// CAP-82 · Pruebas de aceptación de la HU-15 «Búsqueda y filtro de eventos» (CA-01 a CA-05).
// Rol: QA (Andree). Plan, matriz y hallazgos en docs/pruebas/HU-15/PLAN_DE_PRUEBAS.md.
//
// Estas pruebas miran la historia como la usa una persona: arman los filtros con la misma función que la
// pantalla (paramsCatalogo, CAP-81) y consultan la búsqueda real (catalogo_eventos, CAP-80) sobre un
// catálogo de prueba con casos de borde. Cada `it` se lee «Dado… cuando… entonces…».
// Teoría: refactorizar con pruebas (diap. 140): si alguien cambia la búsqueda o el panel, estas pruebas
// dicen qué criterio se rompió. No repiten las pruebas unitarias de CAP-80 y CAP-81; las combinan.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it } from 'vitest'
import { fichasActivas, FILTROS_VACIOS, paramsCatalogo, type EstadoFiltros } from '../src/lib/filtrosCatalogo'
import { SinResultados } from '../src/components/FiltrosCatalogo'
import { nuevaBd, type Bd } from './bd'

const con = (extra: Partial<EstadoFiltros>): EstadoFiltros => ({ ...FILTROS_VACIOS, ...extra })

// Catálogo de prueba. D = un día de Lima dentro de 10 días; los horarios están en hora de Lima (UTC−5).
const ROBOTICA = 'Taller de Robótica educativa'
const IA = 'Seminario de Inteligencia Artificial'
const PYTHON = 'Curso virtual de Python'
const CONGRESO = 'Congreso de Ingeniería de Software'
const INICIADO = 'Taller de robótica de diez días'
/** Ordena igual que `buscar` (por código de carácter), para comparar listas. */
const orden = (...n: string[]) => [...n].sort()
const PUBLICADOS = orden(CONGRESO, PYTHON, IA, INICIADO, ROBOTICA)

let bd: Bd
let D: string
let D1: string
let D5: string

/** Día AAAA-MM-DD de Lima, `n` días después de hoy (reloj de negocio). */
function diaLima(base: Date, n: number) {
  return new Date(base.getTime() - 5 * 3600_000 + n * 86_400_000).toISOString().slice(0, 10)
}
const lima = (dia: string, hora: string) => `${dia}T${hora}:00-05:00`

beforeAll(async () => {
  bd = await nuevaBd()
  const { token, institucion } = await bd.organizador('org@test.pe')
  await bd.sql(`update capa.planes set permite_virtual = true`)
  await bd.sql(`update capa.instituciones set nombre = 'Instituto Kallpa de Formación Continua' where id = $1`, [institucion])
  const base = await bd.ahora()
  D = diaLima(base, 10)
  D1 = diaLima(base, 11)
  D5 = diaLima(base, 5)
  const D2 = diaLima(base, 2)
  const D12 = diaLima(base, 12)

  await bd.evento(token, {
    nombre: ROBOTICA, descripcion: 'Arduino y sensores para docentes de secundaria.', tipo: 'taller',
    modalidad: 'presencial', lugar: 'Laboratorio de Robótica, Pabellón Perayoc', costo: 0,
    fecha_inicio: lima(D, '09:00'), fecha_fin: lima(D, '13:00'),
  })
  await bd.evento(token, {
    nombre: IA, descripcion: 'Aplicaciones en la educación universitaria.', tipo: 'seminario',
    modalidad: 'mixta', lugar: 'Auditorio Perayoc', costo: 20,
    fecha_inicio: lima(D5, '15:00'), fecha_fin: lima(D5, '19:00'),
  })
  // Borde del día: empieza a las 23:30 de D (hora de Lima), que en UTC ya es el día siguiente.
  await bd.evento(token, {
    nombre: PYTHON, descripcion: 'Programación desde cero.', tipo: 'curso',
    modalidad: 'virtual', lugar: null, costo: 50,
    fecha_inicio: lima(D, '23:30'), fecha_fin: lima(D1, '01:30'),
  })
  // Borde del día: empieza a las 00:30 de D+1.
  await bd.evento(token, {
    nombre: CONGRESO, descripcion: 'Ponencias y talleres.', tipo: 'congreso',
    modalidad: 'presencial', lugar: 'Centro de Convenciones, Cusco', costo: 0,
    fecha_inicio: lima(D1, '00:30'), fecha_fin: lima(D1, '18:00'),
  })
  // Empieza antes del rango de D5 y sigue durante él.
  await bd.evento(token, {
    nombre: INICIADO, descripcion: 'Robótica con Lego.', tipo: 'taller',
    modalidad: 'presencial', lugar: 'Aula 204, Pabellón de Educación', costo: 0,
    fecha_inicio: lima(D2, '08:00'), fecha_fin: lima(D12, '12:00'),
  })
  // Coinciden con todo, pero no están publicados.
  await bd.evento(token, { nombre: 'Taller de robótica en borrador', tipo: 'taller', lugar: 'Pabellón Perayoc',
    fecha_inicio: lima(D, '10:00'), fecha_fin: lima(D, '12:00') }, 'guardar')
  const cancelado = await bd.evento(token, { nombre: 'Taller de robótica cancelado', tipo: 'taller', lugar: 'Pabellón Perayoc',
    fecha_inicio: lima(D, '10:00'), fecha_fin: lima(D, '12:00') })
  await bd.rpc('cancelar_evento', { token, id: cancelado.id, motivo: 'Falta de ponente' })
})

/** Lo mismo que hace la pantalla: filtros del panel → parámetros → catalogo_eventos. */
const buscar = async (f: EstadoFiltros, extra: Record<string, unknown> = {}) =>
  (await bd.rpc<any[]>('catalogo_eventos', { ...paramsCatalogo(f), ...extra })).map((e) => e.nombre).sort()

describe('HU-15 CA-01: buscar por tema', () => {
  it('dado el tema «robótica», cuando busco, entonces solo salen los eventos publicados que lo tienen en el nombre', async () => {
    expect(await buscar(con({ q: 'robótica' }))).toEqual(orden(INICIADO, ROBOTICA))
  })

  it('dado un tema que está solo en la descripción, cuando busco, entonces también aparece', async () => {
    expect(await buscar(con({ q: 'arduino' }))).toEqual(orden(ROBOTICA))
  })

  it('dado el tema en mayúsculas o con espacios alrededor, cuando busco, entonces el resultado es el mismo', async () => {
    expect(await buscar(con({ q: '  ROBÓTICA ' }))).toEqual(orden(INICIADO, ROBOTICA))
  })

  it('dado el nombre de la institución organizadora, cuando busco, entonces salen sus eventos', async () => {
    expect(await buscar(con({ q: 'kallpa' }))).toEqual(PUBLICADOS)
  })

  // H-01 (ver el plan de pruebas): hoy la búsqueda distingue tildes. Queda como mejora para el backlog.
  it.todo('dado «robotica» sin tilde, cuando busco, entonces debería encontrar «Robótica» (H-01)')
})

describe('HU-15 CA-02: rango de fechas', () => {
  it('dado un rango de un solo día, cuando filtro, entonces entran los eventos que inician ese día en hora de Lima, también a las 23:30', async () => {
    expect(await buscar(con({ desde: D, hasta: D }))).toEqual(orden(PYTHON, ROBOTICA))
  })

  it('dado el día siguiente, cuando filtro, entonces entra el que inicia a las 00:30 y no los del día anterior', async () => {
    expect(await buscar(con({ desde: D1, hasta: D1 }))).toEqual(orden(CONGRESO))
  })

  it('dado un rango, cuando un evento empezó antes y sigue durante el rango, entonces no aparece (solo cuenta el inicio)', async () => {
    expect(await buscar(con({ desde: D5, hasta: D5 }))).toEqual(orden(IA))
  })

  it('dado solo «desde» o solo «hasta», cuando filtro, entonces el rango queda abierto del otro lado', async () => {
    expect(await buscar(con({ desde: D1 }))).toEqual(orden(CONGRESO))
    expect(await buscar(con({ hasta: D5 }))).toEqual(orden(IA, INICIADO))
  })

  it('dado un rango al revés, cuando filtro, entonces la pantalla no manda las fechas y la búsqueda no falla', async () => {
    expect(await buscar(con({ desde: D1, hasta: D }))).toEqual(PUBLICADOS)
  })
})

describe('HU-15 CA-03: tipo, ubicación y «Virtual», combinados', () => {
  it('dado el tipo taller, cuando filtro, entonces solo salen talleres', async () => {
    expect(await buscar(con({ tipo: 'taller' }))).toEqual(orden(INICIADO, ROBOTICA))
  })

  it('dada una ubicación escrita en minúsculas, cuando filtro, entonces salen los eventos de ese lugar', async () => {
    expect(await buscar(con({ ubicacion: 'perayoc' }))).toEqual(orden(IA, ROBOTICA))
  })

  it('dado «Virtual», cuando filtro, entonces solo salen los eventos virtuales', async () => {
    expect(await buscar(con({ modalidad: 'virtual' }))).toEqual(orden(PYTHON))
  })

  it('dados tema, tipo, ubicación, precio y fechas a la vez, cuando filtro, entonces se cumplen todos', async () => {
    const f = con({ q: 'robótica', tipo: 'taller', ubicacion: 'Perayoc', precio: 'gratis', desde: D, hasta: D })
    expect(await buscar(f)).toEqual(orden(ROBOTICA))
    expect(fichasActivas(f)).toHaveLength(5)
  })

  it('dados filtros que se contradicen (virtual en Perayoc), cuando filtro, entonces no sale nada', async () => {
    expect(await buscar(con({ modalidad: 'virtual', ubicacion: 'Perayoc' }))).toEqual([])
  })
})

describe('HU-15 CA-04: sin coincidencias', () => {
  it('dada una búsqueda sin coincidencias, cuando se aplica, entonces se muestra «No se encontraron eventos» y la opción de limpiar', async () => {
    const f = con({ q: 'astronomía', tipo: 'congreso' })
    expect(await buscar(f)).toEqual([])
    const html = renderToStaticMarkup(h(SinResultados, {
      hayFiltros: fichasActivas(f).length > 0, pasados: f.pasados, onLimpiar: () => {}, onVerFinalizados: () => {},
    }))
    expect(html).toContain('No se encontraron eventos')
    expect(html).toContain('Limpiar filtros')
  })

  it('dado el estado vacío, cuando pulso «Limpiar filtros», entonces vuelven todos los eventos publicados', async () => {
    expect(await buscar(FILTROS_VACIOS)).toEqual(PUBLICADOS)
  })
})

describe('HU-15 CA-05: visitante sin sesión (ético, AG-C01.2)', () => {
  const contarTodo = async () => {
    const tablas = await bd.sql<{ t: string }>(
      `select format('%I.%I', table_schema, table_name) as t from information_schema.tables
       where table_schema = 'capa' and table_type = 'BASE TABLE' order by 1`)
    const n: Record<string, number> = {}
    for (const { t } of tablas) n[t] = (await bd.sql<{ n: number }>(`select count(*)::int as n from ${t}`))[0].n
    return n
  }

  it('dado un visitante sin sesión, cuando busca varias veces, entonces la búsqueda funciona y ninguna tabla cambia', async () => {
    const antes = await contarTodo()
    expect(await buscar(con({ q: 'robótica', tipo: 'taller', ubicacion: 'Perayoc' }))).toEqual(orden(ROBOTICA))
    expect(await buscar(con({ modalidad: 'virtual', desde: D, hasta: D }))).toEqual(orden(PYTHON))
    expect(await buscar(con({ q: 'astronomía' }))).toEqual([])
    expect(await contarTodo()).toEqual(antes)
  })

  it('dado un token inventado, cuando busca, entonces se ignora: no da error ni cambia el resultado', async () => {
    expect(await buscar(con({ tipo: 'taller' }), { token: 'token-inventado' })).toEqual(orden(INICIADO, ROBOTICA))
  })

  it('dados los filtros del panel, cuando se arma la consulta, entonces solo viajan filtros y ningún dato de la persona', () => {
    const permitidos = ['q', 'tipo', 'modalidad', 'precio', 'desde', 'hasta', 'ubicacion', 'incluir_pasados']
    const p = paramsCatalogo(con({ q: 'ia', tipo: 'seminario', modalidad: 'mixta', precio: 'pago', desde: D, hasta: D1, ubicacion: 'Cusco', pasados: true }))
    expect(Object.keys(p).every((k) => permitidos.includes(k))).toBe(true)
  })

  it('dado el resultado público, cuando lo recibe el visitante, entonces no trae datos de las personas inscritas', async () => {
    const r = await bd.rpc<any[]>('catalogo_eventos', { ...paramsCatalogo(FILTROS_VACIOS) })
    for (const e of r) {
      for (const clave of ['inscritos', 'correo', 'celular', 'password', 'token']) expect(e).not.toHaveProperty(clave)
    }
  })
})

describe('HU-15 regla de negocio: solo eventos publicados', () => {
  it('dado un borrador y un evento cancelado que cumplen todos los filtros, cuando busco, entonces no aparecen', async () => {
    const nombres = await buscar(con({ q: 'robótica', tipo: 'taller', ubicacion: 'Perayoc', desde: D, hasta: D }))
    expect(nombres).toEqual(orden(ROBOTICA))
    expect(nombres.join()).not.toMatch(/borrador|cancelado/)
  })
})
