import {
  forwardRef, useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode,
  type SelectHTMLAttributes, type TextareaHTMLAttributes,
} from 'react'
import { Link } from 'react-router-dom'
import { CircleNotch, Info, Warning, WarningCircle, CheckCircle, X } from '@phosphor-icons/react'
import { iniciales } from '../lib/formato'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro' | 'exito'
type Tamano = 'sm' | 'md' | 'lg'

const VARIANTES: Record<Variante, string> = {
  primario: 'bg-grana text-white hover:bg-grana-hover shadow-[0_1px_0_rgb(255_255_255/0.12)_inset,0_1px_2px_rgb(110_14_49/0.3)]',
  secundario: 'bg-superficie text-tinta border border-linea-fuerte hover:border-tinta-3 hover:bg-fondo',
  fantasma: 'text-tinta-2 hover:bg-hundido hover:text-tinta',
  peligro: 'bg-superficie text-error border border-error/40 hover:bg-error-clara hover:border-error focus-visible:bg-error-clara',
  exito: 'bg-chilca text-white hover:bg-[#245a30]',
}
const TAMANOS: Record<Tamano, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-lg',
}

interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante
  tamano?: Tamano
  cargando?: boolean
  icono?: ReactNode
}

export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = 'secundario', tamano = 'md', cargando, icono, className, children, disabled, type = 'button', ...resto },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={cx(
        'pulsable inline-flex select-none items-center justify-center whitespace-nowrap font-medium',
        'disabled:cursor-not-allowed disabled:opacity-55',
        VARIANTES[variante], TAMANOS[tamano], className,
      )}
      {...resto}
    >
      {cargando ? <CircleNotch className="size-4 animate-spin" weight="bold" /> : icono}
      {children}
    </button>
  )
})

export function BotonEnlace({
  to, variante = 'secundario', tamano = 'md', icono, className, children,
}: { to: string; variante?: Variante; tamano?: Tamano; icono?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className={cx('pulsable inline-flex items-center justify-center whitespace-nowrap font-medium no-underline',
        VARIANTES[variante], TAMANOS[tamano], className)}
    >
      {icono}
      {children}
    </Link>
  )
}

// ---------------------------------------------------------------------------
// Campos de formulario (etiqueta arriba, ayuda y error debajo)
// ---------------------------------------------------------------------------

const BASE_ENTRADA =
  'w-full rounded-lg border bg-superficie px-3 text-[15px] text-tinta placeholder:text-tinta-3/80 ' +
  'transition-[border-color,box-shadow] duration-150 outline-none ' +
  'focus:border-grana focus:shadow-[0_0_0_3px_rgb(157_23_72/0.14)] disabled:bg-hundido disabled:text-tinta-3'

export function Campo({
  etiqueta, ayuda, error, children, opcional, className, htmlFor,
}: {
  etiqueta: ReactNode; ayuda?: ReactNode; error?: string | null | false; children: ReactNode; opcional?: boolean
  className?: string; htmlFor?: string
}) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-tinta-2">
        {etiqueta}
        {opcional && <span className="ml-1 font-normal text-tinta-3">(opcional)</span>}
      </label>
      {children}
      {error ? (
        <p className="flex items-start gap-1.5 text-[13px] text-error" role="alert">
          <WarningCircle className="mt-px size-4 shrink-0" weight="fill" />
          {error}
        </p>
      ) : ayuda ? (
        <p className="text-[13px] text-tinta-3">{ayuda}</p>
      ) : null}
    </div>
  )
}

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalido?: boolean }>(
  function Entrada({ invalido, className, ...p }, ref) {
    return (
      <input
        ref={ref}
        aria-invalid={invalido || undefined}
        className={cx(BASE_ENTRADA, 'h-11', invalido ? 'border-error bg-error-clara/40' : 'border-linea-fuerte', className)}
        {...p}
      />
    )
  },
)

