// CAP-88 · Diseño del pago real y de la bandeja de verificación (HU-16, CA-01 a CA-04 y CA-06).
// Rol: Diseño UI/UX (Medaly). Diseño completo en docs/diseno/CAP-88-pago-real/DISENO.md.
//
// Teoría de Diseño de Software:
// · Separación de responsabilidades (diap. 6 y 19): el pago es una pantalla propia, separada de la lista de
//   inscripciones; estos componentes no saben de inscripciones ni de la API.
// · OCP y Strategy (diap. 50–63 y 117–125): cada medio de pago es una entrada de MEDIOS_PAGO con su propio
//   panel. Agregar un medio (por ejemplo Plin) es sumar una entrada, sin tocar SelectorMedioPago ni la pantalla.
// · Cohesión (diap. 26–28): piezas visuales reutilizables; la captura del comprobante usa el mismo CampoImagen
//   del flyer (CAP-108).
// · SRP (diap. 39–49): aquí solo se muestra. Registrar, aprobar o rechazar el pago es de CAP-89 y CAP-90.
import { useId, type ReactNode } from 'react'
import { Bank, CheckCircle, Clock, Copy, QrCode, WarningCircle, WhatsappLogo, XCircle } from '@phosphor-icons/react'
import { AreaTexto, Boton, Campo, cx, Entrada, Insignia, Panel } from './ui'
import { CampoImagen } from './ImagenEvento'
import { soles } from '../lib/formato'

export type Medio = 'yape' | 'transferencia' | 'whatsapp'
export type EstadoPagoManual = 'por_verificar' | 'aprobado' | 'rechazado'

/** Datos que configura la administración (CA-06). Los nombres siguen a la tarea de backend (CAP-89). */
export interface ConfigPagos {
  yape_qr: string | null
  yape_titular: string
  banco: string
  cuenta: string
  cci: string
  titular: string
  whatsapp: string
}

export const TEXTOS_PAGO = {
  titulo: 'Paga tu inscripción',
  ayudaMedio: 'Elige cómo pagar. Después registra el número de operación y la captura para que la organización lo verifique.',
  reserva: (hasta: string) => `Tu cupo está reservado hasta las ${hasta}.`,
  operacion: 'Número de operación',
  ayudaOperacion: 'Aparece en la constancia de Yape o de tu banco.',
  comprobante: 'Captura del comprobante',
  ayudaComprobante: 'Solo la ven tú y la administración.',
  enviar: 'Enviar para verificar',
  porVerificar: 'Pago por verificar',
  porVerificarTexto: 'La administración revisará tu comprobante. Te avisaremos por correo; tu cupo sigue reservado.',
  aprobado: 'Pago aprobado',
  aprobadoTexto: 'Tu inscripción está confirmada. Te enviamos el comprobante por correo.',
  rechazado: 'Pago rechazado',
  rechazadoTexto: 'Puedes volver a enviar el comprobante mientras dure la reserva.',
  reenviar: 'Volver a enviar',
  sinConfig: 'La organización todavía no configuró este medio de pago.',
} as const

/** CA-01: los tres medios, en un solo lugar (OCP). Cada uno dice qué panel lo muestra. */
export const MEDIOS_PAGO: { medio: Medio; texto: string; icono: ReactNode; detalle: string }[] = [
  { medio: 'yape', texto: 'Yape', icono: <QrCode className="size-5" />, detalle: 'Escanea el QR desde tu app' },
  { medio: 'transferencia', texto: 'Transferencia', icono: <Bank className="size-5" />, detalle: 'Desde tu banco o con el CCI' },
  { medio: 'whatsapp', texto: 'WhatsApp', icono: <WhatsappLogo className="size-5" />, detalle: 'Coordina con la organización' },
]

