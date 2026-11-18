// CAP-81 · Filtros del catálogo público (HU-15, CA-03 a CA-05). Rol: Diseño UI/UX (Medaly).
//
// Separación de responsabilidades (diap. 6, 19) y SRP (diap. 39–49): aquí vive solo la lógica de los
// filtros (qué se manda a la API, qué fichas se muestran, cómo se leen y escriben en la dirección).
// La pantalla (Catalogo.tsx) solo dibuja; por eso todo esto se prueba sin navegador (diap. 140).
//
// Ético (CA-05, AG-C01.2): los filtros se guardan únicamente en la dirección de la página
// (?tipo=taller&desde=…). No se usa localStorage, cookies ni la base de datos, así que buscar
// no deja rastro del visitante y el enlace se puede compartir.
import { useEffect, useState } from 'react'
import type { FiltrosCatalogo, Modalidad } from './tipos'
import { MODALIDAD } from './formato'
import { etiquetaTipo, TIPOS_EVENTO, type TipoEvento } from './validacionEvento'

/** Lo que la persona eligió en el panel. Todo es texto para enlazarlo directo con los controles. */
export interface EstadoFiltros {
  q: string
  tipo: TipoEvento | ''
  modalidad: Modalidad | ''
  precio: 'gratis' | 'pago' | ''
  /** AAAA-MM-DD, como lo entrega <input type="date">. */
  desde: string
  hasta: string
  ubicacion: string
  pasados: boolean
}

export const FILTROS_VACIOS: EstadoFiltros = {
  q: '', tipo: '', modalidad: '', precio: '', desde: '', hasta: '', ubicacion: '', pasados: false,
}

export const ERROR_RANGO = 'La fecha final no puede ser anterior a la inicial.'

/** Mismo criterio que capa.filtros_catalogo (CAP-80): se avisa antes de consultar, no después. */
export function errorRango(f: Pick<EstadoFiltros, 'desde' | 'hasta'>): string | null {
  return f.desde && f.hasta && f.hasta < f.desde ? ERROR_RANGO : null
}

/**
 * Parámetros para `catalogo_eventos`. Omite lo vacío para que la consulta y la clave de caché de
 * useCarga no cambien por espacios. Si el rango es inválido no manda las fechas: se sigue mostrando
 * el último resultado válido y el aviso queda junto al campo.
 */
export function paramsCatalogo(f: EstadoFiltros): FiltrosCatalogo {
  const p: FiltrosCatalogo = { incluir_pasados: f.pasados }
  const q = f.q.trim()
  const ubicacion = f.ubicacion.trim()
  if (q) p.q = q
  if (f.tipo) p.tipo = f.tipo
  if (f.modalidad) p.modalidad = f.modalidad
  if (f.precio) p.precio = f.precio
  if (ubicacion) p.ubicacion = ubicacion
  if (!errorRango(f)) {
    if (f.desde) p.desde = f.desde
    if (f.hasta) p.hasta = f.hasta
  }
  return p
}

export type ClaveFicha = 'q' | 'tipo' | 'modalidad' | 'precio' | 'fechas' | 'ubicacion'
export interface Ficha { clave: ClaveFicha; texto: string }

/** «2026-11-20» → «20/11/2026», sin pasar por Date para no correr el día por la zona horaria. */
export function fechaCorta(iso: string) {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/**
 * Un filtro activo = una ficha que se puede quitar sola (CA-03: los filtros se combinan y se ven).
 * «Incluir finalizados» no es ficha: amplía la lista en vez de acotarla.
 */
export function fichasActivas(f: EstadoFiltros): Ficha[] {
  const fichas: Ficha[] = []
  const q = f.q.trim()
  const ubicacion = f.ubicacion.trim()
  if (q) fichas.push({ clave: 'q', texto: `«${q}»` })
  if (f.tipo) fichas.push({ clave: 'tipo', texto: etiquetaTipo(f.tipo) ?? f.tipo })
  if (f.modalidad) fichas.push({ clave: 'modalidad', texto: MODALIDAD[f.modalidad] })
  if (f.precio) fichas.push({ clave: 'precio', texto: f.precio === 'gratis' ? 'Gratis' : 'De pago' })
  if (f.desde && f.hasta && !errorRango(f)) {
    fichas.push({ clave: 'fechas', texto: `Del ${fechaCorta(f.desde)} al ${fechaCorta(f.hasta)}` })
  } else if (f.desde && !f.hasta) {
    fichas.push({ clave: 'fechas', texto: `Desde el ${fechaCorta(f.desde)}` })
  } else if (f.hasta && !f.desde) {
    fichas.push({ clave: 'fechas', texto: `Hasta el ${fechaCorta(f.hasta)}` })
  }
  if (ubicacion) fichas.push({ clave: 'ubicacion', texto: `En ${ubicacion}` })
  return fichas
}

export function quitarFicha(f: EstadoFiltros, clave: ClaveFicha): EstadoFiltros {
  if (clave === 'fechas') return { ...f, desde: '', hasta: '' }
  return { ...f, [clave]: '' }
}

// --- Dirección de la página -------------------------------------------------------------------
// Encapsulación (diap. 20–24): la pantalla no sabe qué nombres usa la URL ni cómo se validan.

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const uno = <T extends string>(v: string | null, validos: readonly T[]): T | '' =>
  validos.includes(v as T) ? (v as T) : ''

/** Lee los filtros de ?q=…; un valor que no corresponde (enlace editado a mano) se ignora. */
export function filtrosDesdeUrl(sp: URLSearchParams): EstadoFiltros {
  const fecha = (v: string | null) => (v && FECHA.test(v) ? v : '')
  return {
    q: sp.get('q') ?? '',
    tipo: uno(sp.get('tipo'), TIPOS_EVENTO.map((t) => t.valor)),
    modalidad: uno(sp.get('modalidad'), ['presencial', 'virtual', 'mixta'] as const),
    precio: uno(sp.get('precio'), ['gratis', 'pago'] as const),
    desde: fecha(sp.get('desde')),
    hasta: fecha(sp.get('hasta')),
    ubicacion: sp.get('ubicacion') ?? '',
    pasados: sp.get('pasados') === '1',
  }
}

/** Solo escribe lo que tiene valor, para que el catálogo sin filtros quede en «/». */
export function filtrosAUrl(f: EstadoFiltros): URLSearchParams {
  const sp = new URLSearchParams()
  const q = f.q.trim()
  const ubicacion = f.ubicacion.trim()
  if (q) sp.set('q', q)
  if (f.tipo) sp.set('tipo', f.tipo)
  if (f.modalidad) sp.set('modalidad', f.modalidad)
  if (f.precio) sp.set('precio', f.precio)
  if (f.desde) sp.set('desde', f.desde)
  if (f.hasta) sp.set('hasta', f.hasta)
  if (ubicacion) sp.set('ubicacion', ubicacion)
  if (f.pasados) sp.set('pasados', '1')
  return sp
}

/** Espera a que la persona deje de escribir antes de consultar (texto de búsqueda y ubicación). */
export function useRetraso<T>(valor: T, ms = 250): T {
  const [v, setV] = useState(valor)
  useEffect(() => {
    const id = window.setTimeout(() => setV(valor), ms)
    return () => window.clearTimeout(id)
  }, [valor, ms])
  return v
}
