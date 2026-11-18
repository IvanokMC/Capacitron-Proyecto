// CAP-111 · Pruebas de aceptación de la HU-20 «Flyer e imagen del lugar del evento» (CA-01 a CA-05).
// Rol: QA (Andree). Plan, matriz y hallazgos en docs/pruebas/HU-20/PLAN_DE_PRUEBAS.md.
//
// Recorren la historia con las piezas reales:
// 1. la organizadora elige la imagen (reglas de CAP-110 y del módulo de almacenamiento de CAP-112);
// 2. se sube al almacenamiento local, la misma interfaz que Supabase;
// 3. se guarda la ruta con guardar_imagenes_evento (CAP-109);
// 4. un visitante sin sesión abre el catálogo y la página del evento (pantallas de CAP-110 con el diseño de CAP-108).
//
// La subida real a Supabase Storage y el celular se prueban a mano (casos M-xx).
// Teoría: refactorizar con pruebas (diap. 140) y mantenibilidad (diap. 137): cada criterio queda cubierto por una
// prueba que falla si alguien rompe la historia.
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { REGLAS, subirArchivo } from '../src/lib/almacenamiento/contrato'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import { IMAGEN_INICIAL, reducirImagen } from '../src/lib/imagenElegida'
import { cambiosImagenes, REGLAS_IMAGEN, type ImagenFormulario } from '../src/lib/imagenesEvento'
import { nuevaBd, type Bd } from './bd'
// Pantallas importadas al inicio (con la suite en paralelo, un import dinámico puede pasar el tiempo límite).
import { Catalogo } from '../src/pages/Catalogo'
import { EventoDetalle } from '../src/pages/EventoDetalle'

// Leaflet necesita un navegador: el adaptador se reemplaza por una marca para comprobar dónde va el mapa.
vi.mock('../src/components/MapaLeaflet', async () => {
  const { createElement } = await import('react')
  return { default: () => createElement('div', { 'data-prueba': 'mapa' }) }
})
// Visitante sin sesión: las pantallas reciben lo que devuelve la base de datos real de la prueba.
const pantalla = vi.hoisted(() => ({ cargas: {} as Record<string, unknown> }))
vi.mock('../src/lib/app', () => ({
  useApp: () => ({ usuario: null, api: async () => ({}), ahora: () => new Date(), latir: () => {}, listo: true }),
  useCarga: (fn: string) => ({ datos: pantalla.cargas[fn] ?? null, cargando: false, error: null, recargar: () => {} }),
}))
vi.mock('../src/components/notificaciones', () => ({ useNotas: () => ({ exito: () => {}, error: () => {} }) }))
// La dirección pública se arma como en Supabase (bucket público «eventos», CAP-112).
const PUBLICA = 'https://x.supabase.co/storage/v1/object/public'
vi.mock('../src/lib/almacenamiento', async (original) => ({
  ...(await original<typeof import('../src/lib/almacenamiento')>()),
  useUrlArchivo: (bucket: string, ruta: string | null | undefined) => (ruta ? `${PUBLICA}/${bucket}/${ruta}` : null),
}))

const MB = 1024 * 1024
const archivo = (tipo: string, bytes: number) => new Blob([new Uint8Array(bytes)], { type: tipo })
const sinCambio: ImagenFormulario = { estado: IMAGEN_INICIAL, alt: '', ruta: null, altGuardado: null }
const elegida = (a: Blob, alt = ''): ImagenFormulario => ({ estado: { archivo: a, previa: 'blob:x', quitar: false, error: null }, alt, ruta: null, altGuardado: null })
const sinComprimir = async (a: Blob) => a // la compresión (canvas) necesita un navegador; se mide en CAP-112

let bd: Bd
let carmen: string
let ev: any
beforeEach(async () => {
  bd = await nuevaBd()
  carmen = (await bd.organizador('carmen@unsaac.test')).token
  ev = await bd.evento(carmen, { nombre: 'Taller de Python', lugar: 'Auditorio de Ingeniería' })
})

