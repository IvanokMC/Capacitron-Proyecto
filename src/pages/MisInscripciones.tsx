import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Bell, CalendarBlank, Certificate, ChatCircleText, Clock, DownloadSimple, MapPin, QrCode, Receipt,
  VideoCamera, XCircle, Hourglass, CheckCircle,
} from '@phosphor-icons/react'
import { useApp, useCarga } from '../lib/app'
import type { MiEspera, MiInscripcion, Pago } from '../lib/tipos'
import { fechaHora, hora, METODO, MODALIDAD, PLATAFORMA, rangoEvento, relativo, soles } from '../lib/formato'
import { pdfCertificado, pdfComprobante } from '../lib/pdf'
import { ImagenQr } from '../components/qr'
import { InsigniaInscripcion, Jornadas } from '../components/tejido'
import {
  Aviso, Boton, BotonEnlace, CargandoLista, cx, Dialogo, EncabezadoPagina, Insignia, Panel, Pestanas, Vacio,
} from '../components/ui'
import { useNotas } from '../components/notificaciones'
import { estadoPagoManual } from '../lib/pagoManual'

interface Datos { inscripciones: MiInscripcion[]; lista_espera: MiEspera[] }

export default function MisInscripciones() {
  const { datos, cargando, recargar } = useCarga<Datos>('mis_inscripciones')
  const { api } = useApp()
  const notas = useNotas()
  const [params, setParams] = useSearchParams()
  const [pestana, setPestana] = useState<'activas' | 'historial'>('activas')
  const [qr, setQr] = useState<MiInscripcion | null>(null)
  // CAP-90: pagar abre la pantalla de pago propia (SRP, diap. 39–49), ya no un diálogo dentro de esta lista.
  const navegar = useNavigate()
  const irAPagar = (id: string) => navegar(`/mis-inscripciones/${id}/pagar`)
  const [cancelar, setCancelar] = useState<MiInscripcion | null>(null)

  const activas = useMemo(() => (datos?.inscripciones ?? []).filter((i) =>
    (i.estado === 'confirmada' || i.estado === 'pendiente_pago') && i.evento.fase !== 'finalizado' && i.evento.estado !== 'cancelado'), [datos])
  const historial = useMemo(() => (datos?.inscripciones ?? []).filter((i) => !activas.includes(i)), [datos, activas])

  // Enlaces desde correos: ?pagar=<inscripción> y ?comprobante=<pago>
  useEffect(() => {
    if (!datos) return
    const p = params.get('pagar')
    if (p) {
      const ins = datos.inscripciones.find((i) => i.id === p && i.estado === 'pendiente_pago')
      if (ins) { irAPagar(ins.id); return }
      params.delete('pagar')
      setParams(params, { replace: true })
    }
    const c = params.get('comprobante')
    if (c) {
      api<any>('comprobante_pago', { pago_id: c }).then(pdfComprobante).catch(notas.error)
      params.delete('comprobante')
      setParams(params, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos])

  if (cargando && !datos) return <CargandoLista />

  const ofertas = (datos?.lista_espera ?? []).filter((l) => l.estado === 'ofrecido')
  const esperando = (datos?.lista_espera ?? []).filter((l) => l.estado === 'esperando')
  const lista = pestana === 'activas' ? activas : historial

  return (
    <div>
      <EncabezadoPagina titulo="Mis inscripciones"
        descripcion="Tu código QR de ingreso, pagos pendientes, certificados y encuestas en un solo lugar."
        acciones={<BotonEnlace to="/">Buscar eventos</BotonEnlace>} />

      {ofertas.map((o) => <OfertaCupo key={o.id} o={o} onListo={recargar} />)}

      <Pestanas etiqueta="Inscripciones" valor={pestana} onCambio={setPestana} opciones={[
        { valor: 'activas', texto: 'Próximas y en curso', cuenta: activas.length },
        { valor: 'historial', texto: 'Historial', cuenta: historial.length },
      ]} />

      <div className="mt-5 space-y-4">
        {lista.length === 0 && (
          <Panel>
            <Vacio icono={<CalendarBlank className="size-6" />}
              titulo={pestana === 'activas' ? 'No tienes eventos próximos' : 'Aún no tienes historial'}
              accion={pestana === 'activas' ? <BotonEnlace to="/" variante="primario">Explorar eventos</BotonEnlace> : undefined}>
              {pestana === 'activas' ? 'Inscríbete en un evento y aquí verás tu código QR de ingreso.' : 'Aquí aparecerán tus eventos terminados, con sus certificados.'}
            </Vacio>
          </Panel>
        )}
        {lista.map((i) => (
          <TarjetaInscripcion key={i.id} i={i} onQr={() => setQr(i)} onPagar={() => irAPagar(i.id)} onCancelar={() => setCancelar(i)} />
        ))}
      </div>

      {pestana === 'activas' && esperando.length > 0 && (
        <section className="mt-10" aria-labelledby="espera">
          <h2 id="espera" className="mb-3 text-[17px] font-semibold">En lista de espera</h2>
          <ul className="divide-y divide-linea rounded-xl border border-linea bg-superficie">
            {esperando.map((l) => <FilaEspera key={l.id} l={l} onListo={recargar} />)}
          </ul>
        </section>
      )}

      <DialogoQr i={qr} onCerrar={() => setQr(null)} />
      <DialogoCancelar i={cancelar} onCerrar={() => setCancelar(null)} onListo={() => { setCancelar(null); recargar() }} />
    </div>
  )
}

function TarjetaInscripcion({ i, onQr, onPagar, onCancelar }: {
  i: MiInscripcion; onQr: () => void; onPagar: () => void; onCancelar: () => void
}) {
  const { api, ahora } = useApp()
  const notas = useNotas()
  const e = i.evento
  const [eleg, setEleg] = useState<string | null>(null)
  const [bajando, setBajando] = useState(false)
  const terminado = e.fase === 'finalizado'
  const pagosHechos = i.pagos.filter((p) => p.estado === 'confirmado' || p.estado === 'reembolsado')
  // Intentos de la pasarela simulada (demostración); los pagos manuales se muestran con su estado (CAP-90).
  const intentosFallidos = i.estado === 'pendiente_pago' ? i.pagos.filter((p) => !p.numero_operacion && (p.estado === 'rechazado' || p.estado === 'sin_respuesta')) : []
  const manual = estadoPagoManual(i)

  async function certificado() {
    setBajando(true)
    try {
      const r = await api<any>('mi_certificado', { inscripcion_id: i.id })
      if (r.elegible) await pdfCertificado(r.certificado)
      else setEleg(r.mensaje)
    } catch (err) {
      notas.error(err)
    } finally {
      setBajando(false)
    }
  }

  let principal: ReactNode = null
  if (i.estado === 'pendiente_pago') {
    principal = manual?.estado === 'por_verificar'
      ? <Boton onClick={onPagar}>Ver mi pago</Boton>
      : <Boton variante="primario" onClick={onPagar}>{manual?.estado === 'rechazado' ? 'Volver a enviar' : `Pagar ${soles(i.monto)}`}</Boton>
  }
  else if (i.estado === 'confirmada' && !terminado && e.estado !== 'cancelado') {
    principal = <Boton variante="primario" icono={<QrCode className="size-[18px]" />} onClick={onQr}>Ver código QR</Boton>
  } else if (terminado && i.certificado?.estado === 'valido') {
    principal = <Boton variante="primario" icono={<DownloadSimple className="size-[18px]" />} cargando={bajando} onClick={certificado}>Descargar certificado</Boton>
  } else if (terminado && i.estado === 'confirmada' && !i.certificado) {
    principal = <Boton icono={<Certificate className="size-[18px]" />} cargando={bajando} onClick={certificado}>Ver mi certificado</Boton>
  }

  const encuestaPendiente = i.encuesta?.enviada && i.encuesta.invitado && !i.encuesta.respondida && !i.encuesta.cerrada

  return (
    <Panel as="article" className="overflow-hidden">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <InsigniaInscripcion estado={i.estado} />
            {e.fase === 'en_curso' && <Insignia tinte="chilca">En curso</Insignia>}
            {e.estado === 'cancelado' && <Insignia tinte="error">Evento cancelado</Insignia>}
          </div>
          <h2 className="mt-2 text-[18px] font-semibold leading-snug">
            <Link to={`/eventos/${e.id}`} className="no-underline hover:text-grana-tinta">{e.nombre}</Link>
          </h2>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-tinta-2">
            <span className="inline-flex items-center gap-1.5"><CalendarBlank className="size-4 text-tinta-3" /><span className="first-letter:uppercase">{rangoEvento(e.fecha_inicio, e.fecha_fin)}</span></span>
            <span className="inline-flex items-center gap-1.5">
              {e.modalidad === 'virtual' ? <VideoCamera className="size-4 text-tinta-3" /> : <MapPin className="size-4 text-tinta-3" />}
              {MODALIDAD[e.modalidad]}{e.modalidad !== 'virtual' && e.lugar ? ` · ${e.lugar}` : ''}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">{principal}</div>
      </div>

      <div className="space-y-3 border-t border-linea bg-fondo/50 px-5 py-4 text-sm empty:hidden">
        {i.estado === 'pendiente_pago' && i.reserva_expira_en && (
          <p className="flex items-center gap-2 text-qolle-tinta">
            <Hourglass className="size-4" weight="bold" />
            Cupo reservado hasta las {hora(i.reserva_expira_en)} h ({relativo(i.reserva_expira_en, ahora())}). Si no se confirma el pago, se libera.
          </p>
        )}
        {/* CAP-90 (HU-16 CA-02 y CA-04): estado del pago enviado para verificar. */}
        {manual?.estado === 'por_verificar' && (
          <p className="flex items-center gap-2 text-qolle-tinta">
            <Clock className="size-4" weight="bold" />
            Pago por verificar (operación {manual.pago.numero_operacion}). Tu cupo sigue reservado; te avisaremos por correo.
          </p>
        )}
        {manual?.estado === 'rechazado' && (
          <p className="flex items-start gap-2 text-error">
            <XCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
            <span>Pago rechazado: {manual.pago.motivo_rechazo}</span>
          </p>
        )}
        {intentosFallidos.length > 0 && (
          <p className="text-tinta-3">
            Intentos sin éxito: {intentosFallidos.map((p) => `${METODO[p.metodo]} (${p.estado === 'rechazado' ? 'rechazado' : 'sin respuesta'})`).join(', ')}.
          </p>
        )}
        {i.estado === 'confirmada' && e.enlace_virtual && !terminado && (
          <p className="flex items-center gap-2">
            <VideoCamera className="size-4 text-anil" />
            <a href={e.enlace_virtual} target="_blank" rel="noreferrer" className="font-medium text-anil underline">
              Entrar a la sala de {PLATAFORMA[e.enlace_plataforma ?? ''] ?? 'videoconferencia'}
            </a>
          </p>
        )}
        {i.recordatorios.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-tinta-2">
            <span className="inline-flex items-center gap-1.5 text-tinta-3"><Bell className="size-4" />Recordatorios:</span>
            {i.recordatorios.map((r) => (
              <span key={r.tipo} className={cx('inline-flex items-center gap-1', r.enviado && 'text-chilca')}>
                {r.enviado && <CheckCircle weight="fill" className="size-4" />}
                {r.tipo === '24h' ? '24 h antes' : '1 h antes'} · {fechaHora(r.programado_para)}
              </span>
            ))}
          </div>
        )}
        {(terminado || e.fase === 'en_curso') && i.estado === 'confirmada' && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-tinta-3">Asistencia</span>
            <Jornadas asistidas={i.jornadas_asistidas} total={e.total_jornadas} />
            <span className="num text-tinta-3">{Number(i.porcentaje_asistencia).toLocaleString('es-PE')} % · mínimo {e.porcentaje_minimo} %</span>
          </div>
        )}
        {i.certificado?.estado === 'valido' && (
          <p className="text-tinta-2">Certificado <span className="font-mono text-tinta">{i.certificado.codigo}</span> · <Link to={`/verificar/${i.certificado.codigo}`} className="text-anil">ver verificación pública</Link></p>
        )}
        {i.certificado?.estado === 'revocado' && (
          <Aviso tipo="error" titulo="Certificado revocado">El organizador revocó este certificado el {fechaHora(i.certificado.revocado_en!)}. Revisa el correo con el motivo.</Aviso>
        )}
        {eleg && <Aviso tipo="alerta">{eleg}</Aviso>}
        {encuestaPendiente && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-anil/15 bg-anil-clara/60 px-4 py-3">
            <p className="flex items-center gap-2 text-anil"><ChatCircleText className="size-5" />¿Qué te pareció el evento? La encuesta cierra el {fechaHora(i.encuesta!.cierra_en!)}.</p>
            <BotonEnlace to={`/encuestas/${e.id}`} tamano="sm">Responder encuesta</BotonEnlace>
          </div>
        )}
        {i.encuesta?.respondida && <p className="text-tinta-3">Gracias por responder la encuesta.</p>}
        {pagosHechos.map((p) => <FilaPago key={p.id} p={p} />)}
        {i.estado === 'cancelada' && i.motivo_cancelacion && <p className="text-tinta-3">{i.motivo_cancelacion}.</p>}
        {i.estado === 'expirada' && <p className="text-tinta-3">La reserva venció sin pago confirmado. No se realizó ningún cobro.</p>}
        {i.puede_cancelar && (
          <div className="flex justify-end pt-1">
            <Boton variante="peligro" tamano="sm" onClick={onCancelar}>Cancelar inscripción</Boton>
          </div>
        )}
      </div>
    </Panel>
  )
}

