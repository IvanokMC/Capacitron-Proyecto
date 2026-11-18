// CAP-110 · Subir el flyer y la imagen del lugar y mostrarlos (HU-20, CA-01 a CA-05). Rol: Frontend (José).
// Teoría: refactorizar con pruebas (diap. 140); DIP (diap. 92–106): la lógica recibe el almacenamiento y la
// compresión como contratos, así se prueba sin navegador; code smells (33): una sola validación de imágenes.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import { IMAGEN_INICIAL, imagenVisible, reducirImagen } from '../src/lib/imagenElegida'
import { reducirFoto } from '../src/lib/fotoPerfil'
import { altImagen, cambiosImagenes, hayCambiosImagenes, REGLAS_IMAGEN, type ImagenFormulario } from '../src/lib/imagenesEvento'
import { nuevaBd, type Bd } from './bd'
// Pantallas importadas al inicio (con la suite en paralelo, un import dinámico puede pasar el tiempo límite).
import { Catalogo } from '../src/pages/Catalogo'
import { EventoDetalle } from '../src/pages/EventoDetalle'
import EditorEvento from '../src/pages/organizador/EditorEvento'

vi.mock('../src/components/MapaLeaflet', () => ({ default: () => null }))
const sesion = vi.hoisted(() => ({ usuario: null as any, cargas: {} as Record<string, unknown> }))
vi.mock('../src/lib/app', () => ({
  useApp: () => ({ usuario: sesion.usuario, api: async () => ({}), ahora: () => new Date(), latir: () => {}, listo: true }),
  useCarga: (fn: string) => ({ datos: sesion.cargas[fn] ?? null, cargando: false, error: null, recargar: () => {} }),
}))
vi.mock('../src/components/notificaciones', () => ({ useNotas: () => ({ exito: () => {}, error: () => {} }) }))
// En el servidor de pruebas no corren los efectos: la dirección del archivo se arma al momento, como en Supabase.
vi.mock('../src/lib/almacenamiento', async (original) => ({
  ...(await original<typeof import('../src/lib/almacenamiento')>()),
  useUrlArchivo: (bucket: string, ruta: string | null | undefined) => (ruta ? `https://x.supabase.co/storage/v1/object/public/${bucket}/${ruta}` : null),
}))

const MB = 1024 * 1024
const archivo = (tipo: string, bytes: number) => new Blob([new Uint8Array(bytes)], { type: tipo })
const sinCambios = (ruta: string | null = null, alt: string | null = null): ImagenFormulario =>
  ({ estado: IMAGEN_INICIAL, alt: alt ?? '', ruta, altGuardado: alt })
const conArchivo = (a: Blob, alt = ''): ImagenFormulario =>
  ({ estado: { archivo: a, previa: 'blob:x', quitar: false, error: null }, alt, ruta: null, altGuardado: null })

describe('CAP-110 elegir el flyer y la imagen del lugar (CA-01 y CA-04)', () => {
  const flyer = reducirImagen(REGLAS_IMAGEN.flyer)
  const lugar = reducirImagen(REGLAS_IMAGEN.imagen_lugar)

  it('CA-01: un JPG, PNG o WEBP de hasta 3 MB muestra la vista previa', () => {
    for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
      const e = flyer(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo(tipo, 3 * MB), url: 'blob:previa' })
      expect(e).toMatchObject({ previa: 'blob:previa', error: null })
    }
  })

  it('CA-04: otro tipo se rechaza diciendo el motivo, con el nombre de la imagen', () => {
    expect(flyer(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo('image/gif', 10), url: '' }).error)
      .toBe('El flyer debe ser una imagen JPG, PNG o WEBP.')
    expect(lugar(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo('application/pdf', 10), url: '' }).error)
      .toBe('La imagen del lugar debe ser una imagen JPG, PNG o WEBP.')
  })

  it('CA-04: más de 3 MB se rechaza diciendo cuánto pesa (el texto de la ficha CAP-108)', () => {
    expect(flyer(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo('image/png', 4.2 * MB), url: '' }).error)
      .toBe('El flyer pesa 4,2 MB y el límite es 3 MB.')
  })

  it('un rechazo no borra el flyer que ya estaba elegido', () => {
    const elegido = flyer(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo('image/webp', 1000), url: 'blob:previa' })
    const despues = flyer(elegido, { tipo: 'elegir', archivo: archivo('image/gif', 10), url: '' })
    expect(despues.previa).toBe('blob:previa')
    expect(despues.error).toContain('El flyer debe ser')
  })

  it('«Quitar» sin vista previa marca el flyer guardado para quitarlo; con vista previa vuelve al guardado', () => {
    const quitado = flyer(IMAGEN_INICIAL, { tipo: 'quitar' })
    expect(imagenVisible(quitado, 'https://x/guardado.webp')).toBeNull()
    const elegido = flyer(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo('image/webp', 1000), url: 'blob:previa' })
    expect(imagenVisible(flyer(elegido, { tipo: 'quitar' }), 'https://x/guardado.webp')).toBe('https://x/guardado.webp')
  })

  it('code smells (diap. 33): la foto de perfil usa el mismo reductor con su límite de 2 MB', () => {
    expect(reducirFoto(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo('image/png', 2 * MB + 1), url: '' }).error)
      .toBe('La foto pesa 2,1 MB y el límite es 2 MB.')
  })
})