/** Lo que hace el formulario al guardar (EditorEvento, CAP-110): subir y guardar las rutas. */
async function guardarImagenes(token: string, flyer: ImagenFormulario, lugar: ImagenFormulario = sinCambio) {
  const p = await cambiosImagenes(almacenamientoLocal({ persistir: false }), ev.id, { flyer, imagen_lugar: lugar }, sinComprimir)
  return bd.rpc<any>('guardar_imagenes_evento', { token, id: ev.id, ...p })
}
function paginaDelVisitante(d: any) {
  pantalla.cargas = { detalle_evento: d }
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/eventos/${d.id}`] },
    h(Routes, null, h(Route, { path: '/eventos/:id', element: h(EventoDetalle) }))))
}
function catalogoDelVisitante(filas: unknown) {
  pantalla.cargas = { catalogo_eventos: filas }
  return renderToStaticMarkup(h(MemoryRouter, null, h(Catalogo)))
}

describe('HU-20 CA-01: el flyer se guarda y se ve en el catálogo y en la página del evento', () => {
  it('dado que la organizadora sube un flyer PNG con descripción, cuando guarda, entonces se ve en la fila del catálogo y en la página', async () => {
    const r = await guardarImagenes(carmen, elegida(archivo('image/png', 800 * 1024), 'Afiche del taller'))
    const ruta = r.evento.flyer_url
    expect(ruta).toMatch(new RegExp(`^${ev.id}/[a-z0-9-]+\\.png$`))
    const html = catalogoDelVisitante(await bd.rpc('catalogo_eventos', {}))
    expect(html).toContain(`src="${PUBLICA}/eventos/${ruta}" alt="Afiche del taller"`)
    expect(paginaDelVisitante(await bd.rpc('detalle_evento', { id: ev.id }))).toContain('Ver flyer completo')
  })

  it.each([['image/jpeg'], ['image/png'], ['image/webp']])('dado un flyer %s de exactamente 3 MB, entonces se acepta', async (tipo) => {
    const e = reducirImagen(REGLAS_IMAGEN.flyer)(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo(tipo, 3 * MB), url: 'blob:x' })
    expect(e.error).toBeNull()
    expect((await guardarImagenes(carmen, elegida(archivo(tipo, 3 * MB)))).evento.flyer_url).toBeTruthy()
  })

  it('dado que cambia el flyer, entonces se ve el nuevo y el anterior no se reemplaza en el almacenamiento', async () => {
    const primera = (await guardarImagenes(carmen, elegida(archivo('image/png', 1000)))).evento.flyer_url
    const segunda = (await guardarImagenes(carmen, elegida(archivo('image/webp', 1000)))).evento.flyer_url
    expect(segunda).not.toBe(primera)
    expect((await bd.rpc<any>('detalle_evento', { id: ev.id })).flyer_url).toBe(segunda)
  })
})

describe('HU-20 CA-02: la imagen del lugar se ve junto al mapa, si existe', () => {
  it('dado un evento con punto e imagen del lugar, cuando el visitante abre la página, entonces ve el mapa y la imagen en el bloque de ubicación', async () => {
    await guardarImagenes(carmen, sinCambio, elegida(archivo('image/jpeg', 1000), 'Entrada del auditorio'))
    const html = paginaDelVisitante(await bd.rpc('detalle_evento', { id: ev.id }))
    // Orden dentro del bloque «Ubicación»: el mapa, debajo la imagen del lugar y después «Cómo llegar».
    const bloque = html.slice(html.indexOf('>Ubicación</h2>'))
    // El mapa se carga aparte (lazy): según el orden de las pruebas se ve la marca o «Cargando mapa…».
    const mapa = Math.max(bloque.indexOf('data-prueba="mapa"'), bloque.indexOf('Cargando mapa…'))
    const imagen = bloque.indexOf('alt="Entrada del auditorio"')
    expect(mapa).toBeGreaterThan(-1)
    expect(imagen).toBeGreaterThan(mapa)
    expect(bloque.indexOf('Cómo llegar')).toBeGreaterThan(imagen)
  })

  it('dado un evento sin punto en el mapa, entonces la imagen del lugar se ve sola, con la dirección', async () => {
    await guardarImagenes(carmen, sinCambio, elegida(archivo('image/jpeg', 1000), 'Entrada del auditorio'))
    await bd.sql(`update capa.eventos set latitud = null, longitud = null where id = $1`, [ev.id])
    const html = paginaDelVisitante(await bd.rpc('detalle_evento', { id: ev.id }))
    expect(html).toContain('alt="Entrada del auditorio"')
    expect(html).toContain('El organizador todavía no marcó el lugar en el mapa.')
  })
})

describe('HU-20 CA-03: un visitante sin sesión ve el flyer y la imagen antes del botón de inscripción', () => {
  it('dado un visitante sin sesión, cuando abre la página, entonces el flyer está antes de «Ingresa para inscribirte»', async () => {
    await guardarImagenes(carmen, elegida(archivo('image/webp', 1000), 'Afiche del taller'))
    const d = await bd.rpc<any>('detalle_evento', { id: ev.id }) // sin token
    const html = paginaDelVisitante(d)
    const flyer = html.indexOf(`src="${PUBLICA}/eventos/${d.flyer_url}"`)
    expect(flyer).toBeGreaterThan(-1)
    expect(flyer).toBeLessThan(html.indexOf('Ingresa para inscribirte'))
  })

  it('el bucket «eventos» es de lectura pública en Supabase (CAP-112)', () => {
    const sql = readFileSync(new URL('../supabase/migrations/20261121000002_bucket_eventos.sql', import.meta.url), 'utf8')
    expect(sql).toContain("values ('eventos', 'eventos', true,")
    expect(sql).toContain('for select to anon, authenticated using (bucket_id = \'eventos\')')
  })
})

describe('HU-20 CA-04: los archivos de otro tipo o más pesados se rechazan indicando el motivo', () => {
  const flyer = reducirImagen(REGLAS_IMAGEN.flyer)

  it('dado un GIF o un PDF, cuando lo elige, entonces ve «El flyer debe ser una imagen JPG, PNG o WEBP.»', () => {
    for (const tipo of ['image/gif', 'application/pdf', 'image/svg+xml']) {
      expect(flyer(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo(tipo, 1000), url: '' }).error).toBe('El flyer debe ser una imagen JPG, PNG o WEBP.')
    }
  })

  it('dado un archivo de 3 MB y 1 byte, entonces ve cuánto pesa y el límite, y no se pierde lo que ya había elegido', () => {
    const antes = flyer(IMAGEN_INICIAL, { tipo: 'elegir', archivo: archivo('image/png', 1000), url: 'blob:antes' })
    const despues = flyer(antes, { tipo: 'elegir', archivo: archivo('image/png', 3 * MB + 1), url: '' })
    expect(despues.error).toBe('El flyer pesa 3,1 MB y el límite es 3 MB.')
    expect(despues.previa).toBe('blob:antes')
  })

  it('aunque alguien saltara la pantalla, el módulo de almacenamiento y la base de datos también lo rechazan', async () => {
    await expect(subirArchivo(almacenamientoLocal({ persistir: false }), 'eventos', ev.id, archivo('image/gif', 1000)))
      .rejects.toMatchObject({ codigo: 'ARCHIVO' })
    await expect(bd.rpc('guardar_imagenes_evento', { token: carmen, id: ev.id, flyer_url: `${ev.id}/flyer.gif` }))
      .rejects.toMatchObject({ message: 'Usa una imagen JPG, PNG o WEBP subida para este evento.' })
    expect(REGLAS.eventos.maxBytes).toBe(3 * MB)
  })
})

describe('HU-20 CA-05: solo el organizador del evento sube, cambia o quita sus imágenes', () => {
  it('dado otro organizador, cuando intenta poner un flyer en este evento, entonces se rechaza y no cambia nada', async () => {
    const otro = (await bd.organizador('otro@unsaac.test')).token
    await expect(guardarImagenes(otro, elegida(archivo('image/png', 1000)))).rejects.toThrow()
    expect((await bd.rpc<any>('detalle_evento', { id: ev.id })).flyer_url).toBeNull()
  })

  it('dado un asistente o un visitante sin sesión, entonces tampoco puede', async () => {
    const ana = await bd.cuenta('ana@unsaac.test')
    await expect(guardarImagenes(ana, elegida(archivo('image/png', 1000)))).rejects.toThrow()
    await expect(bd.rpc('guardar_imagenes_evento', { id: ev.id, flyer_url: null })).rejects.toThrow()
  })

  it('dado que el organizador quita el flyer, entonces desaparece con su descripción y la fila vuelve al bloque de fecha', async () => {
    await guardarImagenes(carmen, elegida(archivo('image/png', 1000), 'Afiche del taller'))
    const r = await guardarImagenes(carmen, { estado: { ...IMAGEN_INICIAL, quitar: true }, alt: '', ruta: 'x', altGuardado: 'Afiche del taller' })
    expect(r.evento).toMatchObject({ flyer_url: null, flyer_alt: null })
    expect(catalogoDelVisitante(await bd.rpc('catalogo_eventos', {}))).not.toContain('<img ')
  })

  it('dado un evento cancelado, entonces ya no se pueden cambiar sus imágenes', async () => {
    await bd.sql(`update capa.eventos set estado = 'cancelado', motivo_cancelacion = 'Prueba' where id = $1`, [ev.id])
    await expect(guardarImagenes(carmen, elegida(archivo('image/png', 1000))))
      .rejects.toMatchObject({ message: 'El evento está cancelado y ya no se puede editar.' })
  })
})

describe('HU-20: un evento sin imágenes se ve bien', () => {
  it('dado un evento sin flyer ni imagen del lugar, entonces el catálogo muestra el bloque de fecha y la página no tiene huecos', async () => {
    const fila = catalogoDelVisitante(await bd.rpc('catalogo_eventos', {}))
    expect(fila).toContain('Taller de Python')
    expect(fila).not.toContain('<img ')
    const html = paginaDelVisitante(await bd.rpc('detalle_evento', { id: ev.id }))
    expect(html).not.toContain('Ver flyer completo')
    expect(html).not.toContain('<img ')
    expect(html).toContain('Cómo llegar')
  })
})
