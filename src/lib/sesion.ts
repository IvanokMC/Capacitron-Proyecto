// Token de la sesión guardado en el navegador (CAP-92 · George, DevOps).
// Estaba dentro de app.tsx; se sacó a este módulo para que el almacenamiento pueda pedir enlaces firmados de los
// comprobantes sin depender de toda la app (bajo acoplamiento, diap. 29–35; SRP, diap. 39–49).
const CLAVE_TOKEN = 'capacitron.token'

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

export function guardarToken(t: string | null) {
  try {
    if (t) localStorage.setItem(CLAVE_TOKEN, t)
    else localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    /* almacenamiento no disponible: la sesión dura lo que dure la pestaña */
  }
}
