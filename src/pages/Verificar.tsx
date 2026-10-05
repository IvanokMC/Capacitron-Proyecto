import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera, CheckCircle, Prohibit, Question, ShieldCheck, Timer, XCircle } from '@phosphor-icons/react'
import { useApp } from '../lib/app'
import { fechaCorta, fechaLarga, rangoEvento } from '../lib/formato'
import { EscanerQr, idNavegador } from '../components/qr'
import { Boton, cx, Entrada, Panel } from '../components/ui'

interface Resultado {
  estado: 'valido' | 'invalido' | 'no_encontrado' | 'bloqueado' | 'vacio'
  mensaje?: string
  codigo?: string
  titular?: string
  evento?: string
  fecha_inicio?: string
  fecha_fin?: string
  horas_academicas?: number
  institucion?: string | null
  emitido_en?: string
  revocado_en?: string | null
}

/** HU-09: verificación pública, sin iniciar sesión. */
export function Verificar() {
  const { codigo: desdeUrl } = useParams()
  const { api } = useApp()
  const navegar = useNavigate()
  const [codigo, setCodigo] = useState(desdeUrl ?? '')
  const [r, setR] = useState<Resultado | null>(null)
  const [consultando, setConsultando] = useState(false)
  const [camara, setCamara] = useState(false)

  async function consultar(c: string) {
    if (!c.trim()) return
    setConsultando(true)
    try {
      setR(await api<Resultado>('verificar_certificado', { codigo: c, solicitante: idNavegador() }))
    } catch (e: any) {
      setR({ estado: 'no_encontrado', mensaje: e.message })
    } finally {
      setConsultando(false)
    }
  }

  useEffect(() => {
    if (desdeUrl) {
      setCodigo(desdeUrl)
      consultar(desdeUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desdeUrl])

  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpio = codigo.trim().replace(/^.*\//, '').toUpperCase()
    if (limpio && limpio !== desdeUrl) navegar(`/verificar/${encodeURIComponent(limpio)}`)
    else consultar(limpio)
  }

  return (
    <div className="mx-auto max-w-[720px]">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-anil-clara text-anil"><ShieldCheck className="size-7" weight="duotone" /></span>
        <div>
          <h1 className="text-[28px] font-semibold leading-tight">Verificar un certificado</h1>
          <p className="mt-1.5 text-[15px] text-tinta-3">
            Escribe el código impreso en el certificado o escanea su QR. No necesitas una cuenta.
          </p>
        </div>
      </div>

      <form onSubmit={enviar} className="mt-7 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="codigo" className="sr-only">Código del certificado</label>
        <Entrada id="codigo" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="CAP-XXXX-XXXX-XXXX"
          autoComplete="off" spellCheck={false} className="h-12 font-mono text-base uppercase tracking-wider" />
        <div className="flex gap-2">
          <Boton type="submit" variante="primario" tamano="lg" cargando={consultando} className="flex-1 sm:flex-none">Verificar</Boton>
          <Boton tamano="lg" onClick={() => setCamara((v) => !v)} icono={<Camera className="size-5" />} aria-pressed={camara}>
            <span className="sm:hidden">Escanear</span><span className="hidden sm:inline">{camara ? 'Cerrar cámara' : 'Escanear QR'}</span>
          </Boton>
        </div>
      </form>

      {camara && (
        <div className="mx-auto mt-4 max-w-sm">
          <EscanerQr onLeer={(t) => {
            setCamara(false)
            const c = t.trim().replace(/^.*\//, '').toUpperCase()
            setCodigo(c)
            navegar(`/verificar/${encodeURIComponent(c)}`)
          }} />
        </div>
      )}

      {r && <ResultadoVerificacion r={r} />}

      <p className="mt-8 text-[13px] leading-relaxed text-tinta-3">
        La verificación muestra solo el nombre del titular, el evento y sus fechas. Cada consulta queda registrada, y las consultas
        repetidas con códigos inexistentes se bloquean temporalmente.
      </p>
    </div>
  )
}

function ResultadoVerificacion({ r }: { r: Resultado }) {
  if (r.estado === 'valido' || r.estado === 'invalido') {
    const valido = r.estado === 'valido'
    return (
      <Panel className={cx('estampa mt-6 overflow-hidden', valido ? 'border-chilca/30' : 'border-error/30')}>
        <div className={cx('flex items-center gap-3 px-5 py-4', valido ? 'bg-chilca text-white' : 'bg-error text-white')}>
          {valido ? <CheckCircle weight="fill" className="size-7" /> : <XCircle weight="fill" className="size-7" />}
          <div>
            <p className="text-lg font-semibold">{valido ? 'Certificado válido' : 'Certificado inválido'}</p>
            <p className="text-sm text-white/85">
              {valido ? 'Fue emitido por CAPACITRON y está vigente.' : `Fue revocado el ${fechaLarga(r.revocado_en!)}.`}
            </p>
          </div>
        </div>
        <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
          <Dato t="Titular" v={r.titular} grande />
          <Dato t="Evento" v={r.evento} grande />
          <Dato t="Fechas" v={r.fecha_inicio && r.fecha_fin ? rangoEvento(r.fecha_inicio, r.fecha_fin) : ''} />
          <Dato t="Duración" v={`${r.horas_academicas} horas académicas`} />
          {r.institucion && <Dato t="Institución" v={r.institucion} />}
          <Dato t="Código" v={<span className="font-mono">{r.codigo}</span>} />
          {r.emitido_en && <Dato t="Emitido" v={fechaCorta(r.emitido_en)} />}
        </dl>
      </Panel>
    )
  }
  const cfg = {
    no_encontrado: [Question, 'Certificado no encontrado', 'border-linea'],
    bloqueado: [Timer, 'Consulta bloqueada temporalmente', 'border-qolle/40'],
    vacio: [Prohibit, 'Falta el código', 'border-linea'],
  } as const
  const [Icono, titulo, borde] = cfg[r.estado]
  return (
    <Panel className={cx('estampa mt-6 flex gap-3 p-5', borde)}>
      <Icono className="size-7 shrink-0 text-tinta-3" />
      <div>
        <p className="font-semibold">{titulo}</p>
        <p className="mt-0.5 text-sm text-tinta-2">{r.mensaje}</p>
      </div>
    </Panel>
  )
}

function Dato({ t, v, grande }: { t: string; v: ReactNode; grande?: boolean }) {
  return (
    <div>
      <dt className="text-[13px] text-tinta-3">{t}</dt>
      <dd className={cx('mt-0.5', grande ? 'text-[17px] font-semibold' : 'text-[15px]')}>{v}</dd>
    </div>
  )
}