export function Selector({ invalido, className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { invalido?: boolean }) {
  return (
    <select
      aria-invalid={invalido || undefined}
      className={cx(BASE_ENTRADA, 'h-11 cursor-pointer appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9',
        "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 256 256'%3E%3Cpath fill='%235f6584' d='M213.66 101.66l-80 80a8 8 0 0 1-11.32 0l-80-80a8 8 0 0 1 11.32-11.32L128 164.69l74.34-74.35a8 8 0 0 1 11.32 11.32Z'/%3E%3C/svg%3E\")]",
        invalido ? 'border-error' : 'border-linea-fuerte', className)}
      {...p}
    >
      {children}
    </select>
  )
}

export function AreaTexto({ invalido, className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalido?: boolean }) {
  return (
    <textarea
      aria-invalid={invalido || undefined}
      className={cx(BASE_ENTRADA, 'min-h-28 py-2.5 leading-relaxed', invalido ? 'border-error bg-error-clara/40' : 'border-linea-fuerte', className)}
      {...p}
    />
  )
}

export function Casilla({
  checked, onChange, children, invalido, id,
}: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; invalido?: boolean; id?: string }) {
  const auto = useId()
  const cid = id ?? auto
  return (
    <label htmlFor={cid} className="flex cursor-pointer items-start gap-2.5 text-sm text-tinta-2">
      <input
        id={cid}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-invalid={invalido || undefined}
        className={cx('mt-0.5 size-[18px] shrink-0 cursor-pointer rounded accent-grana', invalido && 'outline-2 outline-error')}
      />
      <span>{children}</span>
    </label>
  )
}

