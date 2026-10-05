import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock } from '@phosphor-icons/react'
import { useApp } from '../../lib/app'
import { ErrorApi } from '../../lib/backend'
import type { Evento, Plan } from '../../lib/tipos'
import { aInputLocal, desdeInputLocal } from '../../lib/formato'
import { Aviso, AreaTexto, Boton, Campo, CargandoLista, cx, EncabezadoPagina, Entrada, Panel } from '../../components/ui'
import { useNotas } from '../../components/notificaciones'

interface Form {
  nombre: string; descripcion: string; modalidad: string; lugar: string; fecha_inicio: string; fecha_fin: string
  cupo_maximo: string; costo: string; horas_academicas: string; porcentaje_minimo: string; firmante_nombre: string; firmante_cargo: string
}

const VACIO: Form = {
  nombre: '', descripcion: '', modalidad: 'presencial', lugar: '', fecha_inicio: '', fecha_fin: '', cupo_maximo: '',
  costo: '0', horas_academicas: '', porcentaje_minimo: '80', firmante_nombre: '', firmante_cargo: '',
}

const MENSAJES: Record<string, string> = {
  nombre: 'Escribe el nombre del evento.',
  descripcion: 'Describe de qué trata el evento.',
  modalidad: 'Elige la modalidad.',
  lugar: 'Indica el lugar del evento presencial o mixto.',
  fecha_inicio: 'Indica la fecha y hora de inicio.',
  fecha_fin: 'Indica la fecha y hora de fin, posterior al inicio.',
  cupo_maximo: 'Indica cuántos cupos tiene (mayor que 0).',
  costo: 'Indica el costo; usa 0 si es gratuito.',
  horas_academicas: 'Indica las horas académicas que acredita el certificado.',
  porcentaje_minimo: 'Usa un valor entre 1 y 100.',
}

