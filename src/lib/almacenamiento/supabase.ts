// Implementación con Supabase Storage (CAP-97). Recibe el cliente ya creado: así las pruebas usan
// uno falso y este archivo no lee variables de entorno (DIP, diap. 92–106).
import { ErrorAlmacenamiento, type Almacenamiento, type Bucket } from './contrato'

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

export function almacenamientoSupabase(cliente: ClienteStorage): Almacenamiento {
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
      return cliente.storage.from(bucket).getPublicUrl(ruta).data.publicUrl
    },
  }
}
