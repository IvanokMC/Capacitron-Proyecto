// Punto de entrada del almacenamiento (CAP-97). Elige la implementación con la misma regla que el
// backend: Supabase si hay credenciales; si no, local. Las pantallas solo importan desde aquí.
import { useEffect, useState } from 'react'
import type { Almacenamiento, Bucket } from './contrato'
import { almacenamientoLocal } from './local'
import { leerToken } from '../sesion'

export * from './contrato'

let instancia: Promise<Almacenamiento> | null = null

export function almacenamiento(): Promise<Almacenamiento> {
  if (!instancia) {
    // Las variables se leen aquí mismo, igual que en backend(): así Vite resuelve la condición al
    // compilar y el build de producción no incluye la implementación que no se usa.
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    instancia = url && clave
      ? Promise.all([import('@supabase/supabase-js'), import('./supabase')]).then(([{ createClient }, { almacenamientoSupabase }]) => {
        const cliente = createClient(url, clave, { auth: { persistSession: false } })
        // CAP-92: enlace firmado de un comprobante. La Edge Function comprueba la sesión con la base de datos.
        return almacenamientoSupabase(cliente, async (_bucket, ruta) => {
          const { data, error } = await cliente.functions.invoke<{ url: string }>('url-comprobante', { body: { token: leerToken(), ruta } })
          return error || !data?.url ? null : data.url
        })
      })
      : Promise.resolve(almacenamientoLocal())
  }
  return instancia
}

/** Dirección para mostrar un archivo guardado (por ejemplo, la foto de perfil). null mientras carga o si no hay. */
export function useUrlArchivo(bucket: Bucket, ruta: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let vigente = true
    setUrl(null)
    if (ruta) almacenamiento().then((a) => a.url(bucket, ruta)).then((u) => { if (vigente) setUrl(u) }).catch(() => {})
    return () => { vigente = false }
  }, [bucket, ruta])
  return url
}
