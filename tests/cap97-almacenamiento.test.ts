// CAP-97 · Módulo común de almacenamiento de archivos y bucket de fotos (HU-17).
// Rol: DevOps (George). Teoría: LSP (diap. 64–79): la misma batería de pruebas corre sobre las dos
// implementaciones; refactorizar con pruebas (diap. 140).
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { ErrorAlmacenamiento, REGLAS, rutaNueva, subirArchivo, validarArchivo, type Almacenamiento } from '../src/lib/almacenamiento/contrato'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import { almacenamientoSupabase, type ClienteStorage } from '../src/lib/almacenamiento/supabase'
import { nuevaBd } from './bd'

const USUARIO = '5b0c1d2e-3f40-4a51-8b62-7c83d94ea5f6'
// Mismo formato que capa.foto_valida (CAP-94) y que la política del bucket.
const RUTA_VALIDA = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$/i
const imagen = (tipo = 'image/png', bytes = 1024) => new Blob([new Uint8Array(bytes)], { type: tipo })

/** Cliente de Supabase falso: guarda en memoria y responde como Storage (error si la ruta ya existe). */
function clienteFalso() {
  const guardados = new Map<string, Blob>()
  const upload = vi.fn(async (ruta: string, archivo: Blob, _opciones?: unknown) => {
    if (guardados.has(ruta)) return { data: null, error: { message: 'The resource already exists' } }
    guardados.set(ruta, archivo)
    return { data: { path: ruta }, error: null }
  })
  const cliente: ClienteStorage = {
    storage: {
      from: (bucket) => ({
        upload: (ruta, archivo, opciones) => upload(`${bucket}/${ruta}`, archivo, opciones),
        getPublicUrl: (ruta) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${bucket}/${ruta}` } }),
      }),
    },
  }
  return { cliente, upload }
}

describe('CAP-97 reglas de archivo (HU-17 CA-01 y CA-02)', () => {
  it('acepta JPG, PNG y WEBP de hasta 2 MB', () => {
    for (const tipo of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(validarArchivo({ type: tipo, size: 2 * 1024 * 1024 }, REGLAS.fotos)).toBeNull()
    }
  })

  it('rechaza otro tipo con el texto del diseño', () => {
    expect(validarArchivo({ type: 'image/gif', size: 10 }, REGLAS.fotos)).toBe('La foto debe ser una imagen JPG, PNG o WEBP.')
  })

  it('rechaza más de 2 MB diciendo cuánto pesa', () => {
    expect(validarArchivo({ type: 'image/png', size: 3.1 * 1024 * 1024 }, REGLAS.fotos)).toBe('La foto pesa 3,1 MB y el límite es 2 MB.')
  })

  it('un archivo apenas mayor a 2 MB no dice «2,0 MB»: el peso se redondea hacia arriba (H-01 de CAP-96)', () => {
    const MB = 1024 * 1024
    expect(validarArchivo({ type: 'image/png', size: 2 * MB + 1 }, REGLAS.fotos)).toBe('La foto pesa 2,1 MB y el límite es 2 MB.')
    expect(validarArchivo({ type: 'image/png', size: 2 * MB }, REGLAS.fotos)).toBeNull()
    expect(validarArchivo({ type: 'image/png', size: 3 * MB }, REGLAS.fotos)).toBe('La foto pesa 3,0 MB y el límite es 2 MB.')
  })

  it('la ruta va en la carpeta de la persona, con el formato de capa.foto_valida, y nunca se repite', () => {
    const a = rutaNueva(USUARIO, 'image/webp', REGLAS.fotos)
    const b = rutaNueva(USUARIO, 'image/webp', REGLAS.fotos)
    expect(a).toMatch(RUTA_VALIDA)
    expect(a.startsWith(`${USUARIO}/`)).toBe(true)
    expect(a.endsWith('.webp')).toBe(true)
    expect(a).not.toBe(b)
  })
})

// LSP: el mismo contrato, las mismas pruebas, dos implementaciones.
const implementaciones: [string, () => Almacenamiento][] = [
  ['local', () => almacenamientoLocal({ persistir: false })],
  ['supabase', () => almacenamientoSupabase(clienteFalso().cliente)],
]

describe.each(implementaciones)('CAP-97 contrato Almacenamiento · %s', (_nombre, crear) => {
  it('subir devuelve la ruta y url permite mostrar el archivo', async () => {
    const alm = crear()
    const ruta = await subirArchivo(alm, 'fotos', USUARIO, imagen())
    expect(ruta).toMatch(RUTA_VALIDA)
    expect(await alm.url('fotos', ruta)).toEqual(expect.any(String))
  })

  it('nunca reemplaza un archivo que ya existe', async () => {
    const alm = crear()
    const ruta = `${USUARIO}/fija.png`
    await alm.subir('fotos', ruta, imagen())
    await expect(alm.subir('fotos', ruta, imagen())).rejects.toMatchObject({ codigo: 'SUBIDA' })
  })

  it('un archivo inválido se rechaza antes de subir', async () => {
    const alm = crear()
    const subir = vi.spyOn(alm, 'subir')
    await expect(subirArchivo(alm, 'fotos', USUARIO, imagen('application/pdf'))).rejects.toBeInstanceOf(ErrorAlmacenamiento)
    await expect(subirArchivo(alm, 'fotos', USUARIO, imagen('image/png', 3 * 1024 * 1024))).rejects.toMatchObject({ codigo: 'ARCHIVO' })
    expect(subir).not.toHaveBeenCalled()
  })
})

describe('CAP-97 detalles de cada implementación', () => {
  it('Supabase sube con el tipo del archivo, sin reemplazar y con caché larga', async () => {
    const { cliente, upload } = clienteFalso()
    const ruta = await subirArchivo(almacenamientoSupabase(cliente), 'fotos', USUARIO, imagen('image/jpeg'))
    expect(upload).toHaveBeenCalledWith(`fotos/${ruta}`, expect.any(Blob), { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' })
    expect(await almacenamientoSupabase(cliente).url('fotos', ruta)).toBe(`https://x.supabase.co/storage/v1/object/public/fotos/${ruta}`)
  })

  it('la local devuelve null para un archivo que no tiene', async () => {
    expect(await almacenamientoLocal({ persistir: false }).url('fotos', `${USUARIO}/no-existe.png`)).toBeNull()
  })

  it('la local devuelve el mismo archivo que se subió', async () => {
    const alm = almacenamientoLocal({ persistir: false })
    const ruta = await subirArchivo(alm, 'fotos', USUARIO, imagen('image/png', 2048))
    const url = (await alm.url('fotos', ruta))!
    const leido = await (await fetch(url)).blob()
    expect(leido.size).toBe(2048)
  })
})

describe('CAP-97 bucket de fotos (migración)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261117000002_bucket_fotos.sql', import.meta.url), 'utf8')

  it('en PGlite (sin Storage) no hace nada y no falla', async () => {
    const bd = await nuevaBd()
    await expect(bd.db.exec(sql)).resolves.toBeDefined()
  })

  it('el bucket limita tipo y tamaño y no permite reemplazar ni borrar', () => {
    expect(sql).toContain("2097152, array['image/jpeg', 'image/png', 'image/webp']")
    expect(sql).not.toMatch(/for (update|delete|all)/i)
  })
})
