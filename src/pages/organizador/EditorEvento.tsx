import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Lock } from '@phosphor-icons/react'
import { useApp } from '../../lib/app'
import { ErrorApi } from '../../lib/backend'
import type { Evento, Plan } from '../../lib/tipos'
import { aInputLocal, desdeInputLocal } from '../../lib/formato'
import { Aviso, AreaTexto, Boton, Campo, CargandoLista, Casilla, cx, EncabezadoPagina, Entrada, Panel, Selector } from '../../components/ui'
import { faltantesParaPublicar, TIPOS_EVENTO } from '../../lib/validacionEvento'
import { SelectorUbicacion, type Punto } from '../../components/UbicacionEvento'
import { MapaEvento } from '../../components/MapaEvento'
import { puntoDe, useBusquedaDirecciones } from '../../lib/mapa'
import { useNotas } from '../../components/notificaciones'
import { CampoImagen, TEXTOS_IMAGEN } from '../../components/ImagenEvento'
import { almacenamiento, ErrorAlmacenamiento, useUrlArchivo } from '../../lib/almacenamiento'
import { IMAGEN_INICIAL, imagenVisible, useImagenElegida } from '../../lib/imagenElegida'
import { cambiosImagenes, hayCambiosImagenes, REGLAS_IMAGEN, type ClaveImagen, type ImagenFormulario } from '../../lib/imagenesEvento'

// CAP-77 (José, Frontend): el formulario suma tipo, organizador, contacto y consentimiento (HU-02, CA-06 a CA-08).
interface Form {
  nombre: string; descripcion: string; modalidad: string; lugar: string; fecha_inicio: string; fecha_fin: string
  cupo_maximo: string; costo: string; horas_academicas: string; porcentaje_minimo: string; firmante_nombre: string; firmante_cargo: string
  tipo: string; organizador_nombre: string; contacto: string; contacto_consentimiento: boolean
}

// Lo que evento_gestion devuelve al organizador (el contacto no sale en las vistas públicas).
type EventoGestion = Evento & {
  tiene_inscripciones: boolean
  tipo: string | null
  organizador_nombre: string | null
  contacto: string | null
  contacto_consentimiento: boolean
}

