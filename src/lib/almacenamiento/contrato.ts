// Contrato del almacenamiento de archivos (CAP-97 · George, DevOps · HU-17, y luego HU-16 y HU-20).
//
// Teoría de Diseño de Software:
// · DIP (diap. 92–106): las pantallas dependen de esta interfaz, no de Supabase. Hay dos
//   implementaciones: Supabase Storage (producción) y local (modo sin credenciales y pruebas).
// · LSP (diap. 64–79): las dos cumplen el mismo contrato; tests/cap97-almacenamiento.test.ts corre
//   las mismas pruebas sobre ambas.
// · Code smells / duplicación (diap. 33): validar el archivo y armar la ruta se escribe una sola vez
//   aquí (subirArchivo), no en cada pantalla que sube algo.
// · Evitar sobreingeniería (diap. 135–139): el contrato solo tiene lo que hoy se usa (subir y leer).
//   Borrar se agregará cuando una historia lo necesite.

/** Buckets conocidos. HU-16 (comprobantes) y HU-20 (flyers) agregarán los suyos aquí. */
export type Bucket = 'fotos'

export interface Almacenamiento {
  readonly modo: 'local' | 'supabase'
  /**
   * Guarda el archivo en `ruta` dentro del bucket y devuelve la misma ruta.
   * Nunca reemplaza un archivo existente: si la ruta ya existe, falla con ErrorAlmacenamiento('SUBIDA').
   */
  subir(bucket: Bucket, ruta: string, archivo: Blob): Promise<string>
  /**
   * Dirección para mostrar el archivo (por ejemplo en <img>). No garantiza que exista:
   * la implementación local devuelve null si sabe que no está; la de Supabase siempre arma la URL.
   */
  url(bucket: Bucket, ruta: string): Promise<string | null>
}

export class ErrorAlmacenamiento extends Error {
  constructor(message: string, public codigo: 'ARCHIVO' | 'SUBIDA') {
    super(message)
  }
}

export interface ReglasArchivo {
  /** Tipos MIME aceptados y la extensión que se usa en la ruta. */
  tipos: Record<string, string>
  maxBytes: number
  /** Cómo se nombra el archivo en los mensajes: «La foto», «El comprobante»… */
  nombre: string
  /** Formatos en palabras para el mensaje de tipo no permitido. */
  formatos: string
}

/** Reglas por bucket. Las de fotos son las de la HU-17 (CA-01 y CA-02) y coinciden con el bucket en Supabase. */
export const REGLAS: Record<Bucket, ReglasArchivo> = {
  fotos: {
    tipos: { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' },
    maxBytes: 2 * 1024 * 1024,
    nombre: 'La foto',
    formatos: 'JPG, PNG o WEBP',
  },
}

const MB = 1024 * 1024
// Coma decimal, como en los textos de la ficha de diseño (CAP-93): «3,1 MB».
// Se redondea hacia arriba (H-01 de CAP-96): con 2 MB + 1 byte, «2,0 MB» se leía como si cumpliera el límite.
// El 1e-9 absorbe el error de coma flotante (3,1 MB exactos no deben mostrarse como 3,2).
const mb = (bytes: number) => (Math.ceil((bytes * 10) / MB - 1e-9) / 10).toFixed(1).replace('.', ',')

/** Devuelve el motivo por el que el archivo no se acepta, o null si cumple las reglas. Textos de la ficha CAP-93. */
export function validarArchivo(archivo: Pick<Blob, 'type' | 'size'>, reglas: ReglasArchivo): string | null {
  if (!reglas.tipos[archivo.type]) return `${reglas.nombre} debe ser una imagen ${reglas.formatos}.`
  if (archivo.size > reglas.maxBytes) {
    return `${reglas.nombre} pesa ${mb(archivo.size)} MB y el límite es ${Math.round(reglas.maxBytes / MB)} MB.`
  }
  return null
}

/**
 * Ruta nueva dentro de la carpeta de la persona: `<usuarioId>/<aleatorio>.<ext>`.
 * Cada subida usa un nombre distinto, así nunca se pisa un archivo y la caché del navegador no muestra uno viejo.
 * Cumple el formato que acepta capa.foto_valida (CAP-94).
 */
export function rutaNueva(usuarioId: string, tipo: string, reglas: ReglasArchivo): string {
  const ext = reglas.tipos[tipo]
  if (!ext) throw new ErrorAlmacenamiento(`${reglas.nombre} debe ser una imagen ${reglas.formatos}.`, 'ARCHIVO')
  const aleatorio = globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 16)
  return `${usuarioId}/${Date.now().toString(36)}-${aleatorio}.${ext}`
}

/** Valida, arma la ruta y sube. Es lo único que deben llamar las pantallas. Devuelve la ruta para guardarla en la base. */
export async function subirArchivo(alm: Almacenamiento, bucket: Bucket, usuarioId: string, archivo: Blob): Promise<string> {
  const reglas = REGLAS[bucket]
  const motivo = validarArchivo(archivo, reglas)
  if (motivo) throw new ErrorAlmacenamiento(motivo, 'ARCHIVO')
  return alm.subir(bucket, rutaNueva(usuarioId, archivo.type, reglas), archivo)
}
