// CAP-103 · Diseño del mapa del evento y del selector de ubicación (HU-19, CA-01 a CA-04).
// Rol: Diseño UI/UX (Medaly). Diseño completo en docs/diseno/CAP-103-mapa/DISENO.md.
//
// Teoría de Diseño de Software:
// · DIP y Adapter (diap. 92–106 y 126–132): estos bloques no conocen Leaflet ni OpenStreetMap. El mapa
//   entra por la prop `mapa` (un hueco); CAP-105 (José) pone ahí el componente que habla con el proveedor.
//   Si mañana se cambia a Google Maps, el diseño no se toca.
// · SRP (diap. 39–49): aquí solo se muestra. Buscar direcciones, armar el enlace de Google Maps y guardar
//   las coordenadas son de CAP-105 y CAP-104; estos componentes reciben el resultado.
// · Evitar sobreingeniería (diap. 135–139): un punto, una dirección y un botón. Sin capas, rutas ni zoom
//   personalizado, porque la historia no los pide.
import { useId, type ReactNode } from 'react'
import { CalendarBlank, Crosshair, MagnifyingGlass, MapPin, NavigationArrow, X } from '@phosphor-icons/react'
import { Boton, cx, Entrada, Panel } from './ui'
import { fechaLarga, hora } from '../lib/formato'

export interface Punto { lat: number; lng: number }
export interface Sugerencia { id: string; nombre: string; detalle?: string }

export const TEXTOS_UBICACION = {
  titulo: 'Ubicación',
  comoLlegar: 'Cómo llegar',
  sinPunto: 'El organizador todavía no marcó el lugar en el mapa.',
  ayudaLugar: 'Escribe la dirección y elige una sugerencia, o toca el mapa para marcar el punto exacto.',
  instruccion: 'Toca el mapa para marcar el lugar',
  marcado: 'Punto marcado',
  quitar: 'Quitar punto',
  sinResultados: 'No encontramos esa dirección. Prueba con el nombre del local o toca el mapa.',
  buscando: 'Buscando…',
} as const

/** «13,5226° S · 71,9673° O»: con hemisferio y coma decimal, así no se confunde con dos números. */
export function textoPunto(p: Punto): string {
  const g = (n: number) => Math.abs(n).toFixed(4).replace('.', ',')
  return `${g(p.lat)}° ${p.lat < 0 ? 'S' : 'N'} · ${g(p.lng)}° ${p.lng < 0 ? 'O' : 'E'}`
}

/** Marco común del mapa: misma proporción y bordes en la página del evento y en el formulario. */
export function MarcoMapa({ children, instruccion, invalido, className }: {
  children: ReactNode; instruccion?: string | null; invalido?: boolean; className?: string
}) {
  return (
    <div className={cx('relative isolate aspect-[16/10] overflow-hidden rounded-lg border bg-hundido',
      invalido ? 'border-error ring-2 ring-error/15' : 'border-linea', className)}>
      {children}
      {instruccion && (
        <p className="pointer-events-none absolute inset-x-0 top-3 z-10 mx-auto flex w-max max-w-[90%] items-center gap-1.5 rounded-full bg-tinta/85 px-3 py-1.5 text-[13px] font-medium text-white shadow-panel">
          <Crosshair className="size-4 shrink-0" />{instruccion}
        </p>
      )}
    </div>
  )
}

/**
 * Página del evento (CA-02 a CA-04). Un evento virtual no muestra nada: la regla queda aquí y la página
 * no tiene que repetirla. Si no hay punto marcado, se ve la dirección sin mapa ni botón.
 */
export function BloqueUbicacion({ modalidad, lugar, inicio, mapa, enlaceIndicaciones }: {
  modalidad: string
  lugar: string | null
  /** Fecha y hora de inicio (ISO). */
  inicio: string
  /** El mapa con el punto (CAP-105). Null si el evento no tiene coordenadas. */
  mapa?: ReactNode
  /** Enlace a las indicaciones en Google Maps (lo arma CAP-105). */
  enlaceIndicaciones?: string | null
}) {
  const titulo = useId()
  if (modalidad === 'virtual' || !lugar) return null
  return (
    <Panel className="overflow-hidden">
      <section aria-labelledby={titulo}>
        <h2 id={titulo} className="sr-only">{TEXTOS_UBICACION.titulo}</h2>
        {mapa && <MarcoMapa className="rounded-none border-0 border-b">{mapa}</MarcoMapa>}
        <div className="space-y-3 p-5">
          <ul className="space-y-2 text-[14px] text-tinta-2">
            <li className="flex gap-2.5"><MapPin weight="fill" className="mt-0.5 size-[18px] shrink-0 text-grana" />
              <span className="font-medium text-tinta">{lugar}</span></li>
            <li className="flex gap-2.5"><CalendarBlank className="mt-0.5 size-[18px] shrink-0 text-tinta-3" />
              <span><span className="first-letter:uppercase">{fechaLarga(inicio)}</span>, empieza a las {hora(inicio)} h</span></li>
          </ul>
          {mapa && enlaceIndicaciones ? (
            <a href={enlaceIndicaciones} target="_blank" rel="noreferrer"
              aria-label={`${TEXTOS_UBICACION.comoLlegar} a ${lugar} (abre Google Maps en otra pestaña)`}
              className="pulsable inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-grana px-4 text-[15px] font-medium text-white no-underline hover:bg-grana-hover">
              <NavigationArrow weight="fill" className="size-4" />{TEXTOS_UBICACION.comoLlegar}
            </a>
          ) : !mapa ? (
            <p className="text-[13px] text-tinta-3">{TEXTOS_UBICACION.sinPunto}</p>
          ) : null}
        </div>
      </section>
    </Panel>
  )
}

