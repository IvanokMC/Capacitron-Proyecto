import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, CheckCircle, EnvelopeSimple, Eye, EyeSlash, Lock, Tray, WarningCircle } from '@phosphor-icons/react'
import { useApp, useCarga } from '../lib/app'
import { ErrorApi } from '../lib/backend'
import type { Usuario } from '../lib/tipos'
import { Aviso, Boton, BotonEnlace, Campo, Casilla, cx, Dialogo, Entrada, Panel, Selector } from '../components/ui'
import { useNotas } from '../components/notificaciones'

function inicioSegunRol(u: Usuario) {
  return u.rol === 'organizador' ? '/organizador' : u.rol === 'admin' ? '/admin' : u.rol === 'ponente' ? '/ponente' : '/mis-inscripciones'
}

function Tarjeta({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[440px]">
      <h1 className="text-[26px] font-semibold">{titulo}</h1>
      {descripcion && <p className="mt-1.5 text-[15px] text-tinta-3">{descripcion}</p>}
      <Panel className="mt-6 p-5 shadow-panel sm:p-6">{children}</Panel>
    </div>
  )
}

function CampoClave({ valor, onChange, invalido, autoComplete, id }: {
  valor: string; onChange: (v: string) => void; invalido?: boolean; autoComplete: string; id: string
}) {
  const [ver, setVer] = useState(false)
  return (
    <div className="relative">
      <Entrada id={id} type={ver ? 'text' : 'password'} value={valor} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} invalido={invalido} className="pr-11" required />
      <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-tinta-3 hover:text-tinta">
        {ver ? <EyeSlash className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ingresar
// ---------------------------------------------------------------------------

const DEMO = [
  { correo: 'estudiante@capacitron.demo', rol: 'Asistente', nombre: 'Ana Lucía Huamán' },
  { correo: 'coordinacion@capacitron.demo', rol: 'Organizadora · UNSAAC (Enterprise)', nombre: 'Carmen Valdivia' },
  { correo: 'capacitacion.iac@capacitron.demo', rol: 'Organizador · IAC (Pro)', nombre: 'Jorge Paredes' },
  { correo: 'cursos.qhapaq@capacitron.demo', rol: 'Organizadora · CEQ (Básico)', nombre: 'Elena Ccori' },
  { correo: 'ponente@capacitron.demo', rol: 'Ponente', nombre: 'Raúl Quispe' },
  { correo: 'admin@capacitron.demo', rol: 'Administración', nombre: 'Lucía Mamani' },
]

export function Ingresar() {
  const { api, ingresar, usuario, sistema } = useApp()
  const [params] = useSearchParams()
  const navegar = useNavigate()
  const [correo, setCorreo] = useState('')
  const [clave, setClave] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [fallo, setFallo] = useState<{ motivo: string; mensaje: string; correo?: string; intentos_restantes?: number } | null>(null)
  const [reenviado, setReenviado] = useState(false)
  const volver = params.get('volver')

  useEffect(() => {
    if (usuario) navegar(volver ?? inicioSegunRol(usuario), { replace: true })
  }, [usuario, volver, navegar])

  async function enviar(ev: FormEvent) {
    ev.preventDefault()
    setEnviando(true)
    setFallo(null)
    try {
      const r = await api<any>('iniciar_sesion', { correo, password: clave })
      if (r.ok) ingresar(r.token, r.usuario)
      else setFallo(r)
    } catch (e) {
      setFallo({ motivo: 'error', mensaje: e instanceof Error ? e.message : String(e) })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-start">
      <Tarjeta titulo="Ingresar" descripcion="Accede a tus inscripciones, certificados y eventos.">
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <Campo etiqueta="Correo" htmlFor="correo">
            <Entrada id="correo" type="email" autoComplete="email" value={correo} onChange={(e) => setCorreo(e.target.value)}
              invalido={fallo?.motivo === 'credenciales'} required />
          </Campo>
          <Campo etiqueta="Contraseña" htmlFor="clave">
            <CampoClave id="clave" valor={clave} onChange={setClave} autoComplete="current-password" invalido={fallo?.motivo === 'credenciales'} />
          </Campo>

          {fallo && (
            <Aviso tipo={fallo.motivo === 'pendiente' ? 'alerta' : 'error'}
              titulo={fallo.motivo === 'bloqueada' ? 'Cuenta bloqueada temporalmente' : fallo.motivo === 'suspendida' ? 'Acceso suspendido' : undefined}
              accion={fallo.motivo === 'pendiente' && (
                <div className="flex flex-wrap gap-2">
                  <Boton tamano="sm" disabled={reenviado} onClick={async () => {
                    await api('reenviar_confirmacion', { correo: fallo.correo ?? correo })
                    setReenviado(true)
                  }}>{reenviado ? 'Enlace enviado' : 'Reenviar enlace'}</Boton>
                  {sistema?.modo_demo && (
                    <BotonEnlace tamano="sm" to={`/correo-demo?para=${encodeURIComponent(fallo.correo ?? correo)}`}>Abrir buzón de demostración</BotonEnlace>
                  )}
                </div>
              )}>
              {fallo.mensaje}
              {fallo.intentos_restantes !== undefined && fallo.intentos_restantes <= 3 && (
                <> Te {fallo.intentos_restantes === 1 ? 'queda 1 intento' : `quedan ${fallo.intentos_restantes} intentos`} antes de que la cuenta se bloquee 15 minutos.</>
              )}
            </Aviso>
          )}

          <Boton type="submit" variante="primario" tamano="lg" className="w-full" cargando={enviando}>Ingresar</Boton>
          <p className="text-center text-sm text-tinta-3">
            ¿No tienes cuenta? <Link to="/registro" className="font-medium text-grana-tinta">Crea una</Link>
          </p>
        </form>
      </Tarjeta>

      {sistema?.modo_demo && (
        <section aria-labelledby="demo" className="rounded-xl border border-dashed border-linea-fuerte p-5 lg:mt-[84px]">
          <h2 id="demo" className="text-[15px] font-semibold">Cuentas de demostración</h2>
          <p className="mt-1 text-[13px] text-tinta-3">Datos ficticios. Contraseña de todas: <code className="font-mono text-tinta-2">Capacitron2026</code></p>
          <ul className="mt-3 space-y-1">
            {DEMO.map((d) => (
              <li key={d.correo}>
                <button type="button" onClick={() => { setCorreo(d.correo); setClave('Capacitron2026'); setFallo(null) }}
                  className="w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-hundido">
                  <span className="block text-sm font-medium">{d.nombre}</span>
                  <span className="block text-xs text-tinta-3">{d.rol}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registro (HU-01)
// ---------------------------------------------------------------------------

const ROLES = [
  { valor: 'asistente', titulo: 'Asistente', texto: 'Me inscribo en eventos y descargo certificados.' },
  { valor: 'organizador', titulo: 'Organizador', texto: 'Creo eventos para mi institución.' },
  { valor: 'ponente', titulo: 'Ponente', texto: 'Dicto charlas y gestiono su enlace virtual.' },
]

export function Registro() {
  const { api, sistema, usuario } = useApp()
  const navegar = useNavigate()
  const { datos: instituciones } = useCarga<{ id: string; nombre: string; siglas: string | null }[]>('instituciones_publicas')
  const [f, setF] = useState({ nombres: '', apellidos: '', correo: '', password: '', rol: 'asistente', institucion_id: '' })
  const [acepta, setAcepta] = useState(false)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [general, setGeneral] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState<string | null>(null)
  const [politica, setPolitica] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (usuario) navegar(inicioSegunRol(usuario), { replace: true })
  }, [usuario, navegar])

  const set = (k: keyof typeof f) => (v: string) => {
    setF((x) => ({ ...x, [k]: v }))
    setErrores((e) => ({ ...e, [k]: '' }))
  }

  const largo = f.password.length >= 8
  const letrasNumeros = /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(f.password) && /\d/.test(f.password)

  function validar() {
    const e: Record<string, string> = {}
    if (!f.nombres.trim()) e.nombres = 'Escribe tus nombres.'
    if (!f.apellidos.trim()) e.apellidos = 'Escribe tus apellidos.'
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.correo.trim())) e.correo = 'Ingresa un correo válido, por ejemplo nombre@universidad.edu.pe.'
    if (!largo || !letrasNumeros) e.password = 'Usa al menos 8 caracteres y combina letras y números.'
    if (f.rol === 'organizador' && !f.institucion_id) e.institucion_id = 'Elige la institución que organiza tus eventos.'
    if (!acepta) e.acepta_privacidad = 'Necesitamos tu aceptación para crear la cuenta.'
    return e
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault()
    setGeneral(null)
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) {
      formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    setEnviando(true)
    try {
      await api('registrar_usuario', { ...f, institucion_id: f.institucion_id || null, acepta_privacidad: acepta })
      setListo(f.correo.trim().toLowerCase())
    } catch (err) {
      if (err instanceof ErrorApi && err.campos.length) {
        setErrores(Object.fromEntries(err.campos.map((c) => [c, err.message])))
      } else setGeneral(err instanceof Error ? err.message : String(err))
    } finally {
      setEnviando(false)
    }
  }

  if (listo) {
    return (
      <Tarjeta titulo="Revisa tu correo">
        <div className="flex gap-3">
          <EnvelopeSimple className="size-7 shrink-0 text-anil" />
          <div className="text-[15px] text-tinta-2">
            <p>Te enviamos un enlace de confirmación a <b className="text-tinta">{listo}</b>. Ábrelo dentro de las próximas 24 horas para activar tu cuenta.</p>
          </div>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          {sistema?.modo_demo && (
            <BotonEnlace to={`/correo-demo?para=${encodeURIComponent(listo)}`} variante="primario" icono={<Tray className="size-4" />}>
              Abrir el buzón de demostración
            </BotonEnlace>
          )}
          <BotonEnlace to="/ingresar">Ir a ingresar</BotonEnlace>
        </div>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta titulo="Crear cuenta" descripcion="Regístrate con tu correo para inscribirte en eventos u organizarlos.">
      <form ref={formRef} onSubmit={enviar} className="space-y-4" noValidate>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-tinta-2">Me registro como</legend>
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <label key={r.valor} className={cx('flex cursor-pointer gap-3 rounded-lg border px-3.5 py-3 transition-colors',
                f.rol === r.valor ? 'border-grana bg-grana-clara/50' : 'border-linea-fuerte hover:border-tinta-3')}>
                <input type="radio" name="rol" value={r.valor} checked={f.rol === r.valor} onChange={() => set('rol')(r.valor)}
                  className="mt-1 size-4 accent-grana" />
                <span>
                  <span className="block text-sm font-medium">{r.titulo}</span>
                  <span className="block text-[13px] text-tinta-3">{r.texto}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {f.rol === 'organizador' && (
          <Campo etiqueta="Institución" htmlFor="inst" error={errores.institucion_id}>
            <Selector id="inst" value={f.institucion_id} onChange={(e) => set('institucion_id')(e.target.value)} invalido={!!errores.institucion_id}>
              <option value="">Elige tu institución</option>
              {(instituciones ?? []).map((i) => <option key={i.id} value={i.id}>{i.nombre}</option>)}
            </Selector>
          </Campo>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombres" htmlFor="nombres" error={errores.nombres}>
            <Entrada id="nombres" autoComplete="given-name" value={f.nombres} onChange={(e) => set('nombres')(e.target.value)} invalido={!!errores.nombres} />
          </Campo>
          <Campo etiqueta="Apellidos" htmlFor="apellidos" error={errores.apellidos}>
            <Entrada id="apellidos" autoComplete="family-name" value={f.apellidos} onChange={(e) => set('apellidos')(e.target.value)} invalido={!!errores.apellidos} />
          </Campo>
        </div>
        <Campo etiqueta="Correo" htmlFor="correo" error={errores.correo}>
          <Entrada id="correo" type="email" autoComplete="email" value={f.correo} onChange={(e) => set('correo')(e.target.value)} invalido={!!errores.correo} />
        </Campo>
        <Campo etiqueta="Contraseña" htmlFor="password" error={errores.password}>
          <CampoClave id="password" valor={f.password} onChange={set('password')} autoComplete="new-password" invalido={!!errores.password} />
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <Requisito ok={largo}>Al menos 8 caracteres</Requisito>
            <Requisito ok={letrasNumeros}>Letras y números</Requisito>
          </ul>
        </Campo>

        <div>
          <Casilla checked={acepta} onChange={(v) => { setAcepta(v); setErrores((e) => ({ ...e, acepta_privacidad: '' })) }} invalido={!!errores.acepta_privacidad}>
            Acepto la <button type="button" className="font-medium text-grana-tinta underline" onClick={() => setPolitica(true)}>política de privacidad</button>.
          </Casilla>
          {errores.acepta_privacidad && <p className="ml-7 mt-1 text-[13px] text-error">{errores.acepta_privacidad}</p>}
        </div>

        {general && <Aviso tipo="error">{general}</Aviso>}

        <Boton type="submit" variante="primario" tamano="lg" className="w-full" cargando={enviando}>Crear cuenta</Boton>
        <p className="text-center text-sm text-tinta-3">¿Ya tienes cuenta? <Link to="/ingresar" className="font-medium text-grana-tinta">Ingresa</Link></p>
      </form>

      <Dialogo abierto={politica} onCerrar={() => setPolitica(false)} titulo="Política de privacidad" pie={<Boton variante="primario" onClick={() => { setAcepta(true); setPolitica(false) }}>Acepto</Boton>}>
        <div className="space-y-3 text-sm leading-relaxed text-tinta-2">
          <p>CAPACITRON recoge solo los datos necesarios para gestionar tu participación: nombres, apellidos, correo, inscripciones, pagos, asistencia y certificados.</p>
          <p>Tu contraseña se guarda cifrada. No almacenamos números de tarjeta ni credenciales de pago: los gestiona la plataforma de pago.</p>
          <p>La verificación pública de un certificado muestra únicamente tu nombre, el evento y sus fechas. Los datos de ponentes se publican con su consentimiento.</p>
          <p>Puedes actualizar tus datos desde tu perfil y desactivar los recordatorios cuando quieras.</p>
        </div>
      </Dialogo>
    </Tarjeta>
  )
}

function Requisito({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={cx('inline-flex items-center gap-1.5', ok ? 'text-chilca' : 'text-tinta-3')}>
      {ok ? <Check weight="bold" className="size-3.5" /> : <span className="size-3.5 rounded-full border border-current" />}
      {children}
    </li>
  )
}

// ---------------------------------------------------------------------------
// Confirmación de correo
// ---------------------------------------------------------------------------

export function Confirmar() {
  const { token } = useParams()
  const { api } = useApp()
  const notas = useNotas()
  const [r, setR] = useState<{ ok: boolean; motivo?: string; mensaje?: string; correo?: string; ya_confirmada?: boolean } | null>(null)
  const [reenviado, setReenviado] = useState(false)

  useEffect(() => {
    api<any>('confirmar_cuenta', { token }).then(setR).catch((e) => setR({ ok: false, mensaje: e.message }))
  }, [api, token])

  if (!r) return <Tarjeta titulo="Confirmando tu cuenta…"><p className="text-sm text-tinta-3">Un momento.</p></Tarjeta>

  if (r.ok) {
    return (
      <Tarjeta titulo={r.ya_confirmada ? 'Tu cuenta ya estaba activa' : 'Cuenta activada'}>
        <div className="flex gap-3">
          <CheckCircle weight="fill" className="size-7 shrink-0 text-chilca" />
          <p className="text-[15px] text-tinta-2">Ya puedes ingresar con {r.correo ? <b className="text-tinta">{r.correo}</b> : 'tu correo'} y tu contraseña.</p>
        </div>
        <BotonEnlace to="/ingresar" variante="primario" tamano="lg" className="mt-5 w-full" icono={<Lock className="size-4" />}>Ingresar</BotonEnlace>
      </Tarjeta>
    )
  }

  return (
    <Tarjeta titulo={r.motivo === 'vencido' ? 'El enlace venció' : 'Enlace no válido'}>
      <div className="flex gap-3">
        <WarningCircle weight="fill" className="size-7 shrink-0 text-error" />
        <p className="text-[15px] text-tinta-2">{r.mensaje}</p>
      </div>
      {r.motivo === 'vencido' && r.correo && (
        <Boton variante="primario" tamano="lg" className="mt-5 w-full" disabled={reenviado}
          onClick={async () => {
            await api('reenviar_confirmacion', { correo: r.correo })
            setReenviado(true)
            notas.exito('Te enviamos un nuevo enlace de confirmación')
          }}>
          {reenviado ? 'Nuevo enlace enviado' : 'Enviarme un nuevo enlace'}
        </Boton>
      )}
    </Tarjeta>
  )
}
