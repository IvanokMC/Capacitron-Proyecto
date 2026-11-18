// Foto de perfil: elegir, ver la vista previa, quitar y guardar (CAP-95 · José, Frontend · HU-17 CA-01 a CA-03).
//
// Teoría de Diseño de Software:
// · DIP (diap. 92–106): guardarFoto recibe el Almacenamiento (CAP-97) como contrato; no sabe si es
//   Supabase o el modo local. La pantalla tampoco importa Supabase.
// · SRP (diap. 39–49): aquí está la lógica de la foto (estados y qué mandar a la API); Perfil.tsx solo
//   la dibuja con SelectorFoto (CAP-93). Por eso se prueba sin navegador.
// · Code smells / duplicación (diap. 33): la validación de tipo y tamaño es la del módulo común
//   (validarArchivo), con los mismos textos de la ficha de diseño.
import { useEffect, useReducer } from 'react'
import { REGLAS, subirArchivo, validarArchivo, type Almacenamiento } from './almacenamiento'

export interface EstadoFoto {
  /** Archivo elegido y todavía sin guardar. */
  archivo: File | Blob | null
  /** URL temporal para la vista previa del archivo elegido. */
  previa: string | null
  /** true = al guardar se quita la foto guardada (CA-03). */
  quitar: boolean
  error: string | null
}

export type AccionFoto =
  | { tipo: 'elegir'; archivo: File | Blob; url: string }
  | { tipo: 'quitar' }
  | { tipo: 'error'; mensaje: string }
  | { tipo: 'guardada' }

export const FOTO_INICIAL: EstadoFoto = { archivo: null, previa: null, quitar: false, error: null }

export function reducirFoto(e: EstadoFoto, a: AccionFoto): EstadoFoto {
  switch (a.tipo) {
    case 'elegir': {
      // CA-02: un archivo inválido no reemplaza la foto actual; solo muestra el motivo.
      const motivo = validarArchivo(a.archivo, REGLAS.fotos)
      if (motivo) return { ...e, error: motivo }
      return { archivo: a.archivo, previa: a.url, quitar: false, error: null }
    }
    case 'quitar':
      // Con una vista previa, «Quitar» la descarta; si no, marca la foto guardada para quitarla al guardar.
      return e.previa ? { ...FOTO_INICIAL } : { ...FOTO_INICIAL, quitar: true }
    case 'error':
      return { ...e, error: a.mensaje }
    case 'guardada':
      return { ...FOTO_INICIAL }
  }
}

/** Qué foto se ve ahora: la vista previa, ninguna (se va a quitar) o la guardada. */
export function fotoVisible(e: EstadoFoto, urlGuardada: string | null): string | null {
  if (e.previa) return e.previa
  if (e.quitar) return null
  return urlGuardada
}

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
  const [estado, despachar] = useReducer(reducirFoto, FOTO_INICIAL)
  useEffect(() => () => { if (estado.previa) URL.revokeObjectURL(estado.previa) }, [estado.previa])
  return {
    estado,
    elegir: (archivo: File) => {
      if (validarArchivo(archivo, REGLAS.fotos)) despachar({ tipo: 'elegir', archivo, url: '' })
      else despachar({ tipo: 'elegir', archivo, url: URL.createObjectURL(archivo) })
    },
    quitar: () => despachar({ tipo: 'quitar' }),
    fallo: (mensaje: string) => despachar({ tipo: 'error', mensaje }),
    guardada: () => despachar({ tipo: 'guardada' }),
  }
}
