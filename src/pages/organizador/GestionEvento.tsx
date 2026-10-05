import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowSquareOut, PencilSimple, Trash, UsersThree } from '@phosphor-icons/react'
import { useApp, useCarga } from '../../lib/app'
import type { Evento, Plan } from '../../lib/tipos'
import { fechaHora, MODALIDAD, num, precio, rangoEvento, relativo, soles } from '../../lib/formato'
import { BandaCupos, InsigniaFase, InsigniaInscripcion, Jornadas } from '../../components/tejido'
import {
  AreaTexto, Aviso, Boton, BotonEnlace, Campo, CargandoLista, Cifra, Dialogo, Insignia, Panel, Pestanas, Vacio,
} from '../../components/ui'
import { useNotas } from '../../components/notificaciones'
import { Programa } from './gestion/Programa'
import { Asistencia } from './gestion/Asistencia'
import { Certificados } from './gestion/Certificados'
import { EncuestaGestion } from './gestion/EncuestaGestion'
import { EnlaceVirtual } from './gestion/EnlaceVirtual'

export interface Gestion extends Evento {
  enlace_virtual: string | null
  tiene_inscripciones: boolean
  cupos: { total: number; ocupados: number; disponibles: number; confirmados: number; pendientes_pago: number; ofrecidos: number; en_espera: number }
  inscritos: { id: string; nombre: string; correo: string; estado: 'confirmada' | 'pendiente_pago' | 'cancelada' | 'expirada'; creado_en: string; monto: number
    reserva_expira_en: string | null; pago: string | null; jornadas_asistidas: number; total_jornadas: number }[]
  lista_espera: { id: string; nombre: string; correo: string; estado: 'esperando' | 'ofrecido'; solicitado_en: string; oferta_expira_en: string | null }[]
  plan: Plan
}

type Tab = 'resumen' | 'programa' | 'asistencia' | 'certificados' | 'encuesta' | 'enlace'

export default function GestionEvento() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { suscribirActividad } = useApp()
  const { datos: e, error, cargando, recargar } = useCarga<Gestion>('evento_gestion', { id })
  const tab = (params.get('pestana') as Tab) || 'resumen'
  const setTab = (t: Tab) => setParams(t === 'resumen' ? {} : { pestana: t }, { replace: true })

  // Inscripciones, pagos y asistencias de otras pestañas o dispositivos.
  useEffect(() => suscribirActividad(recargar), [suscribirActividad, recargar])

  if (cargando && !e) return <CargandoLista filas={3} />
  if (error || !e) return <Vacio titulo="No pudimos abrir el evento" accion={<BotonEnlace to="/organizador">Mis eventos</BotonEnlace>}>{error?.message}</Vacio>

  const virtual = e.modalidad !== 'presencial'
  const tabs: { valor: Tab; texto: string; cuenta?: number | null }[] = [
    { valor: 'resumen', texto: 'Inscritos', cuenta: e.cupos.confirmados + e.cupos.pendientes_pago },
    { valor: 'programa', texto: 'Programa' },
    { valor: 'asistencia', texto: 'Asistencia' },
    { valor: 'certificados', texto: 'Certificados' },
    { valor: 'encuesta', texto: 'Encuesta' },
    ...(virtual ? [{ valor: 'enlace' as Tab, texto: 'Enlace virtual' }] : []),
  ]

  return (
    <div>
      <Link to="/organizador" className="mb-3 inline-flex items-center gap-1.5 text-sm text-tinta-3 no-underline hover:text-tinta">
        <ArrowLeft className="size-4" /> Mis eventos
      </Link>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <InsigniaFase fase={e.fase} />
            <span className="text-[13px] text-tinta-3">{MODALIDAD[e.modalidad]} · {precio(e.costo)} · {e.total_jornadas} {e.total_jornadas === 1 ? 'jornada' : 'jornadas'}</span>
          </div>
          <h1 className="mt-1.5 text-[26px] font-semibold leading-tight sm:text-3xl">{e.nombre}</h1>
          <p className="mt-1 text-[14px] text-tinta-3 first-letter:uppercase">{rangoEvento(e.fecha_inicio, e.fecha_fin)}{e.lugar && e.modalidad !== 'virtual' ? ` · ${e.lugar}` : ''}</p>
        </div>
        <AccionesEvento e={e} recargar={recargar} />
      </div>

      <Pestanas etiqueta="Gestión del evento" valor={tab} onCambio={setTab} opciones={tabs} />
      <div className="mt-6">
        {tab === 'resumen' && <Resumen e={e} />}
        {tab === 'programa' && <Programa e={e} />}
        {tab === 'asistencia' && <Asistencia e={e} />}
        {tab === 'certificados' && <Certificados e={e} />}
        {tab === 'encuesta' && <EncuestaGestion e={e} />}
        {tab === 'enlace' && virtual && <EnlaceVirtual e={e} recargar={recargar} />}
      </div>
    </div>
  )
}

