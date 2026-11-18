// Imagen elegida en un formulario: vista previa, rechazo con motivo, quitar y guardada.
// La usan la foto de perfil (CAP-95), el flyer y la imagen del lugar (CAP-110, HU-20); la usarán los comprobantes (HU-16).
// Rol: Frontend (José). Se sacó de fotoPerfil.ts en CAP-110 sin cambiar su comportamiento.
//
// Teoría de Diseño de Software:
// · Code smells / duplicación (diap. 33): la tarea CAP-110 pide que la validación de imágenes se escriba una sola
//   vez para perfil, comprobantes y flyers. Aquí está esa única versión; cada uso solo cambia sus reglas
//   (tipos, tamaño y cómo se nombra el archivo en el mensaje).
// · OCP (diap. 50–63): una imagen nueva es un juego de reglas nuevo (ReglasArchivo), no otro reductor.
// · SRP (diap. 39–49): solo el estado de lo elegido; subir es del módulo de almacenamiento (CAP-97) y dibujar
//   es de los componentes de diseño (CAP-93 y CAP-108). Por eso se prueba sin navegador.
// · Refactorizar con pruebas (diap. 140): las pruebas de CAP-95 y CAP-96 siguen pasando sin cambios.
import { useEffect, useMemo, useReducer } from 'react'
import { validarArchivo, type ReglasArchivo } from './almacenamiento'

export interface EstadoImagen {
  /** Archivo elegido y todavía sin guardar. */
  archivo: File | Blob | null
  /** URL temporal para la vista previa del archivo elegido. */
  previa: string | null
  /** true = al guardar se quita la imagen guardada. */
  quitar: boolean
  error: string | null
}

export type AccionImagen =
  | { tipo: 'elegir'; archivo: File | Blob; url: string }
  | { tipo: 'quitar' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'guardada' }

export const IMAGEN_INICIAL: EstadoImagen = { archivo: null, previa: null, quitar: false, error: null }

/** Reductor para un juego de reglas (tipos y tamaño). */
export function reducirImagen(reglas: ReglasArchivo) {
  return (e: EstadoImagen, a: AccionImagen): EstadoImagen => {
    switch (a.tipo) {
      case 'elegir': {
        // Un archivo inválido no reemplaza la imagen actual; solo muestra el motivo (HU-17 CA-02, HU-20 CA-04).
        const motivo = validarArchivo(a.archivo, reglas)
        if (motivo) return { ...e, error: motivo }
        return { archivo: a.archivo, previa: a.url, quitar: false, error: null }
      }
      case 'quitar':
        // Con una vista previa, «Quitar» la descarta; si no, marca la imagen guardada para quitarla al guardar.
        return e.previa ? { ...IMAGEN_INICIAL } : { ...IMAGEN_INICIAL, quitar: true }
      case 'error':
        return { ...e, error: a.mensaje }
      case 'guardada':
        return { ...IMAGEN_INICIAL }
    }
  }
}

/** Qué imagen se ve ahora: la vista previa, ninguna (se va a quitar) o la guardada. */
export function imagenVisible(e: EstadoImagen, urlGuardada: string | null): string | null {
  if (e.previa) return e.previa
  if (e.quitar) return null
  return urlGuardada
}

/** true si hay algo que guardar: un archivo nuevo o una imagen para quitar. */
export const hayCambio = (e: EstadoImagen) => !!e.archivo || e.quitar

/** Estado de una imagen para la pantalla; libera la URL de la vista previa cuando ya no se usa. */
export function useImagenElegida(reglas: ReglasArchivo) {
  const reductor = useMemo(() => reducirImagen(reglas), [reglas])
  const [estado, despachar] = useReducer(reductor, IMAGEN_INICIAL)
  useEffect(() => () => { if (estado.previa) URL.revokeObjectURL(estado.previa) }, [estado.previa])
  return {
    estado,
    elegir: (archivo: File) => {
      // Solo se crea la URL temporal si el archivo se va a mostrar.
      if (validarArchivo(archivo, reglas)) despachar({ tipo: 'elegir', archivo, url: '' })
      else despachar({ tipo: 'elegir', archivo, url: URL.createObjectURL(archivo) })
    },
    quitar: () => despachar({ tipo: 'quitar' }),
    fallo: (mensaje: string) => despachar({ tipo: 'error', mensaje }),
    guardada: () => despachar({ tipo: 'guardada' }),
  }
}
