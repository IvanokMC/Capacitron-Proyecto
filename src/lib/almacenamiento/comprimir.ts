// CAP-112 · Compresión de imágenes antes de subirlas (HU-20; también sirve para fotos y comprobantes).
// Rol: DevOps (George).
//
// Por qué: un flyer o una foto del celular pesa entre 2 y 6 MB, y en el catálogo se muestra en una miniatura de
// 56 px. Sin comprimir, cada visitante descargaría varios MB por evento. Se reduce el lado mayor a 1600 px y se
// guarda en WEBP: el texto del flyer se sigue leyendo y el archivo baja a una fracción
// (medición en CAPACITRON_registro/tareas/CAP-112/rendimiento.json).
//
// Teoría de Diseño de Software:
// · Code smells / duplicación (diap. 33) y DIP (diap. 92–106): una sola forma de preparar archivos en todo el
//   sistema, junto al módulo común de almacenamiento; las pantallas no repiten esta lógica.
// · Evitar sobreingeniería (diap. 135–139): solo redimensionar y recodificar con el navegador (canvas); sin
//   librerías ni servidores de imágenes.

export interface OpcionesCompresion {
  /** Lado mayor máximo en píxeles. */
  maxLado: number
  /** Calidad de WEBP entre 0 y 1. */
  calidad: number
}

export const COMPRESION_POR_DEFECTO: OpcionesCompresion = { maxLado: 1600, calidad: 0.82 }

/** Tamaño de destino: conserva la proporción y nunca agranda. */
export function dimensionesDestino(ancho: number, alto: number, maxLado: number): { ancho: number; alto: number } {
  const mayor = Math.max(ancho, alto)
  if (mayor <= maxLado) return { ancho, alto }
  const f = maxLado / mayor
  return { ancho: Math.round(ancho * f), alto: Math.round(alto * f) }
}

/**
 * Devuelve una versión WEBP más liviana de la imagen. Si el navegador no puede (o el resultado pesa más),
 * devuelve el archivo original: la validación de tipo y tamaño del módulo sigue decidiendo después.
 */
export async function comprimirImagen(archivo: Blob, opciones: OpcionesCompresion = COMPRESION_POR_DEFECTO): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(archivo.type) || typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return archivo
  }
  try {
    const imagen = await createImageBitmap(archivo)
    const { ancho, alto } = dimensionesDestino(imagen.width, imagen.height, opciones.maxLado)
    const lienzo = document.createElement('canvas')
    lienzo.width = ancho
    lienzo.height = alto
    const ctx = lienzo.getContext('2d')
    if (!ctx) return archivo
    ctx.drawImage(imagen, 0, 0, ancho, alto)
    imagen.close()
    const resultado = await new Promise<Blob | null>((ok) => lienzo.toBlob(ok, 'image/webp', opciones.calidad))
    return resultado && resultado.type === 'image/webp' && resultado.size < archivo.size ? resultado : archivo
  } catch {
    return archivo
  }
}