/** Tarjetas para elegir el medio: un grupo de radio accesible, una tarjeta por medio. */
export function SelectorMedioPago({ elegido, onElegir }: { elegido: Medio; onElegir: (m: Medio) => void }) {
  return (
    <div role="radiogroup" aria-label="Medio de pago" className="grid grid-cols-3 gap-2">
      {MEDIOS_PAGO.map((m) => (
        <button key={m.medio} type="button" role="radio" aria-checked={elegido === m.medio} onClick={() => onElegir(m.medio)}
          className={cx('flex min-w-0 flex-col items-center gap-1 rounded-lg border px-2 py-3 text-center transition-colors',
            elegido === m.medio ? 'border-grana bg-grana-clara/50 text-grana-tinta' : 'border-linea-fuerte text-tinta-2 hover:border-tinta-3')}>
          {m.icono}
          <span className="text-[14px] font-medium">{m.texto}</span>
          <span className="hidden text-[12px] text-tinta-3 sm:block">{m.detalle}</span>
        </button>
      ))}
    </div>
  )
}

/** Un dato con botón para copiarlo (número de cuenta, CCI). */
function Dato({ etiqueta, valor, onCopiar }: { etiqueta: string; valor: string; onCopiar?: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[12px] text-tinta-3">{etiqueta}</p>
        <p className="num break-all text-[15px] font-medium text-tinta">{valor}</p>
      </div>
      {onCopiar && (
        <Boton tamano="sm" variante="fantasma" icono={<Copy className="size-4" />} onClick={() => onCopiar(valor)} aria-label={`Copiar ${etiqueta.toLowerCase()}`}>
          Copiar
        </Boton>
      )}
    </div>
  )
}

/** Panel de Yape: el QR grande con el monto y el titular, para comprobar a quién se paga. */
export function PanelYape({ config, monto }: { config: ConfigPagos; monto: number }) {
  if (!config.yape_qr) return <p className="text-[14px] text-tinta-3">{TEXTOS_PAGO.sinConfig}</p>
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <img src={config.yape_qr} alt={`Código QR de Yape de ${config.yape_titular}`} className="size-48 rounded-lg border border-linea bg-white p-2" />
      <p className="text-[14px] text-tinta-2">Paga <b className="num text-tinta">{soles(monto)}</b> a <b className="text-tinta">{config.yape_titular}</b></p>
    </div>
  )
}

/** Panel de transferencia: banco, cuenta, CCI y titular, con «Copiar». */
export function PanelTransferencia({ config, monto, onCopiar }: { config: ConfigPagos; monto: number; onCopiar?: (v: string) => void }) {
  if (!config.cuenta) return <p className="text-[14px] text-tinta-3">{TEXTOS_PAGO.sinConfig}</p>
  return (
    <div>
      <p className="mb-1 text-[14px] text-tinta-2">Transfiere <b className="num text-tinta">{soles(monto)}</b> a:</p>
      <div className="divide-y divide-linea rounded-lg border border-linea bg-fondo/50 px-3">
        <Dato etiqueta="Banco" valor={config.banco} />
        <Dato etiqueta="Número de cuenta" valor={config.cuenta} onCopiar={onCopiar} />
        <Dato etiqueta="CCI (desde otros bancos)" valor={config.cci} onCopiar={onCopiar} />
        <Dato etiqueta="Titular" valor={config.titular} />
      </div>
    </div>
  )
}

/** Panel de WhatsApp: el botón abre wa.me con el mensaje ya preparado (lo arma CAP-90). */
export function PanelWhatsapp({ config, enlace, mensaje }: { config: ConfigPagos; enlace: string | null; mensaje: string }) {
  if (!config.whatsapp || !enlace) return <p className="text-[14px] text-tinta-3">{TEXTOS_PAGO.sinConfig}</p>
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-tinta-2">Se abrirá WhatsApp con este mensaje para la organización:</p>
      <blockquote className="rounded-lg border-l-4 border-chilca bg-chilca-clara/40 px-3 py-2 text-[14px] text-tinta">{mensaje}</blockquote>
      <a href={enlace} target="_blank" rel="noreferrer"
        className="pulsable flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-chilca px-4 text-[15px] font-medium text-white no-underline hover:bg-[#245a30]">
        <WhatsappLogo weight="fill" className="size-5" />Escribir por WhatsApp
      </a>
    </div>
  )
}

