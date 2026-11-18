// Flyer e imagen del lugar del evento: reglas, qué subir y qué mandar a la API (CAP-110 · José, Frontend · HU-20).
//
// Flujo al guardar el evento (EditorEvento.tsx):
//   1. guardar_evento (CAP-77) devuelve el id del evento (en uno nuevo, recién ahí existe la carpeta);
//   2. cada imagen nueva se comprime (CAP-112) y se sube a «eventos/<id del evento>/…» con el módulo común (CAP-97);
//   3. guardar_imagenes_evento (CAP-109) guarda las rutas y las descripciones. Solo el organizador del evento (CA-05).
//
// Teoría de Diseño de Software:
// · DIP (diap. 92–106): recibe el Almacenamiento y la función de la API como contratos; no importa Supabase.
//   La compresión también entra como parámetro, así las pruebas no necesitan un navegador.
// · Code smells / duplicación (diap. 33): el tipo y el tamaño los valida validarArchivo con REGLAS.eventos
//   (CAP-112); aquí solo se cambia cómo se nombra el archivo en el mensaje («El flyer…»), como pide la ficha
//   de diseño CAP-108.
// · SRP (diap. 39–49): guardar las imágenes va separado de guardar los datos del evento, igual que en la base
//   de datos (CAP-109): cambiar el flyer no reenvía fechas ni cupos.
import { REGLAS, subirArchivo, type Almacenamiento, type ReglasArchivo } from './almacenamiento'
import { comprimirImagen } from './almacenamiento/comprimir'
import { hayCambio, type EstadoImagen } from './imagenElegida'

export type ClaveImagen = 'flyer' | 'imagen_lugar'

/** Las reglas del bucket «eventos» (JPG, PNG o WEBP de hasta 3 MB) con el nombre de cada imagen en los mensajes (CA-04). */
export const REGLAS_IMAGEN: Record<ClaveImagen, ReglasArchivo> = {
  flyer: { ...REGLAS.eventos, nombre: 'El flyer' },
  imagen_lugar: { ...REGLAS.eventos, nombre: 'La imagen del lugar' },
}

/** Lo que la pantalla sabe de cada imagen: lo elegido, la descripción escrita y la que ya estaba guardada. */
export interface ImagenFormulario {
  estado: EstadoImagen
  alt: string
  /** Ruta guardada (null si no hay imagen). */
  ruta: string | null
  altGuardado: string | null
}

type Comprimir = (archivo: Blob) => Promise<Blob>

const altONull = (v: string) => v.trim() || null

/**
 * Sube lo elegido y arma lo que hay que mandar a guardar_imagenes_evento. Devuelve {} si no cambió nada.
 * · Imagen nueva: se comprime (CA-01 y rendimiento medido en CAP-112), se sube y se manda la ruta con su descripción.
 * · Quitar: la ruta en null; la base de datos borra también la descripción (CAP-109).
 * · Solo la descripción: se manda si hay una imagen guardada y el texto cambió.
 */
export async function cambiosImagenes(
  alm: Almacenamiento, eventoId: string, imagenes: Record<ClaveImagen, ImagenFormulario>, comprimir: Comprimir = comprimirImagen,
): Promise<Record<string, string | null>> {
  const p: Record<string, string | null> = {}
  for (const k of ['flyer', 'imagen_lugar'] as const) {
    const { estado, alt, ruta, altGuardado } = imagenes[k]
    if (estado.archivo) {
      // Se comprime DESPUÉS de validar el original: CA-04 rechaza lo que pasa de 3 MB tal como lo eligió la persona.
      const archivo = await comprimir(estado.archivo)
      p[`${k}_url`] = await subirArchivo(alm, 'eventos', eventoId, archivo)
      p[`${k}_alt`] = altONull(alt)
    } else if (estado.quitar) {
      p[`${k}_url`] = null
    } else if (ruta && altONull(alt) !== (altGuardado ?? null)) {
      p[`${k}_alt`] = altONull(alt)
    }
  }
  return p
}

/** true si alguna imagen o descripción cambió (para no llamar a la API sin necesidad). */
export function hayCambiosImagenes(imagenes: Record<ClaveImagen, ImagenFormulario>): boolean {
  return (['flyer', 'imagen_lugar'] as const).some((k) => {
    const i = imagenes[k]
    return hayCambio(i.estado) || (!!i.ruta && altONull(i.alt) !== (i.altGuardado ?? null))
  })
}

/** Texto alternativo para mostrar: la descripción guardada o el nombre de la imagen; nunca vacío (ficha CAP-108). */
export function altImagen(alt: string | null | undefined, porDefecto: string): string {
  return alt?.trim() || porDefecto
}