/** Interruptor accesible (role=switch). */
export function Interruptor({ activo, onChange, etiqueta, descripcion }: {
  activo: boolean; onChange: (v: boolean) => void; etiqueta: string; descripcion?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      onClick={() => onChange(!activo)}
      className="flex w-full items-start justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-sm font-medium text-tinta">{etiqueta}</span>
        {descripcion && <span className="mt-0.5 block text-[13px] text-tinta-3">{descripcion}</span>}
      </span>
      <span className={cx('relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-200',
        activo ? 'bg-chilca' : 'bg-linea-fuerte')}>
        <span className={cx('absolute top-0.5 size-5 rounded-full bg-white shadow transition-transform duration-200 ease-[var(--ease-salida)]',
          activo ? 'translate-x-[18px]' : 'translate-x-0.5')} />
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Insignias de estado (tintes)
// ---------------------------------------------------------------------------

export type Tinte = 'grana' | 'chilca' | 'qolle' | 'anil' | 'error' | 'neutro'

const TINTES: Record<Tinte, string> = {
  grana: 'bg-grana-clara text-grana-tinta',
  chilca: 'bg-chilca-clara text-chilca',
  qolle: 'bg-qolle-clara text-qolle-tinta',
  anil: 'bg-anil-clara text-anil',
  error: 'bg-error-clara text-error',
  neutro: 'bg-hundido text-tinta-2',
}
const PUNTOS: Record<Tinte, string> = {
  grana: 'bg-grana', chilca: 'bg-chilca-viva', qolle: 'bg-qolle', anil: 'bg-anil-viva', error: 'bg-error', neutro: 'bg-tinta-3',
}

export function Insignia({ tinte = 'neutro', children, punto = true, className }: {
  tinte?: Tinte; children: ReactNode; punto?: boolean; className?: string
}) {
  return (
    <span className={cx('inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-xs font-medium',
      TINTES[tinte], className)}>
      {punto && <span className={cx('size-1.5 rounded-[1px]', PUNTOS[tinte])} aria-hidden />}
      {children}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Avisos en línea
// ---------------------------------------------------------------------------

export function Aviso({ tipo = 'info', titulo, children, accion, className }: {
  tipo?: 'info' | 'exito' | 'alerta' | 'error'; titulo?: ReactNode; children?: ReactNode; accion?: ReactNode; className?: string
}) {
  const estilos = {
    info: ['bg-anil-clara/70 border-anil/15 text-anil', Info],
    exito: ['bg-chilca-clara border-chilca/15 text-chilca', CheckCircle],
    alerta: ['bg-qolle-clara border-qolle/30 text-qolle-tinta', Warning],
    error: ['bg-error-clara border-error/20 text-error', WarningCircle],
  } as const
  const [clase, Icono] = estilos[tipo]
  return (
    <div role={tipo === 'error' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border px-4 py-3', clase, className)}>
      <Icono className="mt-0.5 size-5 shrink-0" weight="fill" />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        {titulo && <p className="font-semibold">{titulo}</p>}
        {children && <div className="text-tinta-2">{children}</div>}
        {accion && <div className="mt-2.5">{accion}</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Diálogo (elemento <dialog> nativo: foco atrapado y Esc para cerrar)
// ---------------------------------------------------------------------------

export function Dialogo({ abierto, onCerrar, titulo, descripcion, children, ancho = 'max-w-lg', pie }: {
  abierto: boolean; onCerrar: () => void; titulo: ReactNode; descripcion?: ReactNode; children?: ReactNode
  ancho?: string; pie?: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (abierto && !d.open) d.showModal()
    if (!abierto && d.open) d.close()
  }, [abierto])
  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onCancel={(e) => { e.preventDefault(); onCerrar() }}
      onClick={(e) => { if (e.target === ref.current) onCerrar() }}
      className={cx('m-auto w-[calc(100%-2rem)] rounded-2xl bg-superficie p-0 text-tinta shadow-flotante backdrop:bg-tinta/40', ancho)}
    >
      {abierto && (
        <div className="aparece flex max-h-[85dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-linea px-5 py-4">
            <div>
              <h2 className="text-lg font-semibold">{titulo}</h2>
              {descripcion && <p className="mt-0.5 text-sm text-tinta-3">{descripcion}</p>}
            </div>
            <button onClick={onCerrar} className="pulsable -mr-1 rounded-lg p-1.5 text-tinta-3 hover:bg-hundido hover:text-tinta" aria-label="Cerrar">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {pie && <div className="flex flex-wrap justify-end gap-2 border-t border-linea bg-fondo/60 px-5 py-3">{pie}</div>}
        </div>
      )}
    </dialog>
  )
}

// ---------------------------------------------------------------------------
// Pestañas (patrón ARIA tabs)
// ---------------------------------------------------------------------------

export function Pestanas<T extends string>({ opciones, valor, onCambio, etiqueta }: {
  opciones: { valor: T; texto: string; cuenta?: number | null }[]; valor: T; onCambio: (v: T) => void; etiqueta: string
}) {
  return (
    <div role="tablist" aria-label={etiqueta} className="-mb-px flex gap-1 overflow-x-auto border-b border-linea">
      {opciones.map((o) => {
        const activa = o.valor === valor
        return (
          <button
            key={o.valor}
            role="tab"
            aria-selected={activa}
            onClick={() => onCambio(o.valor)}
            className={cx('relative flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition-colors',
              activa ? 'text-tinta' : 'text-tinta-3 hover:text-tinta')}
          >
            {o.texto}
            {o.cuenta != null && (
              <span className={cx('num rounded-full px-1.5 py-px text-[11px]', activa ? 'bg-grana-clara text-grana-tinta' : 'bg-hundido text-tinta-3')}>
                {o.cuenta}
              </span>
            )}
            <span className={cx('absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-colors', activa ? 'bg-grana' : 'bg-transparent')} />
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------

export function Panel({ children, className, as: Tag = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <Tag className={cx('rounded-xl border border-linea bg-superficie', className)}>{children}</Tag>
}

export function EncabezadoPagina({ titulo, descripcion, acciones, volver }: {
  titulo: ReactNode; descripcion?: ReactNode; acciones?: ReactNode; volver?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {volver}
        <h1 className="text-[26px] font-semibold leading-tight sm:text-3xl">{titulo}</h1>
        {descripcion && <p className="mt-1.5 max-w-[65ch] text-[15px] text-tinta-3">{descripcion}</p>}
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </div>
  )
}

export function Vacio({ icono, titulo, children, accion }: { icono?: ReactNode; titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icono && <div className="mb-3 grid size-12 place-items-center rounded-xl bg-hundido text-tinta-3">{icono}</div>}
      <p className="font-semibold text-tinta">{titulo}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-tinta-3">{children}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cx('esqueleto', className)} aria-hidden />
}

export function CargandoLista({ filas = 4 }: { filas?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: filas }, (_, i) => (
        <div key={i} className="flex gap-4 rounded-xl border border-linea bg-superficie p-4">
          <Esqueleto className="h-14 w-12" />
          <div className="flex-1 space-y-2.5 py-1">
            <Esqueleto className="h-4 w-2/3" />
            <Esqueleto className="h-3 w-1/3" />
            <Esqueleto className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function Avatar({ nombre, foto, tamano = 'size-10' }: { nombre: string; foto?: string | null; tamano?: string }) {
  if (foto) return <img src={foto} alt="" className={cx(tamano, 'shrink-0 rounded-lg object-cover')} />
  return (
    <span aria-hidden className={cx(tamano, 'grid shrink-0 place-items-center rounded-lg bg-anil-clara text-[13px] font-semibold text-anil')}>
      {iniciales(nombre)}
    </span>
  )
}

/** Dato con etiqueta: cifra grande, etiqueta pequeña debajo. */
export function Cifra({ valor, etiqueta, tinte, detalle }: { valor: ReactNode; etiqueta: string; tinte?: string; detalle?: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className={cx('num text-[28px] font-semibold leading-none tracking-[-0.03em]', tinte)}>{valor}</p>
      <p className="mt-1.5 text-[13px] text-tinta-3">{etiqueta}</p>
      {detalle && <p className="mt-0.5 text-xs text-tinta-3">{detalle}</p>}
    </div>
  )
}