describe('CAP-110 qué se sube y qué se manda a guardar_imagenes_evento', () => {
  const EVENTO = '7c3e2a10-5b4d-4e6f-9a81-0c2d3e4f5a6b'

  it('CA-01: el flyer nuevo se comprime DESPUÉS de validar y se sube a la carpeta del evento', async () => {
    const original = archivo('image/jpeg', 2 * MB)
    const comprimido = archivo('image/webp', 120 * 1024)
    const comprimir = vi.fn(async () => comprimido)
    const p = await cambiosImagenes(almacenamientoLocal({ persistir: false }), EVENTO,
      { flyer: conArchivo(original, '  Afiche del taller  '), imagen_lugar: sinCambios() }, comprimir)
    expect(comprimir).toHaveBeenCalledWith(original)
    expect(p.flyer_url).toMatch(new RegExp(`^${EVENTO}/[a-z0-9-]+\\.webp$`))
    expect(p.flyer_alt).toBe('Afiche del taller')
    expect(p).not.toHaveProperty('imagen_lugar_url')
  })

  it('quitar manda la ruta en null; solo cambiar la descripción manda solo la descripción', async () => {
    const quitar: ImagenFormulario = { estado: { ...IMAGEN_INICIAL, quitar: true }, alt: '', ruta: `${EVENTO}/a.webp`, altGuardado: 'x' }
    const soloAlt = sinCambios(`${EVENTO}/b.webp`, 'Entrada')
    soloAlt.alt = 'Entrada del auditorio'
    const p = await cambiosImagenes(almacenamientoLocal({ persistir: false }), EVENTO, { flyer: quitar, imagen_lugar: soloAlt })
    expect(p).toEqual({ flyer_url: null, imagen_lugar_alt: 'Entrada del auditorio' })
  })

  it('sin cambios no se llama a la API', async () => {
    const igual = { flyer: sinCambios(`${EVENTO}/a.webp`, 'Afiche'), imagen_lugar: sinCambios() }
    expect(hayCambiosImagenes(igual)).toBe(false)
    expect(await cambiosImagenes(almacenamientoLocal({ persistir: false }), EVENTO, igual)).toEqual({})
  })
})

describe('CAP-110 de punta a punta con la base de datos (CA-01, CA-03 y CA-05)', () => {
  let bd: Bd
  let token: string
  let ev: any
  beforeEach(async () => {
    bd = await nuevaBd()
    token = (await bd.organizador('org@test.pe')).token
    ev = await bd.evento(token, { nombre: 'Taller de Python', lugar: 'Auditorio de Ingeniería' })
  })

  it('CA-01 y CA-03: lo subido se guarda y un visitante sin sesión lo recibe en el catálogo y en la página', async () => {
    const alm = almacenamientoLocal({ persistir: false })
    const p = await cambiosImagenes(alm, ev.id, {
      flyer: conArchivo(archivo('image/png', 1000), 'Afiche del taller'),
      imagen_lugar: conArchivo(archivo('image/jpeg', 1000)),
    }, async (a) => a)
    await bd.rpc('guardar_imagenes_evento', { token, id: ev.id, ...p })
    const [fila] = (await bd.rpc<any[]>('catalogo_eventos', {})).filter((e) => e.id === ev.id)
    expect(fila).toMatchObject({ flyer_url: p.flyer_url, flyer_alt: 'Afiche del taller' })
    const d = await bd.rpc<any>('detalle_evento', { id: ev.id })
    expect(d).toMatchObject({ flyer_url: p.flyer_url, imagen_lugar_url: p.imagen_lugar_url, imagen_lugar_alt: null })
    expect(await alm.url('eventos', p.flyer_url!)).toEqual(expect.any(String))
  })

  it('CA-05: otro organizador no puede poner imágenes en este evento', async () => {
    const otro = (await bd.organizador('otro@test.pe')).token
    const p = await cambiosImagenes(almacenamientoLocal({ persistir: false }), ev.id,
      { flyer: conArchivo(archivo('image/webp', 1000)), imagen_lugar: sinCambios() }, async (a) => a)
    await expect(bd.rpc('guardar_imagenes_evento', { token: otro, id: ev.id, ...p })).rejects.toThrow()
  })
})

