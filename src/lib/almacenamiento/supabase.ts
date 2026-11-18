// Implementación con Supabase Storage (CAP-97). Recibe el cliente ya creado: así las pruebas usan
// uno falso y este archivo no lee variables de entorno (DIP, diap. 92–106).
// CAP-92: los buckets privados (REGLAS[b].privado) no tienen dirección pública; su url() pide un enlace firmado a la
// función `firmar`, que se recibe como dependencia (la arma index.ts con la Edge Function «url-comprobante»).
import { ErrorAlmacenamiento, REGLAS, type Almacenamiento, type Bucket } from './contrato'

/** Pide un enlace firmado y de corta duración para un archivo privado; null si la sesión no puede verlo. */
export type FirmarPrivado = (bucket: Bucket, ruta: string) => Promise<string | null>

/** Lo mínimo del cliente de Supabase que se usa. El cliente real de @supabase/supabase-js lo cumple. */
export interface ClienteStorage {
  storage: {
    from(bucket: string): {
      upload(ruta: string, archivo: Blob, opciones: { contentType: string; upsert: boolean; cacheControl: string }):
        Promise<{ data: unknown; error: { message: string } | null }>
      getPublicUrl(ruta: string): { data: { publicUrl: string } }
    }
  }
}

export function almacenamientoSupabase(cliente: ClienteStorage, firmar?: FirmarPrivado): Almacenamiento {
  return {
    modo: 'supabase',
    async subir(bucket: Bucket, ruta: string, archivo: Blob) {
      // upsert: false → nunca se reemplaza un archivo (además, el bucket no permite actualizar ni borrar).
      const { error } = await cliente.storage.from(bucket).upload(ruta, archivo, {
        contentType: archivo.type, upsert: false, cacheControl: '31536000',
      })
      if (error) throw new ErrorAlmacenamiento('No se pudo subir el archivo. Revisa tu conexión e inténtalo otra vez.', 'SUBIDA')
      return ruta
    },
    async url(bucket: Bucket, ruta: string) {
      // Un archivo privado nunca se pide con la dirección pública (no funcionaría y la dejaría a la vista).
      if (REGLAS[bucket].privado) return firmar ? firmar(bucket, ruta).catch(() => null) : null
      return cliente.storage.from(bucket).getPublicUrl(ruta).data.publicUrl
    },
  }
}
