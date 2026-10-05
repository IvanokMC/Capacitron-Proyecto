import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { backend, ErrorApi, type Backend } from './backend'
import type { Usuario } from './tipos'

const CLAVE_TOKEN = 'capacitron.token'

function leerToken() {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

function guardarToken(t: string | null) {
  try {
    if (t) localStorage.setItem(CLAVE_TOKEN, t)
    else localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    /* almacenamiento no disponible: la sesión dura lo que dure la pestaña */
  }
}

interface EstadoSistema {
  ahora: string
  modo_demo: boolean
  reloj_desfase_min: number
}

interface Ctx {
  listo: boolean
  errorInicio: string | null
  modo: Backend['modo'] | null
  usuario: Usuario | null
  token: string | null
  /** Llama una función RPC agregando el token de sesión. */
  api: <T = any>(fn: string, p?: Record<string, unknown>) => Promise<T>
  ingresar: (token: string, usuario: Usuario) => void
  salir: () => Promise<void>
  refrescarUsuario: () => Promise<void>
  sistema: EstadoSistema | null
  /** Hora del sistema (incluye el desfase del reloj de demostración). */
  ahora: () => Date
  /** Aumenta cuando cambia el reloj o hay actividad: las vistas recargan. */
  pulso: number
  latir: () => void
  noLeidos: number
  refrescarBandeja: () => void
  suscribirActividad: (cb: () => void) => () => void
  restablecerDemo?: () => Promise<void>
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [be, setBe] = useState<Backend | null>(null)
  const [errorInicio, setErrorInicio] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(leerToken)
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [listo, setListo] = useState(false)
  const [sistema, setSistema] = useState<EstadoSistema | null>(null)
  const [pulso, setPulso] = useState(0)
  const [noLeidos, setNoLeidos] = useState(0)
  const desfase = useRef(0)
  const tokenRef = useRef(token)
  tokenRef.current = token

  const latir = useCallback(() => setPulso((n) => n + 1), [])

  const cerrarLocal = useCallback(() => {
    guardarToken(null)
    setToken(null)
    setUsuario(null)
    setNoLeidos(0)
  }, [])

  const api = useCallback(
    async <T,>(fn: string, p: Record<string, unknown> = {}): Promise<T> => {
      const b = be ?? (await backend())
      try {
        // La sesión va en p.token salvo que la llamada ya traiga su propio token
        // (el enlace de confirmación de cuenta).
        return await b.rpc<T>(fn, { ...(tokenRef.current ? { token: tokenRef.current } : {}), ...p })
      } catch (e) {
        if (e instanceof ErrorApi && e.codigo === 'NO_AUTH' && tokenRef.current) cerrarLocal()
        throw e
      }
    },
    [be, cerrarLocal],
  )

  const leerSistema = useCallback(async (b: Backend) => {
    const s = await b.rpc<EstadoSistema>('estado_sistema', {})
    desfase.current = new Date(s.ahora).getTime() - Date.now()
    setSistema(s)
    return s
  }, [])

  // Arranque: backend, hora del sistema y sesión guardada.
  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const b = await backend()
        if (!vivo) return
        setBe(b)
        await leerSistema(b)
        const t = leerToken()
        if (t) {
          const r = await b.rpc<{ usuario: Usuario | null }>('sesion_actual', { token: t })
          if (r.usuario) setUsuario(r.usuario)
          else cerrarLocal()
        }
      } catch (e: any) {
        setErrorInicio(e?.message ?? 'No se pudo iniciar la base de datos.')
      } finally {
        if (vivo) setListo(true)
      }
    })()
    return () => {
      vivo = false
    }
  }, [leerSistema, cerrarLocal])

  const refrescarBandeja = useCallback(() => {
    if (!be || !tokenRef.current) return
    be.rpc<{ no_leidos: number }>('mis_correos', { token: tokenRef.current })
      .then((r) => setNoLeidos(r.no_leidos))
      .catch(() => {})
  }, [be])

  // Tareas programadas (vencimientos, recordatorios, certificados, encuestas).
  // En Supabase también las ejecuta pg_cron; aquí garantizan la demo en modo local.
  useEffect(() => {
    if (!be) return
    let vivo = true
    const tic = async () => {
      try {
        const r = await be.rpc<Record<string, number>>('procesar_tareas', {})
        await leerSistema(be)
        const hubo = Object.entries(r).some(([k, v]) => k !== 'ahora' && typeof v === 'number' && v > 0)
        if (vivo && hubo) latir()
        refrescarBandeja()
      } catch {
        /* reintenta en el siguiente ciclo */
      }
    }
    tic()
    const id = window.setInterval(tic, 20_000)
    return () => {
      vivo = false
      window.clearInterval(id)
    }
  }, [be, leerSistema, latir, refrescarBandeja])

  useEffect(() => {
    refrescarBandeja()
  }, [usuario, pulso, refrescarBandeja])

  // Al cambiar el reloj de demostración, la hora y las vistas se actualizan.
  useEffect(() => {
    if (be && pulso > 0) leerSistema(be).catch(() => {})
  }, [be, pulso, leerSistema])

  const ingresar = useCallback((t: string, u: Usuario) => {
    guardarToken(t)
    setToken(t)
    setUsuario(u)
  }, [])

  const salir = useCallback(async () => {
    try {
      if (be && tokenRef.current) await be.rpc('cerrar_sesion', { token: tokenRef.current })
    } finally {
      cerrarLocal()
    }
  }, [be, cerrarLocal])

  const refrescarUsuario = useCallback(async () => {
    if (!be || !tokenRef.current) return
    const r = await be.rpc<{ usuario: Usuario | null }>('sesion_actual', { token: tokenRef.current })
    if (r.usuario) setUsuario(r.usuario)
    else cerrarLocal()
  }, [be, cerrarLocal])

  const ahora = useCallback(() => new Date(Date.now() + desfase.current), [])
  const suscribirActividad = useCallback((cb: () => void) => (be ? be.suscribirActividad(cb) : () => {}), [be])

  const valor = useMemo<Ctx>(
    () => ({
      listo, errorInicio, modo: be?.modo ?? null, usuario, token, api, ingresar, salir, refrescarUsuario,
      sistema, ahora, pulso, latir, noLeidos, refrescarBandeja,
      suscribirActividad,
      restablecerDemo: be?.restablecer,
    }),
    [listo, errorInicio, be, usuario, token, api, ingresar, salir, refrescarUsuario, sistema, ahora, pulso, latir,
     noLeidos, refrescarBandeja, suscribirActividad],
  )

  return <AppCtx.Provider value={valor}>{children}</AppCtx.Provider>
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp fuera de AppProvider')
  return c
}

/** Carga datos de una RPC y los vuelve a pedir cuando cambian las dependencias o el pulso global. */
export function useCarga<T>(fn: string | null, p: Record<string, unknown> = {}, deps: unknown[] = []) {
  const { api, pulso, listo } = useApp()
  const [datos, setDatos] = useState<T | null>(null)
  const [error, setError] = useState<ErrorApi | null>(null)
  const [cargando, setCargando] = useState(true)
  const [n, setN] = useState(0)
  const clave = JSON.stringify(p)

  useEffect(() => {
    if (!listo || !fn) return
    let vivo = true
    setCargando((c) => c || datos === null)
    api<T>(fn, JSON.parse(clave))
      .then((r) => {
        if (vivo) {
          setDatos(r)
          setError(null)
        }
      })
      .catch((e) => {
        if (vivo) setError(e instanceof ErrorApi ? e : new ErrorApi(String(e?.message ?? e)))
      })
      .finally(() => {
        if (vivo) setCargando(false)
      })
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, clave, pulso, n, listo, ...deps])

  const recargar = useCallback(() => setN((x) => x + 1), [])
  return { datos, error, cargando, recargar, setDatos }
}
