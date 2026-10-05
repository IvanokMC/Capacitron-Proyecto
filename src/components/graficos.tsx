// Gráficos ligeros en HTML: barras de 14 px con extremo redondeado de 4 px desde
// una línea base, texto en tinta (nunca en el color de la serie) y tooltip por marca.
import { useState, type ReactNode } from 'react'
import { cx } from './ui'

export interface FilaBarra {
  clave: string
  etiqueta: ReactNode
  valor: number
  /** Texto en el extremo de la barra. */
  rotulo: string
  /** Contenido del tooltip. */
  detalle?: ReactNode
}

/** Barras horizontales de una sola serie (sin leyenda: el título nombra la serie). */
export function BarrasH({ filas, maximo, color = 'bg-chilca-viva', titulo }: {
  filas: FilaBarra[]; maximo?: number; color?: string; titulo: string
}) {
  const max = maximo ?? Math.max(...filas.map((f) => f.valor), 1)
  const [activa, setActiva] = useState<string | null>(null)
  return (
    <figure>
      <figcaption className="sr-only">{titulo}</figcaption>
      <ul className="space-y-3">
        {filas.map((f) => {
          const pct = max > 0 ? Math.max((f.valor / max) * 100, f.valor > 0 ? 1.5 : 0) : 0
          return (
            <li key={f.clave} className="grid grid-cols-[minmax(0,1fr)] gap-1.5 sm:grid-cols-[minmax(140px,240px)_minmax(0,1fr)] sm:items-center sm:gap-4">
              <span className="truncate text-[13px] text-tinta-2">{f.etiqueta}</span>
              <div
                className="relative flex items-center gap-2"
                tabIndex={0}
                onMouseEnter={() => setActiva(f.clave)}
                onMouseLeave={() => setActiva(null)}
                onFocus={() => setActiva(f.clave)}
                onBlur={() => setActiva(null)}
                aria-label={`${typeof f.etiqueta === 'string' ? f.etiqueta : ''}: ${f.rotulo}`}
              >
                <div className="relative h-3.5 flex-1">
                  <div className="absolute inset-y-0 left-0 w-px bg-linea-fuerte" aria-hidden />
                  <div className={cx('h-full rounded-r-[4px] transition-[width] duration-500 ease-[var(--ease-salida)]', color,
                    activa && activa !== f.clave && 'opacity-45')} style={{ width: `${pct}%` }} />
                </div>
                <span className="num w-[72px] shrink-0 text-[13px] font-medium text-tinta">{f.rotulo}</span>
                {activa === f.clave && f.detalle && (
                  <div role="tooltip" className="aparece pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-10 whitespace-nowrap rounded-lg bg-tinta px-3 py-2 text-xs text-white shadow-flotante">
                    {f.detalle}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

// Escala ordinal 1–5: un solo tono (añil), de claro a oscuro.
export const ESCALA_ANIL = ['#c9d2f0', '#9dacE2', '#6f84cf', '#4a60b4', '#2b3e8e']

/** Distribución de respuestas 1–5 como barra apilada con separación de 2 px. */
export function Distribucion({ conteos, etiqueta }: { conteos: number[]; etiqueta: string }) {
  const total = conteos.reduce((a, b) => a + b, 0)
  const [activo, setActivo] = useState<number | null>(null)
  if (total === 0) return <div className="h-3.5 rounded bg-hundido" aria-label={`${etiqueta}: sin respuestas`} />
  return (
    <div className="relative">
      <div className="flex h-3.5 gap-[2px]" role="img"
        aria-label={`${etiqueta}: ${conteos.map((c, i) => `${c} respondieron ${i + 1}`).join(', ')}`}>
        {conteos.map((c, i) => c > 0 && (
          <span key={i}
            onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}
            className={cx('h-full first:rounded-l-[4px] last:rounded-r-[4px] transition-opacity', activo !== null && activo !== i && 'opacity-50')}
            style={{ width: `${(c / total) * 100}%`, background: ESCALA_ANIL[i] }} />
        ))}
      </div>
      {activo !== null && (
        <div role="tooltip" className="aparece pointer-events-none absolute bottom-[calc(100%+6px)] left-0 z-10 rounded-lg bg-tinta px-3 py-2 text-xs text-white shadow-flotante">
          Puntaje {activo + 1}: {conteos[activo]} {conteos[activo] === 1 ? 'respuesta' : 'respuestas'} ({Math.round((conteos[activo] / total) * 100)} %)
        </div>
      )}
    </div>
  )
}

export function LeyendaEscala() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-tinta-3">
      {ESCALA_ANIL.map((c, i) => (
        <span key={c} className="inline-flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-[2px]" style={{ background: c }} />
          {i + 1}{i === 0 ? ' (muy mal)' : i === 4 ? ' (excelente)' : ''}
        </span>
      ))}
    </div>
  )
}
