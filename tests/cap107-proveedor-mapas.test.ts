// CAP-107 · Proveedor de mapas y cabeceras de Vercel (HU-19). Rol: DevOps (George).
// Teoría: Adapter (diap. 126–132): el proveedor (Leaflet + OpenStreetMap) queda detrás de un componente propio
// (CAP-105); mantenibilidad (diap. 137): estas pruebas avisan si un cambio en vercel.json bloquea el mapa en producción.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface Cabecera { key: string; value: string }
const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8')) as {
  headers: { source: string; headers: Cabecera[] }[]
}
const todas = vercel.headers.find((h) => h.source === '/(.*)')?.headers ?? []
const valor = (k: string) => todas.find((h) => h.key.toLowerCase() === k.toLowerCase())?.value

describe('CAP-107 cabeceras de Vercel para el mapa', () => {
  it('todas las páginas envían el origen al pedir mosaicos y direcciones (lo piden OpenStreetMap y Nominatim)', () => {
    expect(valor('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('si alguna vez se agrega una política de contenido, debe dejar cargar los mosaicos y la búsqueda', () => {
    const csp = vercel.headers.flatMap((h) => h.headers).find((h) => h.key.toLowerCase() === 'content-security-policy')?.value
    if (csp) {
      expect(csp).toContain('tile.openstreetmap.org')
      expect(csp).toContain('nominatim.openstreetmap.org')
    } else {
      expect(csp).toBeUndefined()
    }
  })

  it('se mantienen las cabeceras que ya había (cámara para el escáner de QR y caché de los archivos del build)', () => {
    expect(valor('Permissions-Policy')).toBe('camera=(self)')
    const assets = vercel.headers.find((h) => h.source === '/assets/(.*)')?.headers ?? []
    expect(assets).toContainEqual({ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' })
  })
})
