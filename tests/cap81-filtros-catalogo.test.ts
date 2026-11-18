// CAP-81 · Filtros del catálogo y estado sin resultados (HU-15, CA-03 a CA-05). Rol: Diseño UI/UX (Medaly).
// Teoría: refactorizar con pruebas (diap. 140). La lógica de los filtros está aparte de la pantalla
// (SRP, diap. 39–49), así que se prueba sola y además contra la función SQL de CAP-80.
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  ERROR_RANGO, errorRango, fichasActivas, FILTROS_VACIOS, filtrosAUrl, filtrosDesdeUrl, paramsCatalogo, quitarFicha,
  type EstadoFiltros,
} from '../src/lib/filtrosCatalogo'
import { BarraFiltros, PanelFiltros, SinResultados } from '../src/components/FiltrosCatalogo'
import { nuevaBd, type Bd } from './bd'

const con = (extra: Partial<EstadoFiltros>): EstadoFiltros => ({ ...FILTROS_VACIOS, ...extra })
const nada = () => {}

describe('CAP-81 parámetros que se mandan a la búsqueda', () => {
  it('sin filtros solo manda incluir_pasados', () => {
    expect(paramsCatalogo(FILTROS_VACIOS)).toEqual({ incluir_pasados: false })
  })

  it('CA-03: combina tipo, modalidad, precio, ubicación y fechas, y recorta espacios', () => {
    expect(paramsCatalogo(con({
      q: '  python ', tipo: 'taller', modalidad: 'presencial', precio: 'gratis',
      ubicacion: ' Perayoc ', desde: '2026-11-20', hasta: '2026-11-30',
    }))).toEqual({
      incluir_pasados: false, q: 'python', tipo: 'taller', modalidad: 'presencial', precio: 'gratis',
      ubicacion: 'Perayoc', desde: '2026-11-20', hasta: '2026-11-30',
    })
  })

  it('un texto de solo espacios no cuenta como filtro', () => {
    expect(paramsCatalogo(con({ q: '   ', ubicacion: ' ' }))).toEqual({ incluir_pasados: false })
  })

  it('con la fecha final antes de la inicial avisa y no manda las fechas', () => {
    const f = con({ desde: '2026-11-30', hasta: '2026-11-20', tipo: 'curso' })
    expect(errorRango(f)).toBe(ERROR_RANGO)
    expect(paramsCatalogo(f)).toEqual({ incluir_pasados: false, tipo: 'curso' })
    expect(errorRango(con({ desde: '2026-11-20', hasta: '2026-11-20' }))).toBeNull()
  })
})

describe('CAP-81 fichas de los filtros activos', () => {
  it('una ficha por filtro, con texto legible', () => {
    const f = con({ q: 'ia', tipo: 'seminario', modalidad: 'virtual', precio: 'pago', desde: '2026-11-20', hasta: '2026-12-05', ubicacion: 'Cusco' })
    expect(fichasActivas(f).map((x) => x.texto)).toEqual([
      '«ia»', 'Seminario', 'Virtual', 'De pago', 'Del 20/11/2026 al 05/12/2026', 'En Cusco',
    ])
  })

  it('una sola fecha se lee como «desde» o «hasta»; «Incluir finalizados» no es ficha', () => {
    expect(fichasActivas(con({ desde: '2026-11-20', pasados: true })).map((x) => x.texto)).toEqual(['Desde el 20/11/2026'])
    expect(fichasActivas(con({ hasta: '2026-11-20' })).map((x) => x.texto)).toEqual(['Hasta el 20/11/2026'])
  })

  it('quitar una ficha borra solo ese filtro; la de fechas borra las dos', () => {
    const f = con({ tipo: 'taller', desde: '2026-11-20', hasta: '2026-11-30' })
    expect(quitarFicha(f, 'tipo')).toEqual(con({ desde: '2026-11-20', hasta: '2026-11-30' }))
    expect(quitarFicha(f, 'fechas')).toEqual(con({ tipo: 'taller' }))
  })
})

