import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, EnvelopeSimple, EnvelopeSimpleOpen } from '@phosphor-icons/react'
import type { Correo } from '../lib/tipos'
import { fechaHora, relativo } from '../lib/formato'
import { useApp } from '../lib/app'
import { cx, Vacio } from './ui'

const TIPO: Record<string, string> = {
  confirmacion: 'Cuenta', inscripcion: 'Inscripción', pago: 'Pago', lista_espera: 'Lista de espera', recordatorio: 'Recordatorio',
  certificado: 'Certificado', encuesta: 'Encuesta', cancelacion: 'Cancelación', cambio_evento: 'Cambio de evento',
  programa: 'Programa', enlace: 'Enlace virtual',
}

export function Buzon({ correos, onAbrir }: { correos: Correo[]; onAbrir?: (c: Correo) => void }) {
  const { ahora } = useApp()
  const [abierto, setAbierto] = useState<Correo | null>(null)

  useEffect(() => {
    if (abierto && !correos.some((c) => c.id === abierto.id)) setAbierto(null)
  }, [correos, abierto])

  if (correos.length === 0) {
    return <Vacio icono={<EnvelopeSimple className="size-6" />} titulo="No hay correos">Los avisos de inscripción, pagos, recordatorios y certificados llegarán aquí.</Vacio>
  }

  const abrir = (c: Correo) => {
    setAbierto(c)
    if (!c.leido) onAbrir?.(c)
  }

  return (
    <div className="grid min-h-[480px] overflow-hidden rounded-xl border border-linea bg-superficie md:grid-cols-[minmax(280px,380px)_1fr]">
      <ul className={cx('max-h-[70dvh] divide-y divide-linea overflow-y-auto md:border-r md:border-linea', abierto && 'hidden md:block')}>
        {correos.map((c) => (
          <li key={c.id}>
            <button onClick={() => abrir(c)} aria-current={abierto?.id === c.id}
              className={cx('block w-full px-4 py-3.5 text-left transition-colors',
                abierto?.id === c.id ? 'bg-grana-clara/45' : 'hover:bg-fondo')}>
              <span className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-xs text-tinta-3">
                  {!c.leido && <span className="size-2 rounded-full bg-grana" aria-label="Sin leer" />}
                  {TIPO[c.tipo] ?? c.tipo}
                </span>
                <span className="num shrink-0 text-xs text-tinta-3">{relativo(c.enviado_en, ahora())}</span>
              </span>
              <span className={cx('mt-1 block truncate text-sm', c.leido ? 'text-tinta-2' : 'font-semibold text-tinta')}>{c.asunto}</span>
              <span className="mt-0.5 block truncate text-[13px] text-tinta-3">{c.cuerpo.replace(/\s+/g, ' ').slice(0, 90)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className={cx('min-w-0', !abierto && 'hidden md:block')}>
        {abierto ? <Lectura c={abierto} onVolver={() => setAbierto(null)} /> : (
          <div className="grid h-full place-items-center p-10 text-center text-sm text-tinta-3">
            <span className="flex flex-col items-center gap-2"><EnvelopeSimpleOpen className="size-8" />Elige un correo para leerlo.</span>
          </div>
        )}
      </div>
    </div>
  )
}

function Lectura({ c, onVolver }: { c: Correo; onVolver: () => void }) {
  const externo = c.accion_url?.startsWith('http')
  return (
    <article className="aparece p-5 sm:p-7">
      <button onClick={onVolver} className="mb-4 inline-flex items-center gap-1.5 text-sm text-tinta-3 md:hidden">
        <ArrowLeft className="size-4" /> Volver
      </button>
      <p className="text-xs text-tinta-3">{TIPO[c.tipo] ?? c.tipo} · {fechaHora(c.enviado_en)}</p>
      <h2 className="mt-1.5 text-xl font-semibold leading-snug">{c.asunto}</h2>
      <p className="mt-1 text-[13px] text-tinta-3">De: CAPACITRON &lt;notificaciones@capacitron.pe&gt; · Para: {c.para}</p>
      <div className="mt-6 max-w-[62ch] whitespace-pre-line text-[15px] leading-relaxed text-tinta-2">{c.cuerpo}</div>
      {c.accion_url && c.accion_texto && (
        externo ? (
          <a href={c.accion_url} target="_blank" rel="noreferrer"
            className="pulsable mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-grana px-5 text-sm font-medium text-white no-underline hover:bg-grana-hover">
            {c.accion_texto}<ArrowSquareOut className="size-4" />
          </a>
        ) : (
          <Link to={c.accion_url}
            className="pulsable mt-6 inline-flex h-11 items-center rounded-lg bg-grana px-5 text-sm font-medium text-white no-underline hover:bg-grana-hover">
            {c.accion_texto}
          </Link>
        )
      )}
    </article>
  )
}
