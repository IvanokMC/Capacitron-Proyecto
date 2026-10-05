// Gesto característico: el estado del evento se teje. Cada celda de la banda es
// un asiento (o un grupo de asientos en eventos grandes); los tintes indican su estado.
import { useEffect, useRef, useState } from 'react'
import type { EstadoInscripcion, FaseEvento } from '../lib/tipos'
import { dia, diaSemana, mes, num } from '../lib/formato'
import { cx, Insignia, type Tinte } from './ui'

interface BandaProps {
  total: number
  /** Vista pública: solo se conoce cuántos cupos están tomados. */
  ocupados?: number
  /** Vista del organizador: desglose por estado. */
  confirmados?: number
  pendientes?: number
  ofrecidos?: number
  compacta?: boolean
  leyenda?: boolean
  animar?: boolean
  className?: string
}

export function BandaCupos({
  total, ocupados, confirmados, pendientes = 0, ofrecidos = 0, compacta, leyenda, animar, className,
}: BandaProps) {
  const desglose = confirmados !== undefined
  const tomados = desglose ? confirmados + pendientes + ofrecidos : (ocupados ?? 0)
  const maxCeldas = compacta ? 40 : 60
  const celdas = Math.min(total, maxCeldas)
  const porCelda = total / celdas
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(!animar)

  // Se teje una sola vez, cuando la banda entra en pantalla.
  useEffect(() => {
    if (!animar || !ref.current) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setVisible(true)
        io.disconnect()
      }
    }, { threshold: 0.3 })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [animar])

  const tipoCelda = (i: number) => {
    const asiento = (i + 0.5) * porCelda
    if (!desglose) return asiento <= tomados ? 'tomado' : 'libre'
    if (asiento <= confirmados!) return 'confirmado'
    if (asiento <= confirmados! + pendientes) return 'pendiente'
    if (asiento <= tomados) return 'ofrecido'
    return 'libre'
  }

  const clase: Record<string, string> = {
    tomado: 'bg-tinta-2',
    confirmado: 'bg-chilca-viva',
    pendiente: 'bg-qolle',
    ofrecido: 'bg-anil-clara shadow-[inset_0_0_0_1.5px_var(--color-anil-viva)]',
    libre: 'bg-crudo',
  }

  const disponibles = Math.max(total - tomados, 0)
  const etiqueta = desglose
    ? `${tomados} de ${total} cupos ocupados: ${confirmados} confirmados, ${pendientes} con pago pendiente, ${ofrecidos} ofrecidos a la lista de espera.`
    : `${tomados} de ${total} cupos ocupados; quedan ${disponibles}.`

  return (
    <div className={className}>
      <div
        ref={ref}
        role="img"
        aria-label={etiqueta}
        className={cx('grid gap-[2px]', visible && animar && 'banda-anima', !visible && 'opacity-0')}
        style={{ gridTemplateColumns: `repeat(${celdas}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: celdas }, (_, i) => (
          <span
            key={i}
            style={{ ['--i' as string]: i }}
            className={cx('celda block origin-bottom rounded-[1.5px]', compacta ? 'h-2' : 'h-3.5', clase[tipoCelda(i)])}
          />
        ))}
      </div>
      {leyenda && (
        <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-tinta-3">
          {desglose ? (
            <>
              <Muestra c="bg-chilca-viva" t={`Confirmados ${num(confirmados!)}`} />
              {pendientes > 0 && <Muestra c="bg-qolle" t={`Pago pendiente ${num(pendientes)}`} />}
              {ofrecidos > 0 && <Muestra c="bg-anil-clara shadow-[inset_0_0_0_1.5px_var(--color-anil-viva)]" t={`Ofrecidos ${num(ofrecidos)}`} />}
              <Muestra c="bg-crudo" t={`Libres ${num(disponibles)}`} />
            </>
          ) : (
            <>
              <Muestra c="bg-tinta-2" t={`Ocupados ${num(tomados)}`} />
              <Muestra c="bg-crudo" t={`Libres ${num(disponibles)}`} />
            </>
          )}
          {porCelda > 1.01 && <span>Cada celda ≈ {Math.round(porCelda)} cupos</span>}
        </div>
      )}
    </div>
  )
}

function Muestra({ c, t }: { c: string; t: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cx('inline-block size-2.5 rounded-[1.5px]', c)} />
      <span className="num">{t}</span>
    </span>
  )
}

/** Cuadros de tocapu: uno por jornada; teñido si asistió. */
export function Jornadas({ asistidas, total, tamano = 'size-3.5' }: { asistidas: number; total: number; tamano?: string }) {
  return (
    <span className="inline-flex items-center gap-2" role="img"
      aria-label={`Asistió a ${asistidas} de ${total} ${total === 1 ? 'jornada' : 'jornadas'}`}>
      <span className="inline-flex gap-[3px]">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cx(tamano, 'rounded-[2px]',
            i < asistidas ? 'bg-chilca-viva' : 'bg-transparent shadow-[inset_0_0_0_1.5px_var(--color-linea-fuerte)]')} />
        ))}
      </span>
      <span className="num text-xs text-tinta-3">{asistidas}/{total}</span>
    </span>
  )
}

/** Fecha con el día a escala monumental. */
export function BloqueFecha({ fecha, fase, grande }: { fecha: string; fase?: FaseEvento; grande?: boolean }) {
  const enCurso = fase === 'en_curso'
  return (
    <div className={cx('flex shrink-0 flex-col items-center justify-center rounded-lg text-center',
      grande ? 'w-[76px] py-2.5' : 'w-14 py-1.5',
      enCurso ? 'bg-chilca text-white' : 'bg-hundido text-tinta')}>
      <span className={cx('text-[11px] font-medium uppercase tracking-wide', enCurso ? 'text-white/85' : 'text-tinta-3')}>{diaSemana(fecha)}</span>
      <span className={cx('num font-semibold leading-none tracking-[-0.04em]', grande ? 'text-[38px]' : 'text-[26px]')}>{dia(fecha)}</span>
      <span className={cx('text-xs font-medium', enCurso ? 'text-white/85' : 'text-tinta-2')}>{mes(fecha)}</span>
    </div>
  )
}

export function InsigniaFase({ fase }: { fase: FaseEvento }) {
  const m: Record<FaseEvento, [Tinte, string]> = {
    borrador: ['qolle', 'Borrador'],
    cancelado: ['error', 'Cancelado'],
    proximo: ['anil', 'Próximo'],
    en_curso: ['chilca', 'En curso'],
    finalizado: ['neutro', 'Finalizado'],
  }
  const [t, txt] = m[fase]
  return <Insignia tinte={t}>{txt}</Insignia>
}

export function InsigniaInscripcion({ estado }: { estado: EstadoInscripcion }) {
  const m: Record<EstadoInscripcion, [Tinte, string]> = {
    confirmada: ['chilca', 'Confirmada'],
    pendiente_pago: ['qolle', 'Pendiente de pago'],
    cancelada: ['neutro', 'Cancelada'],
    expirada: ['neutro', 'Reserva vencida'],
  }
  const [t, txt] = m[estado]
  return <Insignia tinte={t}>{txt}</Insignia>
}

/** Marca: un cuadro de tocapu de cuatro celdas. */
export function Marca({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect x="2" y="2" width="13" height="13" rx="1.5" fill="#f4f5f8" />
      <rect x="17" y="2" width="13" height="13" rx="1.5" fill="#e2a20a" />
      <rect x="2" y="17" width="13" height="13" rx="1.5" fill="#4b9658" />
      <rect x="17" y="17" width="13" height="13" rx="1.5" fill="#f4f5f8" />
      <rect x="20.5" y="20.5" width="6" height="6" rx="1" fill="#9d1748" />
    </svg>
  )
}