describe('CAP-110 pantallas', () => {
  it('el texto alternativo nunca queda vacío', () => {
    expect(altImagen('  ', 'Flyer de Taller')).toBe('Flyer de Taller')
    expect(altImagen('Afiche', 'Flyer de Taller')).toBe('Afiche')
  })

  it('CA-01: en el catálogo, la fila con flyer muestra la miniatura y la fila sin flyer el bloque de fecha', async () => {
    const bd = await nuevaBd()
    const { token } = await bd.organizador('org@test.pe')
    const con = await bd.evento(token, { nombre: 'Taller de Python' })
    await bd.evento(token, { nombre: 'Seminario sin flyer' })
    await bd.rpc('guardar_imagenes_evento', { token, id: con.id, flyer_url: `${con.id}/flyer.webp`, flyer_alt: 'Afiche del taller' })
    sesion.usuario = null
    sesion.cargas = { catalogo_eventos: await bd.rpc('catalogo_eventos', {}) }
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(Catalogo)))
    expect(html).toContain(`src="https://x.supabase.co/storage/v1/object/public/eventos/${con.id}/flyer.webp" alt="Afiche del taller"`)
    expect(html.match(/<img /g)).toHaveLength(1)
    expect(html).toContain('Seminario sin flyer')
  })

  it('CA-03: en la página del evento, el visitante ve el flyer antes del botón y la imagen del lugar en la ubicación', async () => {
    const bd = await nuevaBd()
    const { token } = await bd.organizador('org@test.pe')
    const ev = await bd.evento(token, { nombre: 'Taller de Python', lugar: 'Auditorio de Ingeniería' })
    await bd.rpc('guardar_imagenes_evento', {
      token, id: ev.id, flyer_url: `${ev.id}/flyer.webp`, imagen_lugar_url: `${ev.id}/lugar.webp`, imagen_lugar_alt: 'Entrada del auditorio',
    })
    sesion.usuario = null
    sesion.cargas = { detalle_evento: await bd.rpc('detalle_evento', { id: ev.id }) } // sin token: visitante
    const html = renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/eventos/${ev.id}`] },
      h(Routes, null, h(Route, { path: '/eventos/:id', element: h(EventoDetalle) }))))
    const base = 'https://x.supabase.co/storage/v1/object/public/eventos'
    const posFlyer = html.indexOf(`src="${base}/${ev.id}/flyer.webp" alt="Flyer de Taller de Python"`)
    expect(posFlyer).toBeGreaterThan(-1)
    expect(posFlyer).toBeLessThan(html.indexOf('Ingresa para inscribirte'))
    expect(html).toContain(`src="${base}/${ev.id}/lugar.webp" alt="Entrada del auditorio"`)
  })

  it('CA-01 y CA-02: el formulario de un evento nuevo tiene el flyer y la imagen del lugar', () => {
    sesion.usuario = { nombre_completo: 'Ana', rol: 'organizador', institucion: null }
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(EditorEvento)))
    expect(html).toContain('Flyer del evento')
    expect(html).toContain('Imagen del lugar')
    expect(html.match(/accept="image\/jpeg,image\/png,image\/webp"/g)).toHaveLength(2)
    expect(html).toContain('JPG, PNG o WEBP de hasta 3 MB.')
  })
})