export default function EditorEvento() {
  const { id } = useParams()
  const { api, usuario } = useApp()
  const notas = useNotas()
  const navegar = useNavigate()
  const [f, setF] = useState<Form>({ ...VACIO, firmante_nombre: usuario?.nombre_completo ?? '', firmante_cargo: 'Coordinación académica' })
  const [original, setOriginal] = useState<(Evento & { tiene_inscripciones: boolean }) | null>(null)
  const [cargando, setCargando] = useState(!!id)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<{ texto: string; plan?: boolean } | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const plan: Plan | undefined = usuario?.institucion?.plan

  useEffect(() => {
    if (!id) return
    api<Evento & { tiene_inscripciones: boolean }>('evento_gestion', { id })
      .then((e) => {
        setOriginal(e)
        setF({
          nombre: e.nombre, descripcion: e.descripcion, modalidad: e.modalidad, lugar: e.lugar ?? '',
          fecha_inicio: aInputLocal(e.fecha_inicio), fecha_fin: aInputLocal(e.fecha_fin), cupo_maximo: String(e.cupo_maximo),
          costo: String(e.costo), horas_academicas: String(e.horas_academicas), porcentaje_minimo: String(e.porcentaje_minimo),
          firmante_nombre: e.firmante_nombre ?? '', firmante_cargo: e.firmante_cargo ?? '',
        })
      })
      .catch((e) => setGeneral({ texto: e.message }))
      .finally(() => setCargando(false))
  }, [id, api])

  const conInscritos = original?.tiene_inscripciones && (original.cupos_ocupados > 0)
  const set = (k: keyof Form) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: '' }))
  }

  function validar() {
    const e: Record<string, string> = {}
    for (const k of ['nombre', 'descripcion', 'fecha_inicio', 'fecha_fin', 'cupo_maximo', 'costo', 'horas_academicas'] as const) {
      if (!f[k].trim()) e[k] = MENSAJES[k]
    }
    if (f.modalidad !== 'virtual' && !f.lugar.trim()) e.lugar = MENSAJES.lugar
    if (f.fecha_inicio && f.fecha_fin && f.fecha_fin <= f.fecha_inicio) e.fecha_fin = MENSAJES.fecha_fin
    if (f.cupo_maximo && !(Number(f.cupo_maximo) > 0)) e.cupo_maximo = MENSAJES.cupo_maximo
    if (f.costo && !(Number(f.costo) >= 0)) e.costo = MENSAJES.costo
    const pct = Number(f.porcentaje_minimo)
    if (!(pct >= 1 && pct <= 100)) e.porcentaje_minimo = MENSAJES.porcentaje_minimo
    return e
  }

  async function guardar(accion: 'borrador' | 'publicar' | 'guardar') {
    setGeneral(null)
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) {
      setGeneral({ texto: 'Completa los campos resaltados.' })
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus())
      return
    }
    setEnviando(accion)
    try {
      const r = await api<{ evento: Evento }>('guardar_evento', {
        id: id ?? null, accion, nombre: f.nombre, descripcion: f.descripcion, modalidad: f.modalidad,
        lugar: f.modalidad === 'virtual' ? null : f.lugar, fecha_inicio: desdeInputLocal(f.fecha_inicio), fecha_fin: desdeInputLocal(f.fecha_fin),
        cupo_maximo: f.cupo_maximo, costo: f.costo, horas_academicas: f.horas_academicas, porcentaje_minimo: f.porcentaje_minimo,
        firmante_nombre: f.firmante_nombre, firmante_cargo: f.firmante_cargo,
      })
      notas.exito(accion === 'publicar' ? 'Evento publicado' : accion === 'borrador' ? 'Borrador guardado' : 'Cambios guardados')
      navegar(`/organizador/eventos/${r.evento.id}`)
    } catch (err) {
      if (err instanceof ErrorApi) {
        if (err.campos.length) setErrores(Object.fromEntries(err.campos.map((c) => [c, err.message])))
        setGeneral({ texto: err.message, plan: err.codigo === 'PLAN' })
      } else setGeneral({ texto: String(err) })
    } finally {
      setEnviando(null)
    }
  }

  if (cargando) return <CargandoLista filas={2} />

  const esBorrador = !original || original.estado === 'borrador'
  const sinPagos = plan && !plan.permite_pagos
  const sinVirtual = plan && !plan.permite_virtual

  return (
    <div className="mx-auto max-w-[860px]">
      <EncabezadoPagina
        volver={<Link to={id ? `/organizador/eventos/${id}` : '/organizador'} className="mb-3 inline-flex items-center gap-1.5 text-sm text-tinta-3 no-underline hover:text-tinta"><ArrowLeft className="size-4" />{id ? 'Volver al evento' : 'Mis eventos'}</Link>}
        titulo={id ? 'Editar evento' : 'Nuevo evento'}
        descripcion={esBorrador ? 'Guárdalo como borrador para terminarlo después o publícalo para recibir inscripciones.' : 'Los cambios de fecha, hora o lugar se avisan por correo a los inscritos.'}
      />

      <form ref={formRef} onSubmit={(e) => { e.preventDefault(); guardar(esBorrador ? 'publicar' : 'guardar') }} noValidate className="space-y-5">
        {conInscritos && (
          <Aviso tipo="info" titulo="Este evento ya tiene inscritos">El costo y la modalidad quedan fijos. Si necesitas cambiarlos, cancela el evento y crea uno nuevo.</Aviso>
        )}

        <Panel className="space-y-5 p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">Datos generales</h2>
          <Campo etiqueta="Nombre del evento" htmlFor="nombre" error={errores.nombre}>
            <Entrada id="nombre" value={f.nombre} onChange={(e) => set('nombre')(e.target.value)} invalido={!!errores.nombre} maxLength={160} />
          </Campo>
          <Campo etiqueta="Descripción" htmlFor="desc" error={errores.descripcion} ayuda="Qué aprenderán los asistentes y a quién está dirigido.">
            <AreaTexto id="desc" value={f.descripcion} onChange={(e) => set('descripcion')(e.target.value)} invalido={!!errores.descripcion} rows={4} />
          </Campo>
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-tinta-2">Modalidad</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(['presencial', 'virtual', 'mixta'] as const).map((m) => {
                const bloqueada = conInscritos && m !== original!.modalidad
                return (
                  <label key={m} className={cx('flex cursor-pointer flex-col rounded-lg border px-3.5 py-3 transition-colors',
                    f.modalidad === m ? 'border-grana bg-grana-clara/50' : 'border-linea-fuerte hover:border-tinta-3',
                    bloqueada && 'cursor-not-allowed opacity-50')}>
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <input type="radio" name="modalidad" className="size-4 accent-grana" checked={f.modalidad === m} disabled={bloqueada}
                        onChange={() => set('modalidad')(m)} />
                      {m === 'presencial' ? 'Presencial' : m === 'virtual' ? 'Virtual' : 'Mixta'}
                    </span>
                    <span className="mt-0.5 pl-6 text-xs text-tinta-3">
                      {m === 'presencial' ? 'En un local, con QR en la puerta' : m === 'virtual' ? 'Zoom, Meet o Teams' : 'Local y transmisión en vivo'}
                      {m !== 'presencial' && sinVirtual && ' · requiere plan Pro'}
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
          {f.modalidad !== 'virtual' && (
            <Campo etiqueta="Lugar" htmlFor="lugar" error={errores.lugar} ayuda="Ambiente, edificio y dirección.">
              <Entrada id="lugar" value={f.lugar} onChange={(e) => set('lugar')(e.target.value)} invalido={!!errores.lugar} />
            </Campo>
          )}
          {f.modalidad !== 'presencial' && (
            <p className="text-[13px] text-tinta-3">El enlace de la sala se agrega desde la gestión del evento; solo lo verán los inscritos confirmados.</p>
          )}
        </Panel>

        <Panel className="space-y-5 p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">Fecha, cupos y costo</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Inicio" htmlFor="ini" error={errores.fecha_inicio} ayuda="Hora de Perú">
              <Entrada id="ini" type="datetime-local" value={f.fecha_inicio} onChange={(e) => set('fecha_inicio')(e.target.value)} invalido={!!errores.fecha_inicio} />
            </Campo>
            <Campo etiqueta="Fin" htmlFor="fin" error={errores.fecha_fin} ayuda="Si dura varios días, cada día es una jornada de asistencia.">
              <Entrada id="fin" type="datetime-local" value={f.fecha_fin} onChange={(e) => set('fecha_fin')(e.target.value)} invalido={!!errores.fecha_fin} />
            </Campo>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Cupo máximo" htmlFor="cupo" error={errores.cupo_maximo}
              ayuda={plan?.max_cupo_evento ? `Tu plan permite hasta ${plan.max_cupo_evento}.` : undefined}>
              <Entrada id="cupo" type="number" min={1} inputMode="numeric" value={f.cupo_maximo} onChange={(e) => set('cupo_maximo')(e.target.value)} invalido={!!errores.cupo_maximo} />
            </Campo>
            <Campo etiqueta="Costo (S/)" htmlFor="costo" error={errores.costo}
              ayuda={conInscritos ? <span className="inline-flex items-center gap-1"><Lock className="size-3.5" />Fijo: ya hay inscritos</span> : sinPagos ? 'Tu plan solo admite eventos gratuitos.' : '0 = gratuito'}>
              <Entrada id="costo" type="number" min={0} step="0.5" inputMode="decimal" value={f.costo} disabled={!!conInscritos}
                onChange={(e) => set('costo')(e.target.value)} invalido={!!errores.costo} />
            </Campo>
            <Campo etiqueta="Horas académicas" htmlFor="horas" error={errores.horas_academicas}>
              <Entrada id="horas" type="number" min={1} inputMode="numeric" value={f.horas_academicas} onChange={(e) => set('horas_academicas')(e.target.value)} invalido={!!errores.horas_academicas} />
            </Campo>
          </div>
        </Panel>

        <Panel className="space-y-5 p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">Certificado</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Asistencia mínima (%)" htmlFor="pct" error={errores.porcentaje_minimo} ayuda="Para recibir el certificado.">
              <Entrada id="pct" type="number" min={1} max={100} value={f.porcentaje_minimo} onChange={(e) => set('porcentaje_minimo')(e.target.value)} invalido={!!errores.porcentaje_minimo} />
            </Campo>
            <Campo etiqueta="Firma" htmlFor="firm" opcional>
              <Entrada id="firm" value={f.firmante_nombre} onChange={(e) => set('firmante_nombre')(e.target.value)} />
            </Campo>
            <Campo etiqueta="Cargo de quien firma" htmlFor="cargo" opcional>
              <Entrada id="cargo" value={f.firmante_cargo} onChange={(e) => set('firmante_cargo')(e.target.value)} />
            </Campo>
          </div>
        </Panel>

        {general && (
          <Aviso tipo={general.plan ? 'alerta' : 'error'} titulo={general.plan ? 'Función fuera de tu plan' : undefined}>{general.texto}</Aviso>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {esBorrador ? (
            <>
              <Boton tamano="lg" cargando={enviando === 'borrador'} disabled={!!enviando} onClick={() => guardar('borrador')}>Guardar borrador</Boton>
              <Boton type="submit" variante="primario" tamano="lg" cargando={enviando === 'publicar'} disabled={!!enviando}>Publicar evento</Boton>
            </>
          ) : (
            <Boton type="submit" variante="primario" tamano="lg" cargando={enviando === 'guardar'}>Guardar cambios</Boton>
          )}
        </div>
      </form>
    </div>
  )
}