function FilaPago({ p }: { p: Pago }) {
  const { api } = useApp()
  const notas = useNotas()
  const [bajando, setBajando] = useState(false)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-tinta-2">
      <span className="inline-flex items-center gap-2">
        <Receipt className="size-4 text-tinta-3" />
        {p.estado === 'reembolsado' ? 'Reembolsado' : 'Pagado'} {soles(p.monto)} con {METODO[p.metodo]} · <span className="font-mono text-[13px]">{p.numero_comprobante}</span>
      </span>
      {p.numero_comprobante && (
        <Boton tamano="sm" variante="fantasma" cargando={bajando} icono={<DownloadSimple className="size-4" />}
          onClick={async () => {
            setBajando(true)
            try { await pdfComprobante(await api('comprobante_pago', { pago_id: p.id })) } catch (e) { notas.error(e) } finally { setBajando(false) }
          }}>
          Comprobante
        </Boton>
      )}
    </div>
  )
}

function OfertaCupo({ o, onListo }: { o: MiEspera; onListo: () => void }) {
  const { api, latir } = useApp()
  const notas = useNotas()
  const [enviando, setEnviando] = useState(false)
  return (
    <Aviso tipo="exito" className="mb-5" titulo={`Se liberó un cupo en ${o.evento.nombre}`}
      accion={
        <div className="flex flex-wrap gap-2">
          <Boton variante="primario" tamano="sm" cargando={enviando} onClick={async () => {
            setEnviando(true)
            try { await api('aceptar_oferta_espera', { id: o.id }); notas.exito('Cupo confirmado'); onListo(); latir() }
            catch (e) { notas.error(e) } finally { setEnviando(false) }
          }}>Confirmar mi cupo</Boton>
          <Boton tamano="sm" onClick={async () => {
            try { await api('salir_lista_espera', { id: o.id }); notas.info('Liberaste el cupo para la siguiente persona'); onListo() }
            catch (e) { notas.error(e) }
          }}>No me interesa</Boton>
        </div>
      }>
      Lo reservamos para ti hasta el {fechaHora(o.oferta_expira_en!)}. {o.evento.costo > 0 && `Al confirmarlo tendrás 30 minutos para pagar ${soles(o.evento.costo)}.`}
    </Aviso>
  )
}

