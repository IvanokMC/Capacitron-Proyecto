// CAP-112 · Bucket de imágenes de eventos en el módulo común de almacenamiento y compresión (HU-20).
// Rol: DevOps (George). Teoría: DIP y code smells (diap. 92–106 y 33): una sola forma de subir archivos;
// LSP (diap. 64–79): las dos implementaciones cumplen lo mismo también con el bucket nuevo;
// refactorizar con pruebas (diap. 140).
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { REGLAS, rutaNueva, subirArchivo, validarArchivo, type Almacenamiento } from '../src/lib/almacenamiento/contrato'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import { almacenamientoSupabase, type ClienteStorage } from '../src/lib/almacenamiento/supabase'
import { COMPRESION_POR_DEFECTO, comprimirImagen, dimensionesDestino } from '../src/lib/almacenamiento/comprimir'

const EVENTO = '7c3e2a10-5b4d-4e6f-9a81-0c2d3e4f5a6b'
const MB = 1024 * 1024
const RUTA_EVENTO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$/i
const imagen = (tipo = 'image/webp', bytes = 1024) => new Blob([new Uint8Array(bytes)], { type: tipo })
const MIGRACION = readFileSync(new URL('../supabase/migrations/20261121000002_bucket_eventos.sql', import.meta.url), 'utf8')

function clienteFalso() {
  const guardados = new Map<string, Blob>()
  const upload = vi.fn(async (ruta: string, archivo: Blob) => {
    if (guardados.has(ruta)) return { data: null, error: { message: 'The resource already exists' } }
    guardados.set(ruta, archivo)
    return { data: { path: ruta }, error: null }
  })
  const cliente: ClienteStorage = {
    storage: {
      from: (bucket) => ({
        upload: (ruta, archivo) => upload(`${bucket}/${ruta}`, archivo),
        getPublicUrl: (ruta) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${ruta}` } }),
      }),
    },
  }
  return { cliente, upload }
}

describe('CAP-112 reglas del bucket «eventos» (HU-20 CA-01 y CA-04)', () => {
  it('acepta JPG, PNG y WEBP de hasta 3 MB', () => {
    for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) expect(validarArchivo({ type: tipo, size: 3 * MB }, REGLAS.eventos)).toBeNull()
  })

  it('rechaza otros tipos y lo que pasa de 3 MB, diciendo cuánto pesa', () => {
    expect(validarArchivo({ type: 'image/gif', size: 1000 }, REGLAS.eventos)).toBe('La imagen debe ser una imagen JPG, PNG o WEBP.')
    expect(validarArchivo({ type: 'image/png', size: 3 * MB + 1 }, REGLAS.eventos)).toBe('La imagen pesa 3,1 MB y el límite es 3 MB.')
  })

  it('las fotos de perfil siguen con su límite de 2 MB', () => {
    expect(REGLAS.fotos.maxBytes).toBe(2 * MB)
    expect(REGLAS.eventos.maxBytes).toBe(3 * MB)
  })

  it('la ruta va en la carpeta del evento, con la forma que acepta la base de datos (CAP-109)', () => {
    expect(rutaNueva(EVENTO, 'image/webp', REGLAS.eventos)).toMatch(RUTA_EVENTO)
    expect(rutaNueva(EVENTO, 'image/webp', REGLAS.eventos).startsWith(`${EVENTO}/`)).toBe(true)
  })
})

describe.each([
  ['local', () => almacenamientoLocal({ persistir: false }) as Almacenamiento],
  ['supabase', () => almacenamientoSupabase(clienteFalso().cliente) as Almacenamiento],
])('CAP-112 el bucket «eventos» en la implementación %s (LSP)', (_nombre, crear) => {
  it('sube a la carpeta del evento y devuelve una dirección para mostrarla', async () => {
    const alm = crear()
    const ruta = await subirArchivo(alm, 'eventos', EVENTO, imagen())
    expect(ruta.startsWith(`${EVENTO}/`)).toBe(true)
    expect(await alm.url('eventos', ruta)).toEqual(expect.any(String))
  })

  it('no sube un archivo que no cumple las reglas', async () => {
    await expect(subirArchivo(crear(), 'eventos', EVENTO, imagen('image/png', 4 * MB))).rejects.toMatchObject({ codigo: 'ARCHIVO' })
  })

  it('un archivo ya subido no se reemplaza', async () => {
    const alm = crear()
    const ruta = await alm.subir('eventos', `${EVENTO}/a.webp`, imagen())
    await expect(alm.subir('eventos', ruta, imagen())).rejects.toMatchObject({ codigo: 'SUBIDA' })
  })
})

describe('CAP-112 el bucket en Supabase coincide con el módulo', () => {
  it('público, 3 MB y los mismos tipos que REGLAS.eventos', () => {
    expect(MIGRACION).toContain("values ('eventos', 'eventos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])")
    expect(3145728).toBe(REGLAS.eventos.maxBytes)
  })

  it('lectura pública y subir solo archivos nuevos en carpetas con forma de id de evento; sin actualizar ni borrar', () => {
    expect(MIGRACION).toContain('"eventos: lectura publica"')
    expect(MIGRACION).toContain('"eventos: subir archivo nuevo"')
    expect(MIGRACION).not.toMatch(/for (update|delete)/i)
    expect(MIGRACION).toContain('[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]+\\.(jpg|jpeg|png|webp)$')
  })

  it('en PGlite (sin Storage) no hace nada y no falla', () => {
    expect(MIGRACION).toContain("to_regclass('storage.buckets') is null")
  })
})

describe('CAP-112 compresión antes de subir', () => {
  it('reduce el lado mayor a 1600 px conservando la proporción y nunca agranda', () => {
    expect(dimensionesDestino(3000, 4000, 1600)).toEqual({ ancho: 1200, alto: 1600 })
    expect(dimensionesDestino(4032, 3024, 1600)).toEqual({ ancho: 1600, alto: 1200 })
    expect(dimensionesDestino(800, 600, 1600)).toEqual({ ancho: 800, alto: 600 })
  })

  it('usa WEBP con calidad 0,82 por defecto', () => {
    expect(COMPRESION_POR_DEFECTO).toEqual({ maxLado: 1600, calidad: 0.82 })
  })

  it('si no puede comprimir (sin navegador o tipo no soportado), devuelve el archivo original', async () => {
    const png = imagen('image/png', 2048)
    expect(await comprimirImagen(png)).toBe(png)
    const gif = imagen('image/gif', 2048)
    expect(await comprimirImagen(gif)).toBe(gif)
  })
})
