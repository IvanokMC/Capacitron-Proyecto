import { useEffect, useState, type FormEvent } from 'react'
import { Camera, CameraSlash, CheckCircle, Prohibit, ArrowsClockwise, ClockCountdown } from '@phosphor-icons/react'
import { useApp, useCarga } from '../../../lib/app'
import { claveDia, fechaCorta, hora, num } from '../../../lib/formato'
import { EscanerQr } from '../../../components/qr'
import { Aviso, Boton, cx, Entrada, Panel, Vacio } from '../../../components/ui'
import type { Gestion } from '../GestionEvento'

interface DatosAsistencia {
  jornada_actual: string
  total_jornadas: number
  habilitado: boolean
  confirmados: number
  presentes_hoy: number
  asistentes_total: number
  registros: { id: string; nombre: string; registrado_en: string; jornada: string }[]
}

interface Lectura { ok: boolean; tipo: 'registrado' | 'duplicado' | 'rechazado' | 'fuera_de_horario'; mensaje: string; nombre?: string; registrado_en?: string; n: number }

export function Asistencia({ e }: { e: Gestion }) {
  const { api, suscribirActividad } = useApp()
  const { datos, recargar } = useCarga<DatosAsistencia>('asistencia_evento', { evento_id: e.id })
  const [camara, setCamara] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => suscribirActividad(recargar), [suscribirActividad, recargar])

  async function registrar(texto: string) {
    if (!texto.trim() || procesando) return
    setProcesando(true)
    try {
      // Acepta el código dictado con espacios (grupos de 4) o el contenido del QR.
      const r = await api<Omit<Lectura, 'n'>>('registrar_asistencia', { evento_id: e.id, codigo: texto.trim().replace(/\s+/g, '') })
      setLectura({ ...r, n: Date.now() })
      if (r.ok) navigator.vibrate?.(60)
      else navigator.vibrate?.([40, 60, 40])
      setCodigo('')
      recargar()
    } catch (err: any) {
      setLectura({ ok: false, tipo: 'rechazado', mensaje: err.message, n: Date.now() })
    } finally {
      setProcesando(false)
    }
  }

  function enviar(ev: FormEvent) {
    ev.preventDefault()
    registrar(codigo)
  }

  if (!datos) return null
  // Número de jornada: días transcurridos desde el primer día del evento (hora de Lima).
  const desdeInicio = (Date.parse(datos.jornada_actual) - Date.parse(claveDia(e.fecha_inicio))) / 86_400_000
  const jornada = Math.min(Math.max(Math.round(desdeInicio) + 1, 1), datos.total_jornadas)

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <div className="space-y-4">
        {!datos.habilitado ? (
          <Aviso tipo="info" titulo="Registro de asistencia cerrado">
            {e.fase === 'finalizado' ? 'El evento ya terminó.' : e.estado !== 'publicado' ? 'Publica el evento primero.'
              : `Se habilita desde 1 hora antes del inicio (${fechaCorta(e.fecha_inicio)}, ${hora(e.fecha_inicio)} h) hasta el fin del evento.`}
          </Aviso>
        ) : (
          <Panel className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">
                {datos.total_jornadas > 1 ? `Jornada ${jornada} de ${datos.total_jornadas}` : 'Ingreso al evento'}
              </p>
              <Boton tamano="sm" variante={camara ? 'secundario' : 'primario'} icono={camara ? <CameraSlash className="size-4" /> : <Camera className="size-4" />}
                onClick={() => setCamara((v) => !v)}>
                {camara ? 'Cerrar cámara' : 'Escanear con la cámara'}
              </Boton>
            </div>
            {camara && <EscanerQr onLeer={registrar} pausado={procesando} />}
            <form onSubmit={enviar} className="mt-3 flex gap-2">
              <label htmlFor="codigo" className="sr-only">Código del QR</label>
              <Entrada id="codigo" value={codigo} onChange={(ev) => setCodigo(ev.target.value)} placeholder="O escribe o pega el código"
                autoComplete="off" spellCheck={false} className="font-mono text-sm" />
              <Boton type="submit" cargando={procesando}>Registrar</Boton>
            </form>
          </Panel>
        )}

        {lectura && <ResultadoLectura key={lectura.n} l={lectura} />}
      </div>

      <div>
        <Panel className="mb-4 grid grid-cols-3 divide-x divide-linea">
          <Contador valor={datos.presentes_hoy} etiqueta={datos.total_jornadas > 1 ? 'Presentes hoy' : 'Presentes'} />
          <Contador valor={datos.confirmados} etiqueta="Inscritos confirmados" />
          <Contador valor={datos.confirmados ? Math.round((100 * datos.presentes_hoy) / datos.confirmados) : 0} sufijo="%" etiqueta="Llegaron hoy" />
        </Panel>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Ingresos registrados</h2>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-tinta-3">
            <span className="size-2 animate-pulse rounded-full bg-chilca-viva motion-reduce:animate-none" aria-hidden />
            En vivo
            <button onClick={recargar} className="ml-1 rounded p-1 hover:bg-hundido hover:text-tinta" aria-label="Actualizar"><ArrowsClockwise className="size-4" /></button>
          </span>
        </div>
        {datos.registros.length === 0 ? (
          <Panel><Vacio icono={<ClockCountdown className="size-6" />} titulo="Nadie ha ingresado todavía">Cada código escaneado aparecerá aquí con su hora.</Vacio></Panel>
        ) : (
          <ul className="max-h-[520px] divide-y divide-linea overflow-y-auto rounded-xl border border-linea bg-superficie">
            {datos.registros.map((r, i) => (
              <li key={r.id} className={cx('flex items-center justify-between gap-3 px-4 py-2.5', i === 0 && lectura?.ok && 'estampa')}>
                <span className="flex items-center gap-2.5">
                  <span className="size-3 rounded-[2px] bg-chilca-viva" aria-hidden />
                  <span className="text-sm font-medium">{r.nombre}</span>
                </span>
                <span className="num text-[13px] text-tinta-3">
                  {datos.total_jornadas > 1 && `${fechaCorta(r.registrado_en)} · `}{hora(r.registrado_en)} h
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Contador({ valor, etiqueta, sufijo }: { valor: number; etiqueta: string; sufijo?: string }) {
  return (
    <div className="px-4 py-4 text-center">
      <p className="text-[30px] font-semibold leading-none tracking-[-0.03em]">{num(valor)}{sufijo && <span className="text-lg">{sufijo}</span>}</p>
      <p className="mt-1.5 text-xs text-tinta-3">{etiqueta}</p>
    </div>
  )
}

function ResultadoLectura({ l }: { l: Lectura }) {
  const cfg = {
    registrado: ['bg-chilca text-white', CheckCircle, 'Asistencia registrada'],
    duplicado: ['bg-qolle text-tinta', ClockCountdown, 'Ya había ingresado'],
    rechazado: ['bg-error text-white', Prohibit, 'Código rechazado'],
    fuera_de_horario: ['bg-hundido text-tinta', ClockCountdown, 'Fuera de horario'],
  } as const
  const [clase, Icono, titulo] = cfg[l.tipo]
  return (
    <div role="status" className={cx('estampa flex items-start gap-3 rounded-xl px-4 py-4', clase)}>
      <Icono weight="fill" className="size-8 shrink-0" />
      <div>
        <p className="text-[17px] font-semibold">{l.tipo === 'registrado' ? l.nombre : titulo}</p>
        <p className="text-sm opacity-90">{l.tipo === 'registrado' ? `Ingresó a las ${hora(l.registrado_en!)} h.` : l.mensaje}</p>
      </div>
    </div>
  )
}
