// Implementación local (CAP-97): modo sin credenciales de Supabase y pruebas.
// En el navegador guarda los archivos en IndexedDB, para que la foto siga ahí al recargar,
// igual que la base local (PGlite). Sin IndexedDB (Node, pruebas) los guarda en memoria.
// Cumple el mismo contrato que la de Supabase (LSP, diap. 64–79).
import { ErrorAlmacenamiento, type Almacenamiento, type Bucket } from './contrato'

interface Deposito {
  leer(clave: string): Promise<Blob | undefined>
  guardar(clave: string, archivo: Blob): Promise<void>
}

function enMemoria(): Deposito {
  const mapa = new Map<string, Blob>()
  return {
    async leer(clave) { return mapa.get(clave) },
    async guardar(clave, archivo) { mapa.set(clave, archivo) },
  }
}

function enIndexedDB(): Deposito {
  const abrir = new Promise<IDBDatabase>((ok, mal) => {
    const pedido = indexedDB.open('capacitron-archivos', 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore('archivos')
    pedido.onsuccess = () => ok(pedido.result)
    pedido.onerror = () => mal(pedido.error)
  })
  const operar = <T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    abrir.then((db) => new Promise<T>((ok, mal) => {
      const p = fn(db.transaction('archivos', modo).objectStore('archivos'))
      p.onsuccess = () => ok(p.result)
      p.onerror = () => mal(p.error)
    }))
  return {
    leer: (clave) => operar<Blob | undefined>('readonly', (s) => s.get(clave)),
    guardar: async (clave, archivo) => { await operar('readwrite', (s) => s.put(archivo, clave)) },
  }
}

export function almacenamientoLocal({ persistir = typeof indexedDB !== 'undefined' }: { persistir?: boolean } = {}): Almacenamiento {
  const deposito = persistir ? enIndexedDB() : enMemoria()
  const urls = new Map<string, string>()
  return {
    modo: 'local',
    async subir(bucket: Bucket, ruta: string, archivo: Blob) {
      const clave = `${bucket}/${ruta}`
      if (await deposito.leer(clave)) {
        throw new ErrorAlmacenamiento('No se pudo subir el archivo. Revisa tu conexión e inténtalo otra vez.', 'SUBIDA')
      }
      await deposito.guardar(clave, archivo)
      return ruta
    },
    async url(bucket: Bucket, ruta: string) {
      const clave = `${bucket}/${ruta}`
      const hecha = urls.get(clave)
      if (hecha) return hecha
      const archivo = await deposito.leer(clave)
      if (!archivo) return null
      const nueva = URL.createObjectURL(archivo)
      urls.set(clave, nueva)
      return nueva
    },
  }
}
