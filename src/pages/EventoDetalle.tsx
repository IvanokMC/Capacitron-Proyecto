import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Buildings, CalendarBlank, Certificate, Clock, MapPin, Hourglass, VideoCamera, Ticket, Link as LinkIcon,
} from '@phosphor-icons/react'
import { useApp, useCarga } from '../lib/app'
import type { EventoDetalle as TEvento, Inscripcion } from '../lib/tipos'
import { claveDia, fechaHora, fechaLarga, hora, MODALIDAD, num, PLATAFORMA, precio, rangoEvento, relativo, soles } from '../lib/formato'
import { ErrorApi } from '../lib/backend'
import { BandaCupos, InsigniaFase, InsigniaInscripcion } from '../components/tejido'
import { Aviso, Avatar, Boton, BotonEnlace, CargandoLista, Dialogo, Panel, Vacio } from '../components/ui'
import { useNotas } from '../components/notificaciones'

export function EventoDetalle() {
  const { id } = useParams()
  const { datos: e, error, cargando, recargar } = useCarga<TEvento>('detalle_evento', { id })

  if (cargando && !e) return <CargandoLista filas={3} />
  if (error || !e) {
    return (
      <Vacio titulo={error?.codigo === 'NO_ENCONTRADO' ? 'Evento no encontrado' : 'No pudimos abrir el evento'}
        accion={<BotonEnlace to="/">Ver eventos</BotonEnlace>}>
        {error?.message}
      </Vacio>
    )
  }

  return (
    <div>
      <Link to="/" className="mb-4 inline-flex items-center gap-1.5 text-sm text-tinta-3 no-underline hover:text-tinta">
        <ArrowLeft className="size-4" /> Eventos
      </Link>

      {e.estado === 'borrador' && (
        <Aviso tipo="alerta" titulo="Borrador" className="mb-5">Este evento no es visible para el público hasta que lo publiques.</Aviso>
      )}
      {e.estado === 'cancelado' && (
        <Aviso tipo="error" titulo="Evento cancelado" className="mb-5">{e.motivo_cancelacion}</Aviso>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <InsigniaFase fase={e.fase} />
            <span className="text-[13px] text-tinta-3">{MODALIDAD[e.modalidad]} · {e.horas_academicas} horas académicas</span>
          </div>
          <h1 className="mt-2 text-[28px] font-semibold leading-[1.15] sm:text-[36px]">{e.nombre}</h1>
          <p className="mt-3 flex items-center gap-2 text-[15px] text-tinta-2">
            <Buildings className="size-[18px] shrink-0 text-tinta-3" />
            {e.institucion?.nombre ?? 'Organizador independiente'} · organiza {e.organizador}
          </p>
          <p className="mt-6 max-w-[68ch] whitespace-pre-line text-[16px] leading-relaxed text-tinta-2">{e.descripcion}</p>

          <Programa e={e} />
          <Ponentes e={e} />
        </div>

        <aside className="lg:sticky lg:top-[84px] lg:self-start">
          <PanelAccion e={e} recargar={recargar} />
        </aside>
      </div>
    </div>
  )
}

function Programa({ e }: { e: TEvento }) {
  const dias = useMemo(() => {
    const m = new Map<string, TEvento['sesiones']>()
    for (const s of e.sesiones) {
      const k = claveDia(s.inicio)
      m.set(k, [...(m.get(k) ?? []), s])
    }
    return [...m.entries()]
  }, [e.sesiones])

  return (
    <section className="mt-10" aria-labelledby="programa">
      <h2 id="programa" className="text-xl font-semibold">Programa</h2>
      {dias.length === 0 ? (
        <p className="mt-3 text-[15px] text-tinta-3">El organizador todavía no publicó el cronograma.</p>
      ) : (
        <div className="mt-4 space-y-6">
          {dias.map(([k, sesiones], i) => (
            <div key={k}>
              {dias.length > 1 && (
                <p className="mb-2 text-sm font-medium text-tinta-2">
                  Jornada {i + 1} · <span className="first-letter:uppercase">{fechaLarga(sesiones[0].inicio)}</span>
                </p>
              )}
              <ol className="divide-y divide-linea rounded-xl border border-linea bg-superficie">
                {sesiones.map((s) => (
                  <li key={s.id} className="grid grid-cols-[86px_minmax(0,1fr)] gap-4 px-4 py-3.5">
                    <span className="num pt-0.5 text-sm font-medium text-tinta-2">{hora(s.inicio)}–{hora(s.fin)}</span>
                    <div className="min-w-0">
                      <p className="font-medium">{s.titulo}</p>
                      {s.descripcion && <p className="mt-0.5 text-sm text-tinta-3">{s.descripcion}</p>}
                      {s.ponentes.length > 0 && (
                        <p className="mt-1 text-[13px] text-anil">{s.ponentes.map((p) => p.nombre).join(' · ')}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function Ponentes({ e }: { e: TEvento }) {
  if (e.ponentes.length === 0) return null
  return (
    <section className="mt-10" aria-labelledby="ponentes">
      <h2 id="ponentes" className="text-xl font-semibold">Ponentes</h2>
      <ul className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {e.ponentes.map((p) => (
          <li key={p.id} className="flex gap-3.5">
            <Avatar nombre={p.nombre} foto={p.foto} tamano="size-14" />
            <div className="min-w-0">
              <p className="font-semibold">{p.nombre}</p>
              {p.biografia && <p className="mt-1 text-sm leading-relaxed text-tinta-3">{p.biografia}</p>}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function PanelAccion({ e, recargar }: { e: TEvento; recargar: () => void }) {
  const { usuario, api, ahora, latir } = useApp()
  const notas = useNotas()
  const navegar = useNavigate()
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [resultado, setResultado] = useState<{ tipo: 'exito' | 'info' | 'alerta'; titulo: string; texto: string } | null>(null)

  const abiertoInscripcion = e.estado === 'publicado' && e.fase === 'proximo'
  const ins = e.mi_inscripcion
  const vigente = ins && (ins.estado === 'confirmada' || ins.estado === 'pendiente_pago') ? ins : null
  const espera = e.mi_lista_espera

  async function inscribirse() {
    setEnviando(true)
    try {
      // La pantalla mostraba cupos libres: si alguien toma el último cupo primero,
      // la persona pasa a la lista de espera (HU-05 CA-04).
      const r = await api<{ ok: boolean; motivo?: string; mensaje?: string; inscripcion?: Inscripcion; posicion?: number }>(
        'inscribirse', { evento_id: e.id, lista_espera_automatica: true })
      setConfirmar(false)
      if (r.ok && r.inscripcion) {
        if (r.inscripcion.estado === 'confirmada') {
          setResultado({ tipo: 'exito', titulo: 'Inscripción confirmada',
            texto: 'Te enviamos un correo con los datos del evento. Tu código QR de ingreso está en Mis inscripciones.' })
          notas.exito('Inscripción confirmada')
        } else {
          setResultado({ tipo: 'alerta', titulo: 'Cupo reservado: falta el pago',
            texto: `Paga ${soles(r.inscripcion.monto)} antes de las ${hora(r.inscripcion.reserva_expira_en!)} h para confirmar tu inscripción.` })
        }
      } else {
        setResultado({ tipo: r.motivo === 'sin_cupos' ? 'alerta' : 'info', titulo: r.motivo === 'ya_inscrito' ? 'Ya estabas inscrito' : 'No se completó la inscripción',
          texto: r.mensaje ?? '' })
      }
      recargar()
      latir()
    } catch (err) {
      setConfirmar(false)
      notas.error(err)
    } finally {
      setEnviando(false)
    }
  }

  async function accion(fn: string, p: Record<string, unknown>, ok: string) {
    setEnviando(true)
    try {
      await api(fn, p)
      notas.exito(ok)
      recargar()
      latir()
    } catch (err) {
      notas.error(err instanceof ErrorApi ? err : String(err))
    } finally {
      setEnviando(false)
    }
  }

  let principal: ReactNode = null
  if (e.es_organizador) {
    principal = <BotonEnlace to={`/organizador/eventos/${e.id}`} variante="primario" tamano="lg" className="w-full">Gestionar evento</BotonEnlace>
  } else if (vigente?.estado === 'pendiente_pago') {
    principal = <BotonEnlace to={`/mis-inscripciones?pagar=${vigente.id}`} variante="primario" tamano="lg" className="w-full">Pagar {soles(vigente.monto)}</BotonEnlace>
  } else if (vigente?.estado === 'confirmada') {
    principal = <BotonEnlace to="/mis-inscripciones" variante="primario" tamano="lg" className="w-full">Ver mi código QR</BotonEnlace>
  } else if (espera?.estado === 'ofrecido') {
    principal = (
      <Boton variante="primario" tamano="lg" className="w-full" cargando={enviando}
        onClick={() => accion('aceptar_oferta_espera', { id: espera.id }, 'Cupo confirmado')}>
        Confirmar mi cupo
      </Boton>
    )
  } else if (espera) {
    principal = (
      <Boton variante="secundario" tamano="lg" className="w-full" cargando={enviando}
        onClick={() => accion('salir_lista_espera', { id: espera.id }, 'Saliste de la lista de espera')}>
        Salir de la lista de espera
      </Boton>
    )
  } else if (abiertoInscripcion && !usuario) {
    principal = <BotonEnlace to={`/ingresar?volver=/eventos/${e.id}`} variante="primario" tamano="lg" className="w-full">Ingresa para inscribirte</BotonEnlace>
  } else if (abiertoInscripcion && usuario?.rol === 'admin') {
    principal = null
  } else if (abiertoInscripcion && e.cupos_disponibles > 0) {
    principal = <Boton variante="primario" tamano="lg" className="w-full" onClick={() => setConfirmar(true)}>Inscribirme</Boton>
  } else if (abiertoInscripcion) {
    principal = (
      <Boton variante="primario" tamano="lg" className="w-full" cargando={enviando}
        onClick={() => accion('unirse_lista_espera', { evento_id: e.id }, 'Te uniste a la lista de espera')}>
        Unirme a la lista de espera
      </Boton>
    )
  }

  return (
    <Panel className="overflow-hidden shadow-panel">
      <div className="space-y-4 p-5">
        <div className="flex items-baseline justify-between">
          <span className="num text-[30px] font-semibold tracking-[-0.03em]">{precio(e.costo)}</span>
          {vigente && <InsigniaInscripcion estado={vigente.estado} />}
        </div>

        <ul className="space-y-2.5 text-[14px] text-tinta-2">
          <li className="flex gap-2.5"><CalendarBlank className="mt-0.5 size-[18px] shrink-0 text-tinta-3" />
            <span className="first-letter:uppercase">{rangoEvento(e.fecha_inicio, e.fecha_fin)}</span></li>
          {e.total_jornadas > 1 && (
            <li className="flex gap-2.5"><Clock className="mt-0.5 size-[18px] shrink-0 text-tinta-3" />
              {e.total_jornadas} jornadas · certificado con {e.porcentaje_minimo} % de asistencia</li>
          )}
          {e.total_jornadas === 1 && (
            <li className="flex gap-2.5"><Certificate className="mt-0.5 size-[18px] shrink-0 text-tinta-3" />
              Certificado digital al registrar tu asistencia</li>
          )}
          {e.modalidad !== 'virtual' && e.lugar && (
            <li className="flex gap-2.5"><MapPin className="mt-0.5 size-[18px] shrink-0 text-tinta-3" />{e.lugar}</li>
          )}
          {e.modalidad !== 'presencial' && (
            <li className="flex gap-2.5"><VideoCamera className="mt-0.5 size-[18px] shrink-0 text-tinta-3" />
              {e.enlace_virtual ? (
                <a href={e.enlace_virtual} target="_blank" rel="noreferrer" className="break-all font-medium text-anil underline">
                  Entrar a la sala de {PLATAFORMA[e.enlace_plataforma ?? ''] ?? 'videoconferencia'}
                </a>
              ) : e.tiene_enlace ? (
                <span>Transmisión por {PLATAFORMA[e.enlace_plataforma ?? '']}: el enlace se muestra al confirmar tu inscripción.</span>
              ) : (
                <span>El enlace de la sala se publicará antes del evento.</span>
              )}
            </li>
          )}
        </ul>

        {e.fase !== 'finalizado' && e.estado !== 'cancelado' && (
          <div className="border-t border-linea pt-4">
            <div className="mb-2.5 flex items-baseline justify-between">
              <span className="text-sm font-medium">Cupos</span>
              <span className="num text-sm text-tinta-2">
                {e.cupos_disponibles > 0 ? <><b className="font-semibold text-tinta">{num(e.cupos_disponibles)}</b> libres de {num(e.cupo_maximo)}</> : 'Sin cupos libres'}
              </span>
            </div>
            <BandaCupos total={e.cupo_maximo} ocupados={e.cupos_ocupados} leyenda animar />
            {e.en_espera > 0 && <p className="num mt-2 text-[13px] text-anil">{e.en_espera} {e.en_espera === 1 ? 'persona espera' : 'personas esperan'} un cupo</p>}
          </div>
        )}

        {vigente?.estado === 'pendiente_pago' && vigente.reserva_expira_en && (
          <Aviso tipo="alerta" titulo="Tu cupo está reservado">
            Confirma el pago antes de las {hora(vigente.reserva_expira_en)} h ({relativo(vigente.reserva_expira_en, ahora())}); si no, el cupo se libera.
          </Aviso>
        )}
        {espera?.estado === 'esperando' && (
          <Aviso tipo="info" titulo={`Estás en la lista de espera · posición ${espera.posicion}`}>
            Si se libera un cupo te avisaremos por correo y tendrás 24 horas para confirmarlo.
          </Aviso>
        )}
        {espera?.estado === 'ofrecido' && espera.oferta_expira_en && (
          <Aviso tipo="exito" titulo="Se liberó un cupo para ti">
            Confírmalo antes del {fechaHora(espera.oferta_expira_en)}; después pasará a la siguiente persona.
          </Aviso>
        )}
        {resultado && <Aviso tipo={resultado.tipo} titulo={resultado.titulo}>{resultado.texto}</Aviso>}
        {e.fase === 'en_curso' && !vigente && !e.es_organizador && (
          <Aviso tipo="info">El evento ya empezó y las inscripciones están cerradas.</Aviso>
        )}
        {e.fase === 'finalizado' && <Aviso tipo="info">Este evento ya terminó.</Aviso>}
        {e.es_ponente && !e.es_organizador && (
          <BotonEnlace to="/ponente" icono={<LinkIcon className="size-4" />} className="w-full">Gestionar el enlace de la sala</BotonEnlace>
        )}

        {principal}
      </div>

      <Dialogo
        abierto={confirmar}
        onCerrar={() => setConfirmar(false)}
        titulo="Confirma tu inscripción"
        descripcion={e.nombre}
        pie={<>
          <Boton onClick={() => setConfirmar(false)}>Volver</Boton>
          <Boton variante="primario" cargando={enviando} onClick={inscribirse}>
            {e.costo > 0 ? 'Reservar mi cupo' : 'Confirmar inscripción'}
          </Boton>
        </>}
      >
        {usuario && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-tinta-3">Nombre</dt><dd className="font-medium">{usuario.nombre_completo}</dd>
            <dt className="text-tinta-3">Correo</dt><dd className="font-medium">{usuario.correo}</dd>
            <dt className="text-tinta-3">Evento</dt><dd>{rangoEvento(e.fecha_inicio, e.fecha_fin)}</dd>
            <dt className="text-tinta-3">Costo</dt><dd className="num font-medium">{precio(e.costo)}</dd>
          </dl>
        )}
        <p className="mt-4 flex gap-2 text-[13px] text-tinta-3">
          {e.costo > 0 ? <><Hourglass className="mt-px size-4 shrink-0" />Reservamos tu cupo por 30 minutos mientras completas el pago con Yape, Plin o PayPal.</>
            : <><Ticket className="mt-px size-4 shrink-0" />Recibirás tu código QR de ingreso y un correo de confirmación.</>}
        </p>
        <p className="mt-2 text-[13px] text-tinta-3">Puedes cancelar hasta 24 horas antes del inicio. ¿Datos incorrectos? Corrígelos en <button className="underline" onClick={() => navegar('/perfil')}>tu perfil</button>.</p>
      </Dialogo>
    </Panel>
  )
}