/**
 * Formulario de crear y editar evento (CA-01). El campo «Lugar» sirve también para buscar: al elegir una
 * sugerencia se llena el texto y se marca el punto. Tocar el mapa mueve el punto sin borrar lo escrito.
 */
export function SelectorUbicacion({
  lugar, onLugar, sugerencias = [], onElegir, buscando = false, sinResultados = false, punto, onQuitarPunto, mapa, error, errorLugar,
}: {
  lugar: string
  onLugar: (v: string) => void
  sugerencias?: Sugerencia[]
  onElegir?: (id: string) => void
  buscando?: boolean
  /** La búsqueda terminó sin direcciones: se sugiere tocar el mapa. */
  sinResultados?: boolean
  punto: Punto | null
  onQuitarPunto: () => void
  /** El mapa interactivo (CAP-105): al tocarlo avisa el punto elegido. */
  mapa: ReactNode
  /** Error del punto (por ejemplo, coordenadas fuera de rango, CA-05). */
  error?: string | null
  /** Error del texto del lugar (CA-07 de la HU-02). */
  errorLugar?: string | null
}) {
  const id = useId()
  const listaAbierta = buscando || sinResultados || sugerencias.length > 0
  return (
    // min-w-0: un fieldset no se encoge por debajo de su contenido; sin esto una sugerencia larga desborda en celular.
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-[13px] font-medium text-tinta-2">Lugar y punto en el mapa</legend>
      <div className="relative">
        <MagnifyingGlass className="pointer-events-none absolute left-3 top-[22px] size-[18px] -translate-y-1/2 text-tinta-3" />
        <Entrada id={`${id}-lugar`} value={lugar} onChange={(e) => onLugar(e.target.value)} className="pl-10"
          placeholder="Auditorio, pabellón, calle o local" autoComplete="off" invalido={!!errorLugar}
          role="combobox" aria-expanded={sugerencias.length > 0} aria-controls={`${id}-sug`}
          aria-describedby={`${id}-ayuda`} aria-label="Lugar del evento" />
        {listaAbierta && (
          <ul id={`${id}-sug`} role="listbox" aria-label="Direcciones sugeridas"
            // [contain:inline-size]: los nombres largos se cortan con «…» y no ensanchan el formulario en celular.
            className="mt-1 divide-y divide-linea overflow-hidden rounded-lg border border-linea bg-superficie shadow-panel [contain:inline-size]">
            {buscando || sinResultados ? (
              <li className="px-3 py-2.5 text-[13px] text-tinta-3" aria-live="polite">
                {buscando ? TEXTOS_UBICACION.buscando : TEXTOS_UBICACION.sinResultados}
              </li>
            ) : sugerencias.map((s) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button type="button" onClick={() => onElegir?.(s.id)}
                  className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-fondo">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-tinta-3" />
                  <span className="min-w-0"><span className="block truncate text-[14px] text-tinta">{s.nombre}</span>
                    {s.detalle && <span className="block truncate text-[12px] text-tinta-3">{s.detalle}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p id={`${id}-ayuda`} className={cx('text-[13px]', errorLugar ? 'text-error' : 'text-tinta-3')} role={errorLugar ? 'alert' : undefined}>
        {errorLugar ?? TEXTOS_UBICACION.ayudaLugar}
      </p>

      <MarcoMapa instruccion={punto ? null : TEXTOS_UBICACION.instruccion} invalido={!!error}>{mapa}</MarcoMapa>

      {error ? (
        <p className="text-[13px] text-error" role="alert">{error}</p>
      ) : punto ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-chilca-clara/60 px-3 py-2">
          <p className="text-[13px] text-tinta-2">
            <span className="font-medium text-tinta">{TEXTOS_UBICACION.marcado}:</span> <span className="num">{textoPunto(punto)}</span>
          </p>
          <Boton variante="fantasma" tamano="sm" icono={<X className="size-3.5" weight="bold" />} onClick={onQuitarPunto}>
            {TEXTOS_UBICACION.quitar}
          </Boton>
        </div>
      ) : null}
    </fieldset>
  )
}
