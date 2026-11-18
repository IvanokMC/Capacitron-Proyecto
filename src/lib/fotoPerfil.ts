// Foto de perfil: elegir, ver la vista previa, quitar y guardar (CAP-95 · José, Frontend · HU-17 CA-01 a CA-03).
//
// Teoría de Diseño de Software:
// · DIP (diap. 92–106): guardarFoto recibe el Almacenamiento (CAP-97) como contrato; no sabe si es
//   Supabase o el modo local. La pantalla tampoco importa Supabase.
// · SRP (diap. 39–49): aquí está la lógica de la foto (estados y qué mandar a la API); Perfil.tsx solo
//   la dibuja con SelectorFoto (CAP-93). Por eso se prueba sin navegador.
// · Code smells / duplicación (diap. 33): la validación de tipo y tamaño es la del módulo común
//   (validarArchivo), con los mismos textos de la ficha de diseño. Desde CAP-110 los estados (elegir,
//   rechazar, quitar) están en imagenElegida.ts, compartidos con el flyer y la imagen del lugar; aquí
//   solo quedan las reglas de la foto y qué mandar a actualizar_perfil.
import { REGLAS, subirArchivo, type Almacenamiento } from './almacenamiento'
import { IMAGEN_INICIAL, imagenVisible, reducirImagen, useImagenElegida, type AccionImagen, type EstadoImagen } from './imagenElegida'

export type EstadoFoto = EstadoImagen
export type AccionFoto = AccionImagen

export const FOTO_INICIAL: EstadoFoto = IMAGEN_INICIAL

/** CA-02: un archivo inválido no reemplaza la foto actual; solo muestra el motivo. */
export const reducirFoto = reducirImagen(REGLAS.fotos)

/** Qué foto se ve ahora: la vista previa, ninguna (se va a quitar) o la guardada. */
export const fotoVisible = imagenVisible

/**
 * Sube el archivo elegido (si hay) y devuelve lo que hay que mandar a actualizar_perfil:
 * `{ foto_url: ruta }`, `{ foto_url: null }` para quitarla, o `{}` para no tocarla (CAP-94).
 */
export async function guardarFoto(alm: Almacenamiento, usuarioId: string, e: EstadoFoto): Promise<{ foto_url?: string | null }> {
  if (e.archivo) return { foto_url: await subirArchivo(alm, 'fotos', usuarioId, e.archivo) }
  if (e.quitar) return { foto_url: null }
  return {}
}

/** Estado de la foto para la pantalla; libera la URL de la vista previa cuando ya no se usa. */
export function useFotoPerfil() {
  return useImagenElegida(REGLAS.fotos)
}
