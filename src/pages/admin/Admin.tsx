import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowCounterClockwise, Clock, MagnifyingGlass, PencilSimple, Plus } from '@phosphor-icons/react'
import { useApp, useCarga } from '../../lib/app'
import { ErrorApi } from '../../lib/backend'
import type { Plan, Rol } from '../../lib/tipos'
import { fechaHora, fechaLarga, hora, num, ROL, soles } from '../../lib/formato'
import {
  AreaTexto, Aviso, Boton, Campo, CargandoLista, Casilla, Cifra, Dialogo, EncabezadoPagina, Entrada, Insignia, Panel, Pestanas, Selector, Vacio,
} from '../../components/ui'
import { useNotas } from '../../components/notificaciones'

type Tab = 'resumen' | 'instituciones' | 'usuarios' | 'planes' | 'historial' | 'sistema'

export default function Admin() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('pestana') as Tab) || 'resumen'
  const opciones: { valor: Tab; texto: string }[] = [
    { valor: 'resumen', texto: 'Resumen' },
    { valor: 'instituciones', texto: 'Instituciones' },
    { valor: 'usuarios', texto: 'Usuarios' },
    { valor: 'planes', texto: 'Planes' },
    { valor: 'historial', texto: 'Historial' },
    { valor: 'sistema', texto: 'Sistema' },
  ]
  return (
    <div>
      <EncabezadoPagina titulo="Administración" descripcion="Instituciones, usuarios y planes de la plataforma. Cada cambio queda en el historial." />
      <Pestanas etiqueta="Administración" valor={tab} onCambio={(t) => setParams(t === 'resumen' ? {} : { pestana: t }, { replace: true })} opciones={opciones} />
      <div className="mt-6">
        {tab === 'resumen' && <Resumen />}
        {tab === 'instituciones' && <Instituciones />}
        {tab === 'usuarios' && <Usuarios />}
        {tab === 'planes' && <Planes />}
        {tab === 'historial' && <Historial />}
        {tab === 'sistema' && <Sistema />}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function Resumen() {
  const { datos } = useCarga<any>('admin_resumen')
  if (!datos) return <CargandoLista filas={1} />
  const roles = datos.usuarios_por_rol ?? {}
  const planes = datos.instituciones_por_plan ?? {}
  return (
    <Panel className="grid grid-cols-2 gap-6 p-5 sm:grid-cols-3 lg:grid-cols-6">
      <Cifra valor={num(datos.usuarios)} etiqueta="Usuarios" detalle={`${roles.asistente ?? 0} asistentes · ${roles.organizador ?? 0} organizadores · ${roles.ponente ?? 0} ponentes`} />
      <Cifra valor={num(datos.usuarios_suspendidos)} etiqueta="Cuentas suspendidas" />
      <Cifra valor={num(datos.instituciones)} etiqueta="Instituciones" detalle={`${planes.basico ?? 0} Básico · ${planes.pro ?? 0} Pro · ${planes.enterprise ?? 0} Enterprise`} />
      <Cifra valor={num(datos.eventos_publicados)} etiqueta="Eventos publicados vigentes" />
      <Cifra valor={soles(Number(datos.facturacion_mensual))} etiqueta="Suscripciones al mes" detalle="Instituciones activas" />
      <Cifra valor={soles(Number(datos.ingresos_confirmados))} etiqueta="Pagos de inscripciones" />
    </Panel>
  )
}

// ---------------------------------------------------------------------------

interface Inst { id: string; nombre: string; siglas: string | null; plan_codigo: string; plan: string; estado: string; motivo_suspension: string | null
  organizadores: number; eventos_activos: number; eventos_total: number }

function Instituciones() {
  const { api } = useApp()
  const notas = useNotas()
  const { datos, recargar } = useCarga<Inst[]>('admin_instituciones')
  const [editar, setEditar] = useState<Partial<Inst> | null>(null)
  const [suspender, setSuspender] = useState<Inst | null>(null)

  if (!datos) return <CargandoLista />
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Boton variante="primario" icono={<Plus className="size-4" weight="bold" />} onClick={() => setEditar({ plan_codigo: 'basico' })}>Nueva institución</Boton>
      </div>
      <div className="overflow-x-auto rounded-xl border border-linea bg-superficie">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-linea bg-fondo/60 text-left text-[13px] text-tinta-3">
            <tr>{['Institución', 'Plan', 'Organizadores', 'Eventos activos', 'Estado', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-linea">
            {datos.map((i) => (
              <tr key={i.id}>
                <td className="px-4 py-3"><p className="font-medium">{i.nombre}</p>{i.siglas && <p className="text-[13px] text-tinta-3">{i.siglas}</p>}</td>
                <td className="px-4 py-3"><Insignia tinte={i.plan_codigo === 'enterprise' ? 'anil' : i.plan_codigo === 'pro' ? 'chilca' : 'neutro'} punto={false}>{i.plan}</Insignia></td>
                <td className="num px-4 py-3">{i.organizadores}</td>
                <td className="num px-4 py-3">{i.eventos_activos} <span className="text-tinta-3">de {i.eventos_total}</span></td>
                <td className="px-4 py-3">
                  {i.estado === 'activa' ? <Insignia tinte="chilca">Activa</Insignia> : (
                    <div><Insignia tinte="error">Suspendida</Insignia>{i.motivo_suspension && <p className="mt-1 text-[13px] text-tinta-3">{i.motivo_suspension}</p>}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1.5">
                    <Boton tamano="sm" variante="fantasma" icono={<PencilSimple className="size-4" />} onClick={() => setEditar(i)}>Editar</Boton>
                    {i.estado === 'activa'
                      ? <Boton tamano="sm" variante="peligro" onClick={() => setSuspender(i)}>Suspender</Boton>
                      : <Boton tamano="sm" onClick={async () => {
                          try { await api('admin_estado_institucion', { id: i.id, estado: 'activa' }); notas.exito('Institución activada'); recargar() } catch (e) { notas.error(e) }
                        }}>Activar</Boton>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editar && <DialogoInstitucion inicial={editar} onCerrar={() => setEditar(null)} onListo={() => { setEditar(null); recargar() }} />}
      <DialogoSuspension abierto={!!suspender} titulo={`Suspender ${suspender?.nombre ?? ''}`}
        descripcion="Sus organizadores no podrán ingresar y verán el motivo. Las sesiones abiertas se cierran de inmediato."
        onCerrar={() => setSuspender(null)}
        onConfirmar={async (motivo) => {
          await api('admin_estado_institucion', { id: suspender!.id, estado: 'suspendida', motivo })
          notas.exito('Institución suspendida'); setSuspender(null); recargar()
        }} />
    </div>
  )
}

function DialogoInstitucion({ inicial, onCerrar, onListo }: { inicial: Partial<Inst>; onCerrar: () => void; onListo: () => void }) {
  const { api } = useApp()
  const notas = useNotas()
  const [nombre, setNombre] = useState(inicial.nombre ?? '')
  const [siglas, setSiglas] = useState(inicial.siglas ?? '')
  const [plan, setPlan] = useState(inicial.plan_codigo ?? 'basico')
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  return (
    <Dialogo abierto onCerrar={onCerrar} titulo={inicial.id ? 'Editar institución' : 'Nueva institución'}
      pie={<><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={guardando} onClick={async () => {
        setGuardando(true)
        try { await api('admin_guardar_institucion', { id: inicial.id ?? null, nombre, siglas, plan_codigo: plan }); notas.exito('Institución guardada'); onListo() }
        catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setGuardando(false) }
      }}>Guardar</Boton></>}>
      <div className="space-y-4">
        <Campo etiqueta="Nombre" htmlFor="in" error={error}><Entrada id="in" value={nombre} onChange={(e) => { setNombre(e.target.value); setError(null) }} invalido={!!error} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Siglas" htmlFor="is" opcional><Entrada id="is" value={siglas} onChange={(e) => setSiglas(e.target.value)} /></Campo>
          <Campo etiqueta="Plan" htmlFor="ip">
            <Selector id="ip" value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="basico">Básico</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option>
            </Selector>
          </Campo>
        </div>
        {inicial.id && inicial.plan_codigo !== plan && <Aviso tipo="info">Los límites del nuevo plan rigen desde que guardes.</Aviso>}
      </div>
    </Dialogo>
  )
}

function DialogoSuspension({ abierto, titulo, descripcion, onCerrar, onConfirmar }: {
  abierto: boolean; titulo: string; descripcion: string; onCerrar: () => void; onConfirmar: (motivo: string) => Promise<void>
}) {
  const notas = useNotas()
  const [motivo, setMotivo] = useState('')
  const [err, setErr] = useState(false)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (abierto) { setMotivo(''); setErr(false) } }, [abierto])
  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={titulo} descripcion={descripcion}
      pie={<><Boton onClick={onCerrar}>Volver</Boton><Boton variante="peligro" cargando={enviando} onClick={async () => {
        if (!motivo.trim()) { setErr(true); return }
        setEnviando(true)
        try { await onConfirmar(motivo) } catch (e) { notas.error(e) } finally { setEnviando(false) }
      }}>Suspender</Boton></>}>
      <Campo etiqueta="Motivo" htmlFor="ms" error={err && 'Escribe el motivo; se mostrará al intentar ingresar.'}>
        <AreaTexto id="ms" rows={3} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErr(false) }} invalido={err} />
      </Campo>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------

interface Usu { id: string; nombres: string; apellidos: string; correo: string; rol: Rol; estado: string; motivo_suspension: string | null
  institucion_id: string | null; institucion: string | null; creado_en: string; bloqueado_hasta: string | null }

function Usuarios() {
  const { api, usuario: yo } = useApp()
  const notas = useNotas()
  const [q, setQ] = useState('')
  const [buscar, setBuscar] = useState('')
  const [rol, setRol] = useState('')
  const [estado, setEstado] = useState('')
  const { datos, recargar } = useCarga<Usu[]>('admin_usuarios', { q: buscar, rol, estado })
  const { datos: insts } = useCarga<Inst[]>('admin_instituciones')
  const [editar, setEditar] = useState<Usu | null>(null)
  const [suspender, setSuspender] = useState<Usu | null>(null)

  useEffect(() => { const t = setTimeout(() => setBuscar(q.trim()), 250); return () => clearTimeout(t) }, [q])

  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-tinta-3" />
          <Entrada aria-label="Buscar usuarios" placeholder="Nombre o correo" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
        <Selector aria-label="Rol" value={rol} onChange={(e) => setRol(e.target.value)} className="sm:w-44">
          <option value="">Todos los roles</option>{Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Selector>
        <Selector aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} className="sm:w-44">
          <option value="">Todos los estados</option><option value="activa">Activa</option><option value="pendiente">Pendiente</option><option value="suspendida">Suspendida</option>
        </Selector>
      </div>
      {!datos ? <CargandoLista /> : datos.length === 0 ? <Panel><Vacio titulo="Ningún usuario coincide" /></Panel> : (
        <div className="overflow-x-auto rounded-xl border border-linea bg-superficie">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-linea bg-fondo/60 text-left text-[13px] text-tinta-3">
              <tr>{['Usuario', 'Rol', 'Institución', 'Estado', ''].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {datos.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3"><p className="font-medium">{u.nombres} {u.apellidos}</p><p className="text-[13px] text-tinta-3">{u.correo}</p></td>
                  <td className="px-4 py-3">{ROL[u.rol]}</td>
                  <td className="px-4 py-3 text-tinta-2">{u.institucion ?? '—'}</td>
                  <td className="px-4 py-3">
                    {u.estado === 'activa' && !u.bloqueado_hasta && <Insignia tinte="chilca">Activa</Insignia>}
                    {u.estado === 'activa' && u.bloqueado_hasta && <Insignia tinte="qolle">Bloqueada hasta {hora(u.bloqueado_hasta)} h</Insignia>}
                    {u.estado === 'pendiente' && <Insignia tinte="qolle">Sin confirmar</Insignia>}
                    {u.estado === 'suspendida' && <div><Insignia tinte="error">Suspendida</Insignia>{u.motivo_suspension && <p className="mt-1 text-[13px] text-tinta-3">{u.motivo_suspension}</p>}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      <Boton tamano="sm" variante="fantasma" icono={<PencilSimple className="size-4" />} onClick={() => setEditar(u)}>Editar</Boton>
                      {u.id !== yo?.id && (u.estado === 'suspendida' || u.estado === 'pendiente'
                        ? <Boton tamano="sm" onClick={async () => {
                            try { await api('admin_estado_usuario', { id: u.id, estado: 'activa' }); notas.exito('Cuenta activada'); recargar() } catch (e) { notas.error(e) }
                          }}>Activar</Boton>
                        : <Boton tamano="sm" variante="peligro" onClick={() => setSuspender(u)}>Suspender</Boton>)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editar && <DialogoUsuario u={editar} instituciones={insts ?? []} onCerrar={() => setEditar(null)} onListo={() => { setEditar(null); recargar() }} />}
      <DialogoSuspension abierto={!!suspender} titulo={`Suspender a ${suspender?.nombres ?? ''}`}
        descripcion="La suspensión rige de inmediato: se cierran sus sesiones y verá el motivo al intentar ingresar."
        onCerrar={() => setSuspender(null)}
        onConfirmar={async (motivo) => {
          await api('admin_estado_usuario', { id: suspender!.id, estado: 'suspendida', motivo })
          notas.exito('Cuenta suspendida'); setSuspender(null); recargar()
        }} />
    </div>
  )
}

function DialogoUsuario({ u, instituciones, onCerrar, onListo }: { u: Usu; instituciones: Inst[]; onCerrar: () => void; onListo: () => void }) {
  const { api } = useApp()
  const notas = useNotas()
  const [f, setF] = useState({ nombres: u.nombres, apellidos: u.apellidos, rol: u.rol as string, institucion_id: u.institucion_id ?? '' })
  const [errores, setErrores] = useState<string[]>([])
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  return (
    <Dialogo abierto onCerrar={onCerrar} titulo="Editar usuario" descripcion={u.correo}
      pie={<><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={guardando} onClick={async () => {
        setGuardando(true)
        try { await api('admin_editar_usuario', { id: u.id, ...f, institucion_id: f.institucion_id || null }); notas.exito('Usuario actualizado'); onListo() }
        catch (e) { if (e instanceof ErrorApi) { setErrores(e.campos); setMensaje(e.message) } else notas.error(e) }
        finally { setGuardando(false) }
      }}>Guardar</Boton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Nombres" htmlFor="un"><Entrada id="un" value={f.nombres} onChange={(e) => setF({ ...f, nombres: e.target.value })} invalido={errores.includes('nombres')} /></Campo>
          <Campo etiqueta="Apellidos" htmlFor="ua"><Entrada id="ua" value={f.apellidos} onChange={(e) => setF({ ...f, apellidos: e.target.value })} invalido={errores.includes('apellidos')} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Rol" htmlFor="ur">
            <Selector id="ur" value={f.rol} onChange={(e) => setF({ ...f, rol: e.target.value })}>
              {Object.entries(ROL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Selector>
          </Campo>
          <Campo etiqueta="Institución" htmlFor="ui" opcional={f.rol !== 'organizador'}>
            <Selector id="ui" value={f.institucion_id} onChange={(e) => setF({ ...f, institucion_id: e.target.value })} invalido={errores.includes('institucion_id')}>
              <option value="">Ninguna</option>{instituciones.map((i) => <option key={i.id} value={i.id}>{i.siglas ?? i.nombre}</option>)}
            </Selector>
          </Campo>
        </div>
        {mensaje && <Aviso tipo="error">{mensaje}</Aviso>}
      </div>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------

function Planes() {
  const { datos, recargar } = useCarga<(Plan & { instituciones: number; actualizado_en: string })[]>('admin_planes')
  const [editar, setEditar] = useState<Plan | null>(null)
  if (!datos) return <CargandoLista filas={3} />
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {datos.map((p) => (
          <Panel key={p.codigo} className="flex flex-col p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold">{p.nombre}</h2>
              <span className="text-[13px] text-tinta-3">{p.instituciones} {p.instituciones === 1 ? 'institución' : 'instituciones'}</span>
            </div>
            <p className="mt-2 text-[28px] font-semibold tracking-[-0.03em]">{soles(Number(p.precio_mensual))}<span className="text-sm font-normal text-tinta-3"> / mes</span></p>
            <ul className="mt-4 flex-1 space-y-1.5 text-sm text-tinta-2">
              <li>{p.max_eventos_activos ? `${p.max_eventos_activos} eventos publicados a la vez` : 'Eventos publicados ilimitados'}</li>
              <li>{p.max_cupo_evento ? `Hasta ${num(p.max_cupo_evento)} cupos por evento` : 'Cupos ilimitados'}</li>
              <Rasgo ok={p.permite_pagos}>Pagos en línea</Rasgo>
              <Rasgo ok={p.permite_virtual}>Eventos virtuales y mixtos</Rasgo>
              <Rasgo ok={p.permite_exportar}>Exportar reportes</Rasgo>
              <Rasgo ok={p.permite_encuestas}>Encuestas de satisfacción</Rasgo>
              <Rasgo ok>Certificados verificables</Rasgo>
            </ul>
            <Boton className="mt-5" icono={<PencilSimple className="size-4" />} onClick={() => setEditar(p)}>Editar límites</Boton>
          </Panel>
        ))}
      </div>
      {editar && <DialogoPlan p={editar} onCerrar={() => setEditar(null)} onListo={() => { setEditar(null); recargar() }} />}
    </div>
  )
}

function Rasgo({ ok, children }: { ok: boolean; children: string }) {
  return <li className={ok ? '' : 'text-tinta-3 line-through decoration-tinta-3/50'}>{children}</li>
}

function DialogoPlan({ p, onCerrar, onListo }: { p: Plan; onCerrar: () => void; onListo: () => void }) {
  const { api } = useApp()
  const notas = useNotas()
  const [f, setF] = useState({
    precio_mensual: String(p.precio_mensual), max_eventos_activos: p.max_eventos_activos?.toString() ?? '', max_cupo_evento: p.max_cupo_evento?.toString() ?? '',
    permite_pagos: p.permite_pagos, permite_virtual: p.permite_virtual, permite_exportar: p.permite_exportar, permite_encuestas: p.permite_encuestas,
  })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  return (
    <Dialogo abierto onCerrar={onCerrar} titulo={`Plan ${p.nombre}`} descripcion="Los nuevos límites rigen desde que guardes para todas las instituciones del plan."
      pie={<><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={guardando} onClick={async () => {
        setGuardando(true)
        try { await api('admin_guardar_plan', { codigo: p.codigo, ...f }); notas.exito('Plan actualizado'); onListo() }
        catch (e) { setError(e instanceof Error ? e.message : String(e)) } finally { setGuardando(false) }
      }}>Guardar</Boton></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Campo etiqueta="Precio (S/)" htmlFor="pp"><Entrada id="pp" type="number" min={0} value={f.precio_mensual} onChange={(e) => setF({ ...f, precio_mensual: e.target.value })} /></Campo>
          <Campo etiqueta="Eventos activos" htmlFor="pe" ayuda="Vacío = ilimitado"><Entrada id="pe" type="number" min={1} value={f.max_eventos_activos} onChange={(e) => setF({ ...f, max_eventos_activos: e.target.value })} /></Campo>
          <Campo etiqueta="Cupo por evento" htmlFor="pc" ayuda="Vacío = ilimitado"><Entrada id="pc" type="number" min={1} value={f.max_cupo_evento} onChange={(e) => setF({ ...f, max_cupo_evento: e.target.value })} /></Campo>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Casilla checked={f.permite_pagos} onChange={(v) => setF({ ...f, permite_pagos: v })}>Pagos en línea</Casilla>
          <Casilla checked={f.permite_virtual} onChange={(v) => setF({ ...f, permite_virtual: v })}>Eventos virtuales y mixtos</Casilla>
          <Casilla checked={f.permite_exportar} onChange={(v) => setF({ ...f, permite_exportar: v })}>Exportar reportes</Casilla>
          <Casilla checked={f.permite_encuestas} onChange={(v) => setF({ ...f, permite_encuestas: v })}>Encuestas de satisfacción</Casilla>
        </div>
        {error && <Aviso tipo="error">{error}</Aviso>}
      </div>
    </Dialogo>
  )
}

// ---------------------------------------------------------------------------

function Historial() {
  const [q, setQ] = useState('')
  const [buscar, setBuscar] = useState('')
  useEffect(() => { const t = setTimeout(() => setBuscar(q.trim()), 250); return () => clearTimeout(t) }, [q])
  const { datos } = useCarga<{ id: number; actor_nombre: string; accion: string; entidad: string; entidad_id: string | null; detalle: string; creado_en: string }[]>('admin_historial', { q: buscar })
  return (
    <div>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-tinta-3">Registro de solo lectura: las acciones no se pueden editar ni borrar.</p>
        <div className="relative sm:w-80">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-tinta-3" />
          <Entrada aria-label="Buscar en el historial" placeholder="Buscar autor, acción o detalle" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
        </div>
      </div>
      {!datos ? <CargandoLista /> : datos.length === 0 ? <Panel><Vacio titulo="Sin registros" /></Panel> : (
        <ol className="divide-y divide-linea rounded-xl border border-linea bg-superficie">
          {datos.map((a) => (
            <li key={a.id} className="grid gap-1 px-5 py-3.5 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-5">
              <span className="num text-[13px] text-tinta-3">{fechaHora(a.creado_en)}</span>
              <div className="min-w-0">
                <p className="text-sm"><b className="font-semibold">{a.actor_nombre}</b> · {a.accion}</p>
                <p className="mt-0.5 break-words text-[13px] text-tinta-2">{a.detalle}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------

interface Diagnostico {
  modo_demo: boolean; cron_instalado: boolean; cron_activo: boolean; ultima_tarea_cron_en: string | null
  realtime_activo: boolean; pasarela_simulada: boolean; ahora: string
}

function Sistema() {
  const { api, modo, sistema, latir } = useApp()
  const notas = useNotas()
  const { datos: d, error, recargar } = useCarga<Diagnostico>('admin_diagnostico')
  const [confirmar, setConfirmar] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const faltaMigracion = error && /admin_diagnostico|function|funci/i.test(error.message)

  async function cambiarModo(activo: boolean) {
    setEnviando(true)
    try {
      await api('admin_modo_demo', { activo })
      notas.exito(activo ? 'Modo demostración activado' : 'Modo demostración desactivado')
      setConfirmar(false)
      recargar()
      latir()
    } catch (e) { notas.error(e) } finally { setEnviando(false) }
  }

  const fila = (ok: boolean | null, titulo: string, detalle: string) => (
    <li className="flex items-start justify-between gap-4 py-3">
      <div>
        <p className="text-sm font-medium">{titulo}</p>
        <p className="mt-0.5 text-[13px] text-tinta-3">{detalle}</p>
      </div>
      {ok == null ? <Insignia tinte="neutro">No aplica</Insignia> : ok ? <Insignia tinte="chilca">Activo</Insignia> : <Insignia tinte="qolle">Inactivo</Insignia>}
    </li>
  )

  return (
    <div className="space-y-6">
      {faltaMigracion ? (
        <Aviso tipo="alerta" titulo="Falta aplicar la migración 0006 en Supabase">
          Ejecuta <code className="font-mono">supabase/migrations/20261005000006_endurecimiento.sql</code> en el SQL Editor para habilitar el diagnóstico y el interruptor del modo demostración.
        </Aviso>
      ) : d && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel className="p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold">Diagnóstico</h2>
            <p className="mt-0.5 text-sm text-tinta-3">{modo === 'supabase' ? 'Conectado a Supabase.' : 'Modo local (PGlite en este navegador): cron y tiempo real de Supabase no aplican.'}</p>
            <ul className="mt-3 divide-y divide-linea">
              {fila(modo === 'supabase' ? d.cron_activo : null, 'Tareas programadas (pg_cron)',
                d.ultima_tarea_cron_en ? `Última ejecución: ${fechaHora(d.ultima_tarea_cron_en)}` : 'Recordatorios, vencimientos, certificados y encuestas cada minuto.')}
              {fila(modo === 'supabase' ? d.realtime_activo : null, 'Tiempo real (Realtime)', 'Actualiza reportes y asistencia entre dispositivos.')}
              {fila(d.pasarela_simulada, 'Pasarela de pago simulada', d.pasarela_simulada ? 'Cualquier persona puede aprobar su propio pago: solo para la demo.' : 'Desactivada: los pagos esperan la confirmación de la plataforma.')}
            </ul>
            <Boton tamano="sm" variante="fantasma" className="mt-2" icono={<ArrowCounterClockwise className="size-4" />} onClick={recargar}>Volver a comprobar</Boton>
          </Panel>
          <Panel className="p-5 sm:p-6">
            <h2 className="text-[17px] font-semibold">Modo demostración</h2>
            <p className="mt-0.5 text-sm text-tinta-3">Habilita el buzón público de correos, el reloj de demostración y la pasarela de pago simulada. Desactívalo antes de usar la plataforma con personas reales.</p>
            <div className="mt-5 flex items-center justify-between gap-4 rounded-lg bg-fondo px-4 py-3">
              <span className="text-sm font-medium">{sistema?.modo_demo ? 'Activo' : 'Desactivado'}</span>
              {sistema?.modo_demo
                ? <Boton variante="peligro" onClick={() => setConfirmar(true)}>Desactivar</Boton>
                : <Boton cargando={enviando} onClick={() => cambiarModo(true)}>Activar</Boton>}
            </div>
          </Panel>
        </div>
      )}
      {sistema?.modo_demo && <Demostracion />}
      <Dialogo abierto={confirmar} onCerrar={() => setConfirmar(false)} titulo="¿Desactivar el modo demostración?"
        descripcion="Se cierran el buzón público y la pasarela simulada, y el reloj vuelve a la hora real."
        pie={<><Boton onClick={() => setConfirmar(false)}>Cancelar</Boton><Boton variante="peligro" cargando={enviando} onClick={() => cambiarModo(false)}>Desactivar</Boton></>} />
    </div>
  )
}

function Demostracion() {
  const { api, sistema, latir, restablecerDemo, salir } = useApp()
  const notas = useNotas()
  const [fecha, setFecha] = useState('')
  const [enviando, setEnviando] = useState<string | null>(null)
  const [reiniciar, setReiniciar] = useState(false)

  async function reloj(p: Record<string, unknown>, clave: string) {
    setEnviando(clave)
    try {
      const r = await api<{ ahora: string; tareas: Record<string, number> }>('admin_reloj', p)
      const t = r.tareas
      const hechos = [
        t.recordatorios && `${t.recordatorios} recordatorios`, t.reservas_vencidas && `${t.reservas_vencidas} reservas vencidas`,
        t.ofertas_vencidas && `${t.ofertas_vencidas} ofertas de cupo vencidas`, t.certificados && `${t.certificados} certificados`,
        t.encuestas && `${t.encuestas} encuestas enviadas`,
      ].filter(Boolean)
      notas.exito(`Hora del sistema: ${fechaHora(r.ahora)}${hechos.length ? ` · ${hechos.join(', ')}` : ''}`)
      latir()
    } catch (e) { notas.error(e) } finally { setEnviando(null) }
  }

  const pasos = [[60, '+1 hora'], [120, '+2 horas'], [24 * 60, '+1 día'], [3 * 24 * 60, '+3 días'], [8 * 24 * 60, '+8 días']] as const
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-qolle-clara text-qolle-tinta"><Clock className="size-5" weight="bold" /></span>
          <div>
            <h2 className="text-[17px] font-semibold">Reloj de demostración</h2>
            <p className="mt-0.5 text-sm text-tinta-3">Adelanta la hora del sistema para mostrar recordatorios (24 h y 1 h), vencimiento de pagos (30 min) y de cupos ofrecidos (24 h), emisión de certificados y cierre de encuestas (7 días).</p>
          </div>
        </div>
        {sistema && (
          <p className="mt-5 text-sm">Hora del sistema: <b className="first-letter:uppercase">{fechaLarga(sistema.ahora)}, {hora(sistema.ahora)} h</b>
            {sistema.reloj_desfase_min !== 0 && <span className="text-qolle-tinta"> (adelantado {num(sistema.reloj_desfase_min)} min)</span>}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {pasos.map(([m, t]) => <Boton key={m} tamano="sm" cargando={enviando === t} onClick={() => reloj({ accion: 'avanzar', minutos: m }, t)}>{t}</Boton>)}
        </div>
        <div className="mt-4 flex gap-2">
          <Entrada type="datetime-local" aria-label="Fijar hora" value={fecha} onChange={(e) => setFecha(e.target.value)} className="h-9 text-sm" />
          <Boton tamano="sm" disabled={!fecha} cargando={enviando === 'fijar'} onClick={() => reloj({ accion: 'fijar', fecha: `${fecha}:00-05:00` }, 'fijar')}>Fijar</Boton>
        </div>
        <Boton variante="fantasma" tamano="sm" className="mt-3" icono={<ArrowCounterClockwise className="size-4" />} cargando={enviando === 'r'}
          onClick={() => reloj({ accion: 'restablecer' }, 'r')}>Volver a la hora real</Boton>
      </Panel>

      {restablecerDemo && (
        <Panel className="p-5 sm:p-6">
          <h2 className="text-[17px] font-semibold">Datos de demostración</h2>
          <p className="mt-0.5 text-sm text-tinta-3">La base local vive en este navegador. Restablecerla borra todo y vuelve a crear las instituciones, cuentas y eventos de ejemplo con fechas relativas a hoy.</p>
          <Boton variante="peligro" className="mt-5" onClick={() => setReiniciar(true)}>Restablecer datos</Boton>
          <Dialogo abierto={reiniciar} onCerrar={() => setReiniciar(false)} titulo="¿Restablecer los datos de demostración?"
            descripcion="Se perderán las cuentas, eventos e inscripciones creados en este navegador."
            pie={<><Boton onClick={() => setReiniciar(false)}>Cancelar</Boton><Boton variante="peligro" cargando={enviando === 'reset'} onClick={async () => {
              setEnviando('reset')
              try { await restablecerDemo(); await salir().catch(() => {}); location.href = '/' } catch (e) { notas.error(e); setEnviando(null) }
            }}>Restablecer</Boton></>} />
        </Panel>
      )}
    </div>
  )
}
