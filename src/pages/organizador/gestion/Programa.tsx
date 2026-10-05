import { useMemo, useState } from 'react'
import { Plus, PencilSimple, Trash, UploadSimple } from '@phosphor-icons/react'
import { useApp, useCarga } from '../../../lib/app'
import { ErrorApi } from '../../../lib/backend'
import type { EventoDetalle } from '../../../lib/tipos'
import { aInputLocal, claveDia, desdeInputLocal, fechaLarga, hora } from '../../../lib/formato'
import { AreaTexto, Aviso, Avatar, Boton, Campo, Casilla, cx, Dialogo, Entrada, Panel, Vacio } from '../../../components/ui'
import { useNotas } from '../../../components/notificaciones'
import type { Gestion } from '../GestionEvento'

const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']
const MAX_FOTO = 1024 * 1024

export function Programa({ e }: { e: Gestion }) {
  // El detalle público ya trae ponentes y sesiones con su orden.
  const { datos, recargar } = useCarga<EventoDetalle>('detalle_evento', { id: e.id })
  const [ponente, setPonente] = useState<Partial<PonenteForm> | null>(null)
  const [sesion, setSesion] = useState<Partial<SesionForm> | null>(null)
  const editable = e.estado !== 'cancelado' && e.fase !== 'finalizado'

  const dias = useMemo(() => {
    const m = new Map<string, EventoDetalle['sesiones']>()
    for (const s of datos?.sesiones ?? []) m.set(claveDia(s.inicio), [...(m.get(claveDia(s.inicio)) ?? []), s])
    return [...m.entries()]
  }, [datos])

  if (!datos) return null

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section aria-labelledby="cron">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="cron" className="text-[17px] font-semibold">Cronograma</h2>
          {editable && (
            <Boton tamano="sm" icono={<Plus className="size-4" weight="bold" />}
              onClick={() => setSesion({ inicio: aInputLocal(e.fecha_inicio), fin: aInputLocal(new Date(new Date(e.fecha_inicio).getTime() + 3600_000)), ponente_ids: [] })}>
              Agregar sesión
            </Boton>
          )}
        </div>
        {dias.length === 0 ? (
          <Panel><Vacio titulo="Sin sesiones">Agrega las sesiones con su hora y ponente; se mostrarán ordenadas en la página del evento.</Vacio></Panel>
        ) : (
          <div className="space-y-5">
            {dias.map(([k, ses], i) => (
              <div key={k}>
                <p className="mb-2 text-sm font-medium text-tinta-2">Jornada {i + 1} · <span className="first-letter:uppercase">{fechaLarga(ses[0].inicio)}</span></p>
                <ol className="divide-y divide-linea rounded-xl border border-linea bg-superficie">
                  {ses.map((s) => (
                    <li key={s.id} className="grid grid-cols-[86px_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3">
                      <span className="num pt-0.5 text-sm font-medium text-tinta-2">{hora(s.inicio)}–{hora(s.fin)}</span>
                      <div className="min-w-0">
                        <p className="font-medium">{s.titulo}</p>
                        <p className="text-[13px] text-anil">{s.ponentes.map((p) => p.nombre).join(' · ') || <span className="text-tinta-3">Sin ponente asignado</span>}</p>
                      </div>
                      {editable && (
                        <Boton tamano="sm" variante="fantasma" aria-label={`Editar ${s.titulo}`} icono={<PencilSimple className="size-4" />}
                          onClick={() => setSesion({ id: s.id, titulo: s.titulo, descripcion: s.descripcion, inicio: aInputLocal(s.inicio), fin: aInputLocal(s.fin), ponente_ids: s.ponentes.map((p) => p.id) })} />
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="pon">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="pon" className="text-[17px] font-semibold">Ponentes</h2>
          {editable && <Boton tamano="sm" icono={<Plus className="size-4" weight="bold" />} onClick={() => setPonente({ consentimiento: false })}>Agregar ponente</Boton>}
        </div>
        {datos.ponentes.length === 0 ? (
          <Panel><Vacio titulo="Sin ponentes">Agrega a quienes dictarán las sesiones, con foto y una biografía breve.</Vacio></Panel>
        ) : (
          <ul className="divide-y divide-linea rounded-xl border border-linea bg-superficie">
            {datos.ponentes.map((p) => (
              <li key={p.id} className="flex items-start gap-3 px-4 py-3">
                <Avatar nombre={p.nombre} foto={p.foto} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{p.nombre}</p>
                  <p className="line-clamp-2 text-[13px] text-tinta-3">{p.biografia || 'Sin biografía'}</p>
                </div>
                {editable && (
                  <Boton tamano="sm" variante="fantasma" aria-label={`Editar ${p.nombre}`} icono={<PencilSimple className="size-4" />}
                    onClick={() => setPonente({ id: p.id, nombre: p.nombre, biografia: p.biografia, foto: p.foto, consentimiento: true })} />
                )}
              </li>
            ))}
          </ul>
        )}
        {e.estado === 'publicado' && e.cupos.confirmados + e.cupos.pendientes_pago > 0 && (
          <p className="mt-3 text-[13px] text-tinta-3">Cada cambio del programa se avisa por correo a los inscritos.</p>
        )}
      </section>

      {ponente && <DialogoPonente e={e} inicial={ponente} onCerrar={() => setPonente(null)} onListo={() => { setPonente(null); recargar() }} />}
      {sesion && <DialogoSesion e={e} ponentes={datos.ponentes} inicial={sesion} onCerrar={() => setSesion(null)} onListo={() => { setSesion(null); recargar() }} />}
    </div>
  )
}

interface PonenteForm { id: string; nombre: string; correo: string; biografia: string; foto: string | null; consentimiento: boolean }

function DialogoPonente({ e, inicial, onCerrar, onListo }: { e: Gestion; inicial: Partial<PonenteForm>; onCerrar: () => void; onListo: () => void }) {
  const { api } = useApp()
  const notas = useNotas()
  const [f, setF] = useState<PonenteForm>({ id: '', nombre: '', correo: '', biografia: '', foto: null, consentimiento: false, ...inicial } as PonenteForm)
  const [nuevaFoto, setNuevaFoto] = useState<string | null>(null)
  const [quitarFoto, setQuitarFoto] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  function elegirFoto(file?: File) {
    if (!file) return
    // Se valida aquí y otra vez en el servidor (HU-11 CA-05).
    if (!TIPOS_FOTO.includes(file.type)) return setErrores((x) => ({ ...x, foto: 'La foto debe ser una imagen JPG, PNG o WebP.' }))
    if (file.size > MAX_FOTO) return setErrores((x) => ({ ...x, foto: `La foto pesa ${(file.size / 1048576).toFixed(1).replace('.', ',')} MB y el límite es 1 MB.` }))
    const r = new FileReader()
    r.onload = () => { setNuevaFoto(String(r.result)); setQuitarFoto(false); setErrores((x) => ({ ...x, foto: '' })) }
    r.readAsDataURL(file)
  }

  async function guardar() {
    const err: Record<string, string> = {}
    if (!f.nombre.trim()) err.nombre = 'Escribe el nombre del ponente.'
    if (!f.consentimiento) err.consentimiento = 'Se necesita su autorización para publicar sus datos.'
    setErrores(err)
    if (Object.keys(err).length) return
    setEnviando(true)
    try {
      await api('guardar_ponente', { evento_id: e.id, id: f.id || null, nombre: f.nombre, correo: f.correo || null, biografia: f.biografia,
        foto: nuevaFoto, quitar_foto: quitarFoto, consentimiento: f.consentimiento })
      notas.exito('Ponente guardado')
      onListo()
    } catch (x) {
      if (x instanceof ErrorApi && x.campos.length) setErrores(Object.fromEntries(x.campos.map((c) => [c, x.message])))
      else notas.error(x)
    } finally {
      setEnviando(false)
    }
  }

  const fotoVista = quitarFoto ? null : nuevaFoto ?? f.foto
  return (
    <Dialogo abierto onCerrar={onCerrar} titulo={f.id ? 'Editar ponente' : 'Agregar ponente'}
      pie={<>
        {f.id && <Boton variante="peligro" className="mr-auto" cargando={eliminando} icono={<Trash className="size-4" />} onClick={async () => {
          setEliminando(true)
          try { await api('eliminar_ponente', { id: f.id }); notas.exito('Ponente retirado'); onListo() } catch (x) { notas.error(x) } finally { setEliminando(false) }
        }}>Quitar</Boton>}
        <Boton onClick={onCerrar}>Cancelar</Boton>
        <Boton variante="primario" cargando={enviando} onClick={guardar}>Guardar</Boton>
      </>}>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar nombre={f.nombre || '?'} foto={fotoVista} tamano="size-16" />
          <div className="space-y-1.5">
            <label className="pulsable inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-linea-fuerte px-3 text-sm font-medium hover:bg-fondo">
              <UploadSimple className="size-4" /> {fotoVista ? 'Cambiar foto' : 'Subir foto'}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(ev) => elegirFoto(ev.target.files?.[0])} />
            </label>
            {fotoVista && <button type="button" className="ml-3 text-[13px] text-tinta-3 underline" onClick={() => { setQuitarFoto(true); setNuevaFoto(null) }}>Quitar foto</button>}
            <p className={cx('text-[13px]', errores.foto ? 'text-error' : 'text-tinta-3')}>{errores.foto || 'JPG, PNG o WebP de hasta 1 MB.'}</p>
          </div>
        </div>
        <Campo etiqueta="Nombre" htmlFor="pn" error={errores.nombre}>
          <Entrada id="pn" value={f.nombre} onChange={(ev) => setF({ ...f, nombre: ev.target.value })} invalido={!!errores.nombre} />
        </Campo>
        <Campo etiqueta="Correo" htmlFor="pc" opcional error={errores.correo} ayuda="Si tiene cuenta de ponente con este correo, podrá gestionar el enlace virtual.">
          <Entrada id="pc" type="email" value={f.correo} onChange={(ev) => setF({ ...f, correo: ev.target.value })} invalido={!!errores.correo} />
        </Campo>
        <Campo etiqueta="Biografía" htmlFor="pb" opcional>
          <AreaTexto id="pb" rows={3} maxLength={600} value={f.biografia} onChange={(ev) => setF({ ...f, biografia: ev.target.value })} />
        </Campo>
        <div>
          <Casilla checked={f.consentimiento} onChange={(v) => { setF({ ...f, consentimiento: v }); setErrores((x) => ({ ...x, consentimiento: '' })) }} invalido={!!errores.consentimiento}>
            El ponente autorizó publicar su nombre, foto y biografía en la página del evento.
          </Casilla>
          {errores.consentimiento && <p className="ml-7 mt-1 text-[13px] text-error">{errores.consentimiento}</p>}
        </div>
      </div>
    </Dialogo>
  )
}

interface SesionForm { id: string; titulo: string; descripcion: string; inicio: string; fin: string; ponente_ids: string[] }

function DialogoSesion({ e, ponentes, inicial, onCerrar, onListo }: {
  e: Gestion; ponentes: EventoDetalle['ponentes']; inicial: Partial<SesionForm>; onCerrar: () => void; onListo: () => void
}) {
  const { api } = useApp()
  const notas = useNotas()
  const [f, setF] = useState<SesionForm>({ id: '', titulo: '', descripcion: '', inicio: '', fin: '', ponente_ids: [], ...inicial } as SesionForm)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [cruce, setCruce] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  async function guardar(forzar = false) {
    const err: Record<string, string> = {}
    if (!f.titulo.trim()) err.titulo = 'Escribe el título de la sesión.'
    if (!f.inicio) err.inicio = 'Indica la hora de inicio.'
    if (!f.fin || f.fin <= f.inicio) err.fin = 'La hora de fin debe ser posterior al inicio.'
    setErrores(err)
    if (Object.keys(err).length) return
    setEnviando(true)
    try {
      const r = await api<{ ok: boolean; motivo?: string; mensaje?: string }>('guardar_sesion_programa', {
        evento_id: e.id, id: f.id || null, titulo: f.titulo, descripcion: f.descripcion,
        inicio: desdeInputLocal(f.inicio), fin: desdeInputLocal(f.fin), ponente_ids: f.ponente_ids, forzar,
      })
      if (!r.ok && r.motivo === 'cruce') { setCruce(r.mensaje ?? 'Hay un cruce de horarios.'); return }
      notas.exito(forzar ? 'Sesión guardada con cruce de horario' : 'Sesión guardada')
      onListo()
    } catch (x) {
      if (x instanceof ErrorApi && x.campos.length) setErrores(Object.fromEntries(x.campos.map((c) => [c, x.message])))
      else notas.error(x)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo abierto onCerrar={onCerrar} titulo={f.id ? 'Editar sesión' : 'Agregar sesión'}
      pie={<>
        {f.id && <Boton variante="peligro" className="mr-auto" cargando={eliminando} icono={<Trash className="size-4" />} onClick={async () => {
          setEliminando(true)
          try { await api('eliminar_sesion_programa', { id: f.id }); notas.exito('Sesión eliminada'); onListo() } catch (x) { notas.error(x) } finally { setEliminando(false) }
        }}>Eliminar</Boton>}
        <Boton onClick={onCerrar}>Cancelar</Boton>
        {cruce
          ? <Boton variante="primario" cargando={enviando} onClick={() => guardar(true)}>Guardar de todos modos</Boton>
          : <Boton variante="primario" cargando={enviando} onClick={() => guardar(false)}>Guardar</Boton>}
      </>}>
      <div className="space-y-4">
        <Campo etiqueta="Título" htmlFor="st" error={errores.titulo}>
          <Entrada id="st" value={f.titulo} onChange={(ev) => setF({ ...f, titulo: ev.target.value })} invalido={!!errores.titulo} />
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Inicio" htmlFor="si" error={errores.inicio}>
            <Entrada id="si" type="datetime-local" value={f.inicio} min={aInputLocal(e.fecha_inicio)} max={aInputLocal(e.fecha_fin)}
              onChange={(ev) => { setF({ ...f, inicio: ev.target.value }); setCruce(null) }} invalido={!!errores.inicio} />
          </Campo>
          <Campo etiqueta="Fin" htmlFor="sf" error={errores.fin}>
            <Entrada id="sf" type="datetime-local" value={f.fin} min={aInputLocal(e.fecha_inicio)} max={aInputLocal(e.fecha_fin)}
              onChange={(ev) => { setF({ ...f, fin: ev.target.value }); setCruce(null) }} invalido={!!errores.fin} />
          </Campo>
        </div>
        <Campo etiqueta="Descripción" htmlFor="sd" opcional>
          <AreaTexto id="sd" rows={2} value={f.descripcion} onChange={(ev) => setF({ ...f, descripcion: ev.target.value })} />
        </Campo>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-tinta-2">Ponentes</legend>
          {ponentes.length === 0 ? <p className="text-sm text-tinta-3">Primero agrega ponentes al evento.</p> : (
            <div className="space-y-2">
              {ponentes.map((p) => (
                <Casilla key={p.id} checked={f.ponente_ids.includes(p.id)} onChange={(v) => {
                  setF({ ...f, ponente_ids: v ? [...f.ponente_ids, p.id] : f.ponente_ids.filter((x) => x !== p.id) })
                  setCruce(null)
                }}>{p.nombre}</Casilla>
              ))}
            </div>
          )}
        </fieldset>
        {cruce && (
          <Aviso tipo="alerta" titulo="Cruce de horario">
            {cruce} Puedes ajustar la hora o guardar igualmente.
          </Aviso>
        )}
      </div>
    </Dialogo>
  )
}