/** CA-02: número de operación y captura. La captura no lleva descripción: es privada. */
export function FormComprobante({
  operacion, onOperacion, vista, onElegir, onQuitar, errorOperacion, errorArchivo, enviando = false, onEnviar,
}: {
  operacion: string; onOperacion: (v: string) => void; vista?: string | null; onElegir: (f: File) => void; onQuitar?: () => void
  errorOperacion?: string | null; errorArchivo?: string | null; enviando?: boolean; onEnviar: () => void
}) {
  const id = useId()
  return (
    <div className="space-y-4">
      <Campo etiqueta={TEXTOS_PAGO.operacion} htmlFor={`${id}-op`} error={errorOperacion} ayuda={TEXTOS_PAGO.ayudaOperacion}>
        <Entrada id={`${id}-op`} value={operacion} onChange={(e) => onOperacion(e.target.value.replace(/\s+/g, ''))} inputMode="numeric"
          autoComplete="off" maxLength={30} invalido={!!errorOperacion} placeholder="Por ejemplo: 12345678" />
      </Campo>
      <CampoImagen etiqueta={TEXTOS_PAGO.comprobante} ayuda={TEXTOS_PAGO.ayudaComprobante} vista={vista} onElegir={onElegir} onQuitar={onQuitar}
        error={errorArchivo} cargando={enviando} conDescripcion={false} />
      <Boton variante="primario" tamano="lg" className="w-full" cargando={enviando} onClick={onEnviar}>{TEXTOS_PAGO.enviar}</Boton>
    </div>
  )
}

/** CA-02 a CA-04: estado del pago, con el motivo si se rechazó. */
export function EstadoPago({ estado, operacion, motivo, accion }: {
  estado: EstadoPagoManual; operacion?: string | null; motivo?: string | null; accion?: ReactNode
}) {
  const v = {
    por_verificar: { icono: <Clock weight="fill" className="size-6 text-qolle" />, titulo: TEXTOS_PAGO.porVerificar, texto: TEXTOS_PAGO.porVerificarTexto, borde: 'border-qolle/40 bg-qolle-clara/40' },
    aprobado: { icono: <CheckCircle weight="fill" className="size-6 text-chilca" />, titulo: TEXTOS_PAGO.aprobado, texto: TEXTOS_PAGO.aprobadoTexto, borde: 'border-chilca/30 bg-chilca-clara/50' },
    rechazado: { icono: <XCircle weight="fill" className="size-6 text-error" />, titulo: TEXTOS_PAGO.rechazado, texto: TEXTOS_PAGO.rechazadoTexto, borde: 'border-error/30 bg-error-clara/50' },
  }[estado]
  return (
    <div role="status" className={cx('rounded-xl border p-4', v.borde)}>
      <div className="flex gap-3">
        {v.icono}
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-tinta">{v.titulo}</p>
          {estado === 'rechazado' && motivo && (
            <p className="text-[14px] text-tinta"><span className="font-medium">Motivo:</span> {motivo}</p>
          )}
          <p className="text-[14px] text-tinta-2">{v.texto}</p>
          {operacion && <p className="num text-[13px] text-tinta-3">Operación {operacion}</p>}
          {accion && <div className="pt-2">{accion}</div>}
        </div>
      </div>
    </div>
  )
}

export interface PagoPorVerificar {
  id: string; persona: string; correo: string; evento: string; monto: number; medio: Medio
  operacion: string; enviado: string; comprobante: string | null
}