function FilaEspera({ l, onListo }: { l: MiEspera; onListo: () => void }) {
  const { api } = useApp()
  const notas = useNotas()
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <div>
        <Link to={`/eventos/${l.evento.id}`} className="font-medium no-underline hover:text-grana-tinta">{l.evento.nombre}</Link>
        <p className="mt-0.5 text-[13px] text-tinta-3"><span className="first-letter:uppercase">{rangoEvento(l.evento.fecha_inicio, l.evento.fecha_fin)}</span></p>
      </div>
      <div className="flex items-center gap-3">
        <Insignia tinte="anil">Posición {l.posicion}</Insignia>
        <Boton tamano="sm" variante="fantasma" onClick={async () => {
          try { await api('salir_lista_espera', { id: l.id }); notas.info('Saliste de la lista de espera'); onListo() } catch (e) { notas.error(e) }
        }}>Salir</Boton>
      </div>
    </li>
  )
}

function DialogoQr({ i, onCerrar }: { i: MiInscripcion | null; onCerrar: () => void }) {
  return (
    <Dialogo abierto={!!i} onCerrar={onCerrar} titulo="Tu código de ingreso" descripcion={i?.evento.nombre} ancho="max-w-sm">
      {i?.codigo_qr && (
        <div className="flex flex-col items-center text-center">
          <div className="rounded-2xl border border-linea p-3">
            <ImagenQr texto={`CAPACITRON:${i.codigo_qr}`} tamano={248} alt="Código QR de ingreso" />
          </div>
          <p className="mt-3 text-xs text-tinta-3">Si la cámara falla, dicta o muestra este código:</p>
          <p data-codigo-qr={i.codigo_qr} className="mt-1 select-all break-all font-mono text-[13px] tracking-wider text-tinta-2">
            {i.codigo_qr.match(/.{1,4}/g)!.join(' ')}
          </p>
          <p className="mt-3 text-sm text-tinta-3">Muéstralo en el ingreso; el organizador lo escanea para registrar tu asistencia en cada jornada. El código no contiene datos personales.</p>
        </div>
      )}
    </Dialogo>
  )
}

function DialogoCancelar({ i, onCerrar, onListo }: { i: MiInscripcion | null; onCerrar: () => void; onListo: () => void }) {
  const { api, latir } = useApp()
  const notas = useNotas()
  const [enviando, setEnviando] = useState(false)
  return (
    <Dialogo abierto={!!i} onCerrar={onCerrar} titulo="¿Cancelar tu inscripción?" descripcion={i?.evento.nombre}
      pie={<>
        <Boton onClick={onCerrar}>Mantener inscripción</Boton>
        <Boton variante="peligro" cargando={enviando} onClick={async () => {
          setEnviando(true)
          try { await api('cancelar_inscripcion', { id: i!.id }); notas.exito('Inscripción cancelada'); latir(); onListo() }
          catch (e) { notas.error(e) } finally { setEnviando(false) }
        }}>Sí, cancelar</Boton>
      </>}>
      <p className="text-sm text-tinta-2">
        Tu cupo se liberará para la siguiente persona de la lista de espera.
        {i && i.estado === 'confirmada' && i.monto > 0 && ` El reembolso de ${soles(i.monto)} se procesa por el mismo medio de pago.`}
      </p>
    </Dialogo>
  )
}