const VACIO: Form = {
  nombre: '', descripcion: '', modalidad: 'presencial', lugar: '', fecha_inicio: '', fecha_fin: '', cupo_maximo: '',
  costo: '0', horas_academicas: '', porcentaje_minimo: '80', firmante_nombre: '', firmante_cargo: '',
  tipo: '', organizador_nombre: '', contacto: '', contacto_consentimiento: false,
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
  const [original, setOriginal] = useState<EventoGestion | null>(null)
  const [cargando, setCargando] = useState(!!id)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<{ texto: string; plan?: boolean } | null>(null)
  const [enviando, setEnviando] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const plan: Plan | undefined = usuario?.institucion?.plan
  // CAP-105 (José): punto en el mapa (HU-19 CA-01). Solo se buscan direcciones cuando la persona escribe.
  const [punto, setPunto] = useState<Punto | null>(null)
  const [buscarLugar, setBuscarLugar] = useState(false)
  const busqueda = useBusquedaDirecciones(buscarLugar ? f.lugar : null)
  // CAP-110 (José): flyer e imagen del lugar (HU-20 CA-01, CA-02 y CA-04). Los estados (vista previa, rechazo
  // con motivo, quitar) son los mismos que los de la foto de perfil (lib/imagenElegida.ts); el diseño es el de
  // CampoImagen (CAP-108, Medaly). Se suben al guardar el evento, no al elegirlas.
  const flyer = useImagenElegida(REGLAS_IMAGEN.flyer)
  const imgLugar = useImagenElegida(REGLAS_IMAGEN.imagen_lugar)
  const [altFlyer, setAltFlyer] = useState('')
  const [altLugar, setAltLugar] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const urlFlyer = useUrlArchivo('eventos', original?.flyer_url)
  const urlLugar = useUrlArchivo('eventos', original?.imagen_lugar_url)

  useEffect(() => {
    if (!id) return
    api<EventoGestion>('evento_gestion', { id })
      .then((e) => {
        setOriginal(e)
        setF({
          nombre: e.nombre, descripcion: e.descripcion, modalidad: e.modalidad, lugar: e.lugar ?? '',
          fecha_inicio: aInputLocal(e.fecha_inicio), fecha_fin: aInputLocal(e.fecha_fin), cupo_maximo: String(e.cupo_maximo),
          costo: String(e.costo), horas_academicas: String(e.horas_academicas), porcentaje_minimo: String(e.porcentaje_minimo),
          firmante_nombre: e.firmante_nombre ?? '', firmante_cargo: e.firmante_cargo ?? '',
          tipo: e.tipo ?? '', organizador_nombre: e.organizador_nombre ?? '', contacto: e.contacto ?? '',
          contacto_consentimiento: e.contacto_consentimiento ?? false,
        })
        setPunto(puntoDe(e))
        setAltFlyer(e.flyer_alt ?? '')
        setAltLugar(e.imagen_lugar_alt ?? '')
      })
      .catch((e) => setGeneral({ texto: e.message }))
      .finally(() => setCargando(false))
  }, [id, api])

  const conInscritos = original?.tiene_inscripciones && (original.cupos_ocupados > 0)
  const set = (k: keyof Form) => (v: string | boolean) => {
    setF((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: '' }))
  }

  // Publicar exige además tipo, lugar, organizador y contacto (CA-07); un borrador se guarda incompleto (CA-02).
  function validar(accion: 'borrador' | 'publicar' | 'guardar') {
    const e: Record<string, string> = accion === 'publicar' ? faltantesParaPublicar({ ...f, tienePunto: !!punto }) : {}
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
    const e = validar(accion)
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
        tipo: f.tipo || null, organizador_nombre: f.organizador_nombre, contacto: f.contacto,
        contacto_consentimiento: f.contacto_consentimiento,
        latitud: f.modalidad === 'virtual' ? null : punto?.lat ?? null,
        longitud: f.modalidad === 'virtual' ? null : punto?.lng ?? null,
      })
      if (!(await guardarImagenes(r.evento.id))) return
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

  /**
   * CAP-110: después de guardar el evento (ya tiene id y carpeta), sube las imágenes nuevas y guarda sus rutas con
   * guardar_imagenes_evento (CAP-109). Devuelve false si falló: el evento ya quedó guardado, así que se avisa y
   * se deja la edición de ese evento abierta para volver a intentarlo.
   */
  async function guardarImagenes(eventoId: string): Promise<boolean> {
    const imagenes: Record<ClaveImagen, ImagenFormulario> = {
      flyer: { estado: flyer.estado, alt: altFlyer, ruta: original?.flyer_url ?? null, altGuardado: original?.flyer_alt ?? null },
      // En un evento virtual no hay bloque de ubicación (HU-19 CA-04): la imagen del lugar no se toca.
      imagen_lugar: f.modalidad === 'virtual'
        ? { estado: IMAGEN_INICIAL, alt: original?.imagen_lugar_alt ?? '', ruta: original?.imagen_lugar_url ?? null, altGuardado: original?.imagen_lugar_alt ?? null }
        : { estado: imgLugar.estado, alt: altLugar, ruta: original?.imagen_lugar_url ?? null, altGuardado: original?.imagen_lugar_alt ?? null },
    }
    if (!hayCambiosImagenes(imagenes)) return true
    setSubiendo(true)
    try {
      const cambios = await cambiosImagenes(await almacenamiento(), eventoId, imagenes)
      await api('guardar_imagenes_evento', { id: eventoId, ...cambios })
      return true
    } catch (err) {
      const motivo = err instanceof ErrorAlmacenamiento && err.codigo === 'ARCHIVO' ? err.message
        : err instanceof ErrorApi ? err.message : 'No se pudo subir la imagen. Revisa tu conexión e inténtalo de nuevo.'
      notas.error(`El evento se guardó, pero no las imágenes: ${motivo}`)
      if (id) {
        if (imagenes.flyer.estado.archivo) flyer.fallo(motivo)
        if (imagenes.imagen_lugar.estado.archivo) imgLugar.fallo(motivo)
      } else navegar(`/organizador/eventos/${eventoId}/editar`, { replace: true })
      return false
    } finally {
      setSubiendo(false)
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
          {/* CAP-110: flyer después de la descripción, como en la ficha CAP-108 (CA-01 y CA-04). */}
          <CampoImagen etiqueta={TEXTOS_IMAGEN.flyer} ayuda={TEXTOS_IMAGEN.ayudaFlyer}
            vista={imagenVisible(flyer.estado, urlFlyer)} vistaPrevia={!!flyer.estado.previa}
            onElegir={flyer.elegir} onQuitar={flyer.quitar} error={flyer.estado.error} cargando={subiendo && !!flyer.estado.archivo}
            alt={altFlyer} onAlt={setAltFlyer} altEjemplo={TEXTOS_IMAGEN.altEjemploFlyer} />
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
            // CAP-105: lugar y punto en el mapa con el diseño de CAP-103; el mapa real entra por la prop `mapa`.
            <SelectorUbicacion
              lugar={f.lugar}
              onLugar={(v) => { set('lugar')(v); setBuscarLugar(true) }}
              sugerencias={busqueda.resultados}
              buscando={busqueda.buscando}
              sinResultados={busqueda.sinResultados}
              onElegir={(idSug) => {
                const r = busqueda.resultados.find((x) => x.id === idSug)
                if (!r) return
                setBuscarLugar(false)
                set('lugar')(r.nombre)
                setPunto(r.punto)
                setErrores((x) => ({ ...x, ubicacion: '', latitud: '', longitud: '' }))
              }}
              punto={punto}
              onQuitarPunto={() => setPunto(null)}
              mapa={<MapaEvento punto={punto} etiqueta="Mapa para marcar el lugar del evento"
                onElegir={(p) => { setPunto(p); setBuscarLugar(false); setErrores((x) => ({ ...x, ubicacion: '', latitud: '', longitud: '' })) }} />}
              error={errores.ubicacion || errores.latitud || errores.longitud || null}
              errorLugar={errores.lugar || null}
            />
          )}
          {f.modalidad !== 'virtual' && (
            // CAP-110: imagen del lugar debajo del selector de ubicación (CA-02); en la página va junto al mapa.
            <CampoImagen etiqueta={TEXTOS_IMAGEN.lugar} ayuda={TEXTOS_IMAGEN.ayudaLugar} proporcion="lugar"
              vista={imagenVisible(imgLugar.estado, urlLugar)} vistaPrevia={!!imgLugar.estado.previa}
              onElegir={imgLugar.elegir} onQuitar={imgLugar.quitar} error={imgLugar.estado.error} cargando={subiendo && !!imgLugar.estado.archivo}
              alt={altLugar} onAlt={setAltLugar} altEjemplo={TEXTOS_IMAGEN.altEjemploLugar} />
          )}
          {f.modalidad !== 'presencial' && (
            <p className="text-[13px] text-tinta-3">El enlace de la sala se agrega desde la gestión del evento; solo lo verán los inscritos confirmados.</p>
          )}
        </Panel>

        <Panel className="space-y-5 p-5 sm:p-6">
          <div>
            <h2 className="text-[15px] font-semibold">Tipo, organizador y contacto</h2>
            <p className="mt-1 text-[13px] text-tinta-3">Se piden para publicar. Puedes guardar el borrador sin ellos.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Tipo de evento" htmlFor="tipo" error={errores.tipo}>
              <Selector id="tipo" value={f.tipo} onChange={(e) => set('tipo')(e.target.value)} invalido={!!errores.tipo}>
                <option value="">Elige un tipo</option>
                {TIPOS_EVENTO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
              </Selector>
            </Campo>
            <Campo etiqueta="Organizador" htmlFor="org" error={errores.organizador_nombre} ayuda="Persona o entidad que el público verá como organizadora.">
              <Entrada id="org" value={f.organizador_nombre} onChange={(e) => set('organizador_nombre')(e.target.value)}
                invalido={!!errores.organizador_nombre} maxLength={160} />
            </Campo>
          </div>
          <Campo etiqueta="Contacto" htmlFor="contacto" error={errores.contacto} ayuda="Correo o teléfono para consultas sobre el evento.">
            <Entrada id="contacto" value={f.contacto} onChange={(e) => set('contacto')(e.target.value)} invalido={!!errores.contacto} maxLength={160} />
          </Campo>
          <Casilla id="consent" checked={f.contacto_consentimiento} onChange={(v) => set('contacto_consentimiento')(v)}>
            Autorizo mostrar este contacto en la página pública del evento. Si no lo autorizas, el público verá un formulario de
            contacto en su lugar (Ley N.° 29733).
          </Casilla>
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