function AccionesEvento({ e, recargar }: { e: Gestion; recargar: () => void }) {
  const { api, latir } = useApp()
  const notas = useNotas()
  const navegar = useNavigate()
  const [publicando, setPublicando] = useState(false)
  const [cancelar, setCancelar] = useState(false)
  const [eliminar, setEliminar] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [errMotivo, setErrMotivo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const editable = e.fase === 'borrador' || e.fase === 'proximo'

  return (
    <div className="flex flex-wrap items-center gap-2">
      {e.estado === 'publicado' && (
        <BotonEnlace to={`/eventos/${e.id}`} variante="fantasma" icono={<ArrowSquareOut className="size-4" />}>Ver página pública</BotonEnlace>
      )}
      {editable && <BotonEnlace to={`/organizador/eventos/${e.id}/editar`} icono={<PencilSimple className="size-4" />}>Editar</BotonEnlace>}
      {e.estado === 'borrador' && (
        <Boton variante="primario" cargando={publicando} onClick={async () => {
          setPublicando(true)
          try { await api('publicar_evento', { id: e.id }); notas.exito('Evento publicado'); recargar() }
          catch (err) { notas.error(err) } finally { setPublicando(false) }
        }}>Publicar</Boton>
      )}
      {/* Acciones destructivas aisladas del resto. */}
      {(e.fase === 'proximo' || e.fase === 'en_curso' || e.fase === 'borrador') && (
        <span className="ml-0 flex gap-2 border-l border-linea pl-3 sm:ml-2">
          {e.tiene_inscripciones || e.estado === 'publicado' ? (
            <Boton variante="peligro" onClick={() => setCancelar(true)}>Cancelar evento</Boton>
          ) : (
            <Boton variante="peligro" icono={<Trash className="size-4" />} onClick={() => setEliminar(true)}>Eliminar</Boton>
          )}
        </span>
      )}

      <Dialogo abierto={cancelar} onCerrar={() => setCancelar(false)} titulo="Cancelar el evento"
        descripcion="Un evento con inscritos no se elimina: se cancela y se avisa a cada persona."
        pie={<>
          <Boton onClick={() => setCancelar(false)}>Volver</Boton>
          <Boton variante="peligro" cargando={enviando} onClick={async () => {
            if (!motivo.trim()) { setErrMotivo(true); return }
            setEnviando(true)
            try {
              const r = await api<{ inscripciones_canceladas: number }>('cancelar_evento', { id: e.id, motivo })
              notas.exito(`Evento cancelado. Avisamos a ${r.inscripciones_canceladas} ${r.inscripciones_canceladas === 1 ? 'persona' : 'personas'}.`)
              setCancelar(false); recargar(); latir()
            } catch (err) { notas.error(err) } finally { setEnviando(false) }
          }}>Cancelar evento</Boton>
        </>}>
        <Campo etiqueta="Motivo" htmlFor="motivo" error={errMotivo && 'Escribe el motivo: se enviará a los inscritos.'}
          ayuda={`${num(e.cupos.confirmados + e.cupos.pendientes_pago)} inscripciones se cancelarán; los pagos confirmados se marcan para reembolso.`}>
          <AreaTexto id="motivo" value={motivo} onChange={(ev) => { setMotivo(ev.target.value); setErrMotivo(false) }} invalido={errMotivo} rows={3} />
        </Campo>
      </Dialogo>

      <Dialogo abierto={eliminar} onCerrar={() => setEliminar(false)} titulo="¿Eliminar este evento?"
        descripcion="No tiene inscripciones, así que se borrará junto con su programa."
        pie={<>
          <Boton onClick={() => setEliminar(false)}>Volver</Boton>
          <Boton variante="peligro" cargando={enviando} onClick={async () => {
            setEnviando(true)
            try { await api('eliminar_evento', { id: e.id }); notas.exito('Evento eliminado'); navegar('/organizador') }
            catch (err) { notas.error(err) } finally { setEnviando(false) }
          }}>Eliminar definitivamente</Boton>
        </>} />
    </div>
  )
}

function Resumen({ e }: { e: Gestion }) {
  const { ahora } = useApp()
  const vigentes = e.inscritos.filter((i) => i.estado === 'confirmada' || i.estado === 'pendiente_pago')
  const otros = e.inscritos.filter((i) => !vigentes.includes(i))
  const recaudado = e.inscritos.filter((i) => i.pago === 'confirmado').reduce((s, i) => s + Number(i.monto), 0)

  return (
    <div className="space-y-6">
      <Panel className="p-5">
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4 lg:grid-cols-6">
          <Cifra valor={num(e.cupos.total)} etiqueta="Cupos totales" />
          <Cifra valor={num(e.cupos.ocupados)} etiqueta="Ocupados" />
          <Cifra valor={num(e.cupos.disponibles)} etiqueta="Disponibles" tinte={e.cupos.disponibles === 0 ? 'text-qolle-tinta' : undefined} />
          <Cifra valor={num(e.cupos.en_espera)} etiqueta="En lista de espera" tinte={e.cupos.en_espera ? 'text-anil' : undefined} />
          <Cifra valor={num(e.cupos.pendientes_pago)} etiqueta="Con pago pendiente" />
          {e.costo > 0 && <Cifra valor={soles(recaudado)} etiqueta="Recaudado" />}
        </div>
        <BandaCupos className="mt-6" total={e.cupos.total} confirmados={e.cupos.confirmados} pendientes={e.cupos.pendientes_pago}
          ofrecidos={e.cupos.ofrecidos} leyenda animar />
      </Panel>

      <section aria-labelledby="t-inscritos">
        <h2 id="t-inscritos" className="mb-3 text-[17px] font-semibold">Inscritos</h2>
        {vigentes.length === 0 ? (
          <Panel><Vacio icono={<UsersThree className="size-6" />} titulo="Aún no hay inscritos">
            {e.estado === 'borrador' ? 'Publica el evento para empezar a recibir inscripciones.' : 'Las inscripciones aparecerán aquí en tiempo real.'}
          </Vacio></Panel>
        ) : (
          <TablaInscritos filas={vigentes} />
        )}
        {otros.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-tinta-3 hover:text-tinta">Canceladas o vencidas ({otros.length})</summary>
            <div className="mt-3"><TablaInscritos filas={otros} /></div>
          </details>
        )}
      </section>

      {e.lista_espera.length > 0 && (
        <section aria-labelledby="t-espera">
          <h2 id="t-espera" className="mb-3 text-[17px] font-semibold">Lista de espera</h2>
          <div className="overflow-x-auto rounded-xl border border-linea bg-superficie">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="border-b border-linea bg-fondo/60 text-left text-[13px] text-tinta-3">
                <tr><th className="px-4 py-2.5 font-medium">#</th><th className="px-4 py-2.5 font-medium">Persona</th><th className="px-4 py-2.5 font-medium">Solicitó</th><th className="px-4 py-2.5 font-medium">Estado</th></tr>
              </thead>
              <tbody className="divide-y divide-linea">
                {e.lista_espera.map((l, k) => (
                  <tr key={l.id}>
                    <td className="num px-4 py-3 text-tinta-3">{k + 1}</td>
                    <td className="px-4 py-3"><p className="font-medium">{l.nombre}</p><p className="text-[13px] text-tinta-3">{l.correo}</p></td>
                    <td className="px-4 py-3 text-tinta-2">{fechaHora(l.solicitado_en)}</td>
                    <td className="px-4 py-3">
                      {l.estado === 'ofrecido'
                        ? <Insignia tinte="anil">Cupo ofrecido · vence {relativo(l.oferta_expira_en!, ahora())}</Insignia>
                        : <Insignia tinte="neutro">Esperando</Insignia>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

function TablaInscritos({ filas }: { filas: Gestion['inscritos'] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-linea bg-superficie">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="border-b border-linea bg-fondo/60 text-left text-[13px] text-tinta-3">
          <tr>
            <th className="px-4 py-2.5 font-medium">Persona</th>
            <th className="px-4 py-2.5 font-medium">Estado</th>
            <th className="px-4 py-2.5 font-medium">Asistencia</th>
            <th className="px-4 py-2.5 font-medium">Inscripción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-linea">
          {filas.map((i) => (
            <tr key={i.id} className="hover:bg-fondo/50">
              <td className="px-4 py-3"><p className="font-medium">{i.nombre}</p><p className="text-[13px] text-tinta-3">{i.correo}</p></td>
              <td className="px-4 py-3"><InsigniaInscripcion estado={i.estado} /></td>
              <td className="px-4 py-3"><Jornadas asistidas={i.jornadas_asistidas} total={i.total_jornadas} /></td>
              <td className="px-4 py-3 text-tinta-2">{fechaHora(i.creado_en)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function AvisoPlan({ texto }: { texto: string }) {
  return <Aviso tipo="alerta" titulo="Función fuera de tu plan">{texto}</Aviso>
}