/** CA-03 y CA-06: bandeja de la administración. Ver la captura, aprobar o rechazar con motivo. */
export function BandejaPagos({ pagos, onAprobar, onRechazar, procesando }: {
  pagos: PagoPorVerificar[]; onAprobar: (id: string) => void; onRechazar: (id: string) => void; procesando?: string | null
}) {
  if (pagos.length === 0) {
    return <Panel className="p-8 text-center text-[14px] text-tinta-3">No hay pagos por verificar.</Panel>
  }
  return (
    <ul className="space-y-3" aria-label="Pagos por verificar">
      {pagos.map((p) => (
        <li key={p.id}>
          <Panel className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            {p.comprobante ? (
              <a href={p.comprobante} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Ver comprobante de ${p.persona}`}>
                <img src={p.comprobante} alt="" className="h-20 w-16 rounded-md border border-linea object-cover" />
              </a>
            ) : (
              <span className="grid h-20 w-16 shrink-0 place-items-center rounded-md border border-dashed border-linea-fuerte text-tinta-3"><WarningCircle className="size-5" /></span>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-tinta">{p.persona} <span className="text-[13px] font-normal text-tinta-3">· {p.correo}</span></p>
              <p className="truncate text-[13px] text-tinta-2">{p.evento}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-tinta-2">
                <b className="num text-tinta">{soles(p.monto)}</b>
                <Insignia tinte="anil" punto={false}>{MEDIOS_PAGO.find((m) => m.medio === p.medio)?.texto}</Insignia>
                <span className="num">Operación {p.operacion}</span>
                <span className="text-tinta-3">· {p.enviado}</span>
              </p>
            </div>
            <div className="flex gap-2 sm:flex-col">
              <Boton tamano="sm" variante="exito" className="flex-1" cargando={procesando === p.id} onClick={() => onAprobar(p.id)}>Aprobar</Boton>
              <Boton tamano="sm" variante="peligro" className="flex-1" disabled={procesando === p.id} onClick={() => onRechazar(p.id)}>Rechazar</Boton>
            </div>
          </Panel>
        </li>
      ))}
    </ul>
  )
}

/** Motivo del rechazo (va dentro del Dialogo de ui.tsx). Ejemplos rápidos para no escribir siempre lo mismo. */
export const MOTIVOS_FRECUENTES = [
  'El monto no coincide con el costo del evento.',
  'No encontramos la operación en nuestra cuenta.',
  'La captura no se lee bien.',
] as const

export function FormRechazo({ motivo, onMotivo, error }: { motivo: string; onMotivo: (v: string) => void; error?: string | null }) {
  const id = useId()
  return (
    <div className="space-y-3">
      <Campo etiqueta="Motivo del rechazo" htmlFor={id} error={error} ayuda="La persona lo verá en su inscripción y en el correo.">
        <AreaTexto id={id} value={motivo} onChange={(e) => onMotivo(e.target.value)} maxLength={300} invalido={!!error} />
      </Campo>
      <div className="flex flex-wrap gap-2">
        {MOTIVOS_FRECUENTES.map((m) => (
          <button key={m} type="button" onClick={() => onMotivo(m)}
            className="rounded-full border border-linea-fuerte px-3 py-1 text-[13px] text-tinta-2 hover:bg-hundido">{m}</button>
        ))}
      </div>
    </div>
  )
}

/** CA-06: configuración de los medios de pago (solo administración). */
export function FormConfigPagos({ config, onCambio, onElegirQr, errores = {} }: {
  config: ConfigPagos; onCambio: (c: ConfigPagos) => void; onElegirQr: (f: File) => void; errores?: Partial<Record<keyof ConfigPagos, string>>
}) {
  const id = useId()
  const campo = (k: keyof ConfigPagos, etiqueta: string, ayuda?: string) => (
    <Campo etiqueta={etiqueta} htmlFor={`${id}-${k}`} error={errores[k]} ayuda={ayuda}>
      <Entrada id={`${id}-${k}`} value={String(config[k] ?? '')} onChange={(e) => onCambio({ ...config, [k]: e.target.value })} invalido={!!errores[k]} />
    </Campo>
  )
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-[15px] font-semibold">Yape</h3>
        <CampoImagen etiqueta="Código QR" ayuda="La imagen del QR que descargas desde tu app de Yape." vista={config.yape_qr}
          onElegir={onElegirQr} error={errores.yape_qr} conDescripcion={false} />
        {campo('yape_titular', 'Titular que aparece en Yape')}
      </section>
      <section className="grid gap-3 sm:grid-cols-2">
        <h3 className="text-[15px] font-semibold sm:col-span-2">Transferencia</h3>
        {campo('banco', 'Banco')}
        {campo('titular', 'Titular de la cuenta')}
        {campo('cuenta', 'Número de cuenta')}
        {campo('cci', 'CCI', '20 dígitos, para transferencias desde otros bancos.')}
      </section>
      <section className="space-y-3">
        <h3 className="text-[15px] font-semibold">WhatsApp</h3>
        {campo('whatsapp', 'Número de WhatsApp de la organización', '9 dígitos; se usa para el botón «Escribir por WhatsApp».')}
      </section>
    </div>
  )
}