describe('CAP-81 CA-05: los filtros viven solo en la dirección de la página', () => {
  it('ida y vuelta por la dirección sin perder nada', () => {
    const f = con({ q: 'robótica', tipo: 'congreso', modalidad: 'mixta', precio: 'gratis', desde: '2026-11-20', hasta: '2026-11-30', ubicacion: 'Perayoc', pasados: true })
    const url = filtrosAUrl(f).toString()
    expect(url).toBe('q=rob%C3%B3tica&tipo=congreso&modalidad=mixta&precio=gratis&desde=2026-11-20&hasta=2026-11-30&ubicacion=Perayoc&pasados=1')
    expect(filtrosDesdeUrl(new URLSearchParams(url))).toEqual(f)
  })

  it('sin filtros la dirección queda limpia', () => {
    expect(filtrosAUrl(FILTROS_VACIOS).toString()).toBe('')
  })

  it('un enlace editado a mano con valores que no existen se ignora', () => {
    const f = filtrosDesdeUrl(new URLSearchParams('tipo=fiesta&modalidad=x&precio=caro&desde=mañana&hasta=2026-13&pasados=si'))
    expect(f).toEqual(FILTROS_VACIOS)
  })

  it('ni la pantalla ni la lógica de filtros guardan nada en el navegador', () => {
    for (const ruta of ['../src/pages/Catalogo.tsx', '../src/lib/filtrosCatalogo.ts', '../src/components/FiltrosCatalogo.tsx']) {
      const codigo = readFileSync(new URL(ruta, import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')
      expect(codigo).not.toMatch(/localStorage|sessionStorage|document\.cookie|indexedDB/)
    }
  })
})

describe('CAP-81 contra la búsqueda real (CAP-80)', () => {
  let bd: Bd
  let token: string
  beforeEach(async () => {
    bd = await nuevaBd()
    token = (await bd.organizador('org@test.pe')).token
    await bd.sql(`update capa.planes set permite_virtual = true`)
  })
  const buscar = async (f: EstadoFiltros) =>
    (await bd.rpc<any[]>('catalogo_eventos', { ...paramsCatalogo(f) })).map((e) => e.nombre).sort()

  it('CA-03: tipo + ubicación + modalidad se combinan', async () => {
    await bd.evento(token, { nombre: 'Taller en Perayoc', tipo: 'taller', lugar: 'Auditorio Perayoc' })
    await bd.evento(token, { nombre: 'Curso en Perayoc', tipo: 'curso', lugar: 'Pabellón Perayoc' })
    await bd.evento(token, { nombre: 'Taller en Ingeniería', tipo: 'taller', lugar: 'Pabellón de Ingeniería' })
    await bd.evento(token, { nombre: 'Taller virtual', tipo: 'taller', modalidad: 'virtual', lugar: null })
    expect(await buscar(con({ tipo: 'taller' }))).toEqual(['Taller en Ingeniería', 'Taller en Perayoc', 'Taller virtual'])
    expect(await buscar(con({ tipo: 'taller', ubicacion: 'perayoc' }))).toEqual(['Taller en Perayoc'])
    expect(await buscar(con({ tipo: 'taller', modalidad: 'virtual' }))).toEqual(['Taller virtual'])
  })

  it('CA-04: sin coincidencias la lista llega vacía (la pantalla muestra «No se encontraron eventos»)', async () => {
    await bd.evento(token, { nombre: 'Taller de Python', tipo: 'taller' })
    expect(await buscar(con({ q: 'python', tipo: 'congreso' }))).toEqual([])
  })

  it('un rango al revés no rompe la búsqueda: se ignora la fecha y se siguen viendo eventos', async () => {
    await bd.evento(token, { nombre: 'Evento', tipo: 'curso' })
    expect(await buscar(con({ tipo: 'curso', desde: '2030-01-10', hasta: '2030-01-01' }))).toEqual(['Evento'])
  })

  it('CA-05: un visitante sin sesión busca y no queda ninguna fila nueva en la base de datos', async () => {
    await bd.evento(token, { nombre: 'Seminario abierto', tipo: 'seminario' })
    const tablas = await bd.sql<{ t: string }>(
      `select format('%I.%I', table_schema, table_name) as t from information_schema.tables
       where table_schema = 'capa' and table_type = 'BASE TABLE' order by 1`)
    const contar = async () => {
      const n: Record<string, number> = {}
      for (const { t } of tablas) n[t] = Number((await bd.sql<{ n: number }>(`select count(*)::int as n from ${t}`))[0].n)
      return n
    }
    const antes = await contar()
    expect(await buscar(con({ q: 'seminario', tipo: 'seminario', ubicacion: 'cusco' }))).toEqual([])
    expect(await buscar(con({ q: 'seminario' }))).toEqual(['Seminario abierto'])
    expect(await contar()).toEqual(antes)
  })
})

describe('CAP-81 pantalla', () => {
  it('el panel tiene etiqueta visible en cada filtro y los cuatro tipos', () => {
    const html = renderToStaticMarkup(h(PanelFiltros, { filtros: FILTROS_VACIOS, onCambio: nada }))
    for (const t of ['Tipo', 'Precio', 'Desde', 'Hasta', 'Ubicación', 'Incluir finalizados', 'Seminario', 'Congreso', 'Taller', 'Curso']) {
      expect(html).toContain(t)
    }
    expect(html).toContain('role="search"')
  })

  it('con el rango al revés el campo «Hasta» queda marcado y dice por qué', () => {
    const html = renderToStaticMarkup(h(PanelFiltros, { filtros: con({ desde: '2026-11-30', hasta: '2026-11-20' }), onCambio: nada }))
    expect(html).toContain(ERROR_RANGO)
    expect(html).toContain('aria-invalid="true"')
  })

  it('la barra dice cuántos eventos hay y cada ficha tiene su botón para quitarla', () => {
    const html = renderToStaticMarkup(h(BarraFiltros, { filtros: con({ tipo: 'taller', precio: 'gratis' }), total: 3, onCambio: nada, onLimpiar: nada }))
    expect(html).toContain('3 eventos')
    expect(html).toContain('aria-label="Quitar filtro: Taller"')
    expect(html).toContain('aria-label="Quitar filtro: Gratis"')
    expect(html).toContain('Limpiar filtros')
  })

  it('CA-04: con filtros y sin resultados dice «No se encontraron eventos» y ofrece limpiar', () => {
    const html = renderToStaticMarkup(h(SinResultados, { hayFiltros: true, pasados: false, onLimpiar: nada, onVerFinalizados: nada }))
    expect(html).toContain('No se encontraron eventos')
    expect(html).toContain('Limpiar filtros')
    expect(html).toContain('Ver también finalizados')
    const sinFiltros = renderToStaticMarkup(h(SinResultados, { hayFiltros: false, pasados: false, onLimpiar: nada, onVerFinalizados: nada }))
    expect(sinFiltros).toContain('Todavía no hay eventos publicados')
    expect(sinFiltros).not.toContain('Limpiar filtros')
  })
})
