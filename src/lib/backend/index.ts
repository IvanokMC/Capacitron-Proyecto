// Backend intercambiable: Supabase si hay credenciales; si no, Postgres local (PGlite).
// Ambos ejecutan exactamente las mismas funciones RPC definidas en supabase/migrations.

export class ErrorApi extends Error {
  constructor(
    message: string,
    /** Código de negocio: CAMPOS, PLAN, PROHIBIDO, NO_AUTH, NO_ENCONTRADO... */
    public codigo: string = 'ERROR',
    public detalle: { campos?: string[]; [k: string]: unknown } | null = null,
  ) {
    super(message)
  }
  get campos(): string[] {
    return this.detalle?.campos ?? []
  }
}

export interface Backend {
  modo: 'local' | 'supabase'
  rpc<T>(fn: string, p: Record<string, unknown>): Promise<T>
  /** Avisa cuando cambia la actividad de algún evento (inscripciones, pagos, asistencia). */
  suscribirActividad(cb: () => void): () => void
  /** Solo modo local: vuelve a crear la base con los datos de demostración. */
  restablecer?: () => Promise<void>
}

function parseDetalle(texto?: string | null) {
  if (!texto) return null
  try {
    return JSON.parse(texto)
  } catch {
    return null
  }
}

async function crearLocal(): Promise<Backend> {
  const [{ PGliteWorker }, { live }, { recrear }] = await Promise.all([
    import('@electric-sql/pglite/worker'),
    import('@electric-sql/pglite/live'),
    import('./migraciones'),
  ])
  const pg = await PGliteWorker.create(
    new Worker(new URL('./pglite.worker.ts', import.meta.url), { type: 'module' }),
    { extensions: { live } },
  )
  return {
    modo: 'local',
    async rpc<T>(fn: string, p: Record<string, unknown>) {
      let fila: { r: { r?: T; __error?: { message: string; hint: string | null; detail: string | null } } }
      try {
        fila = (await pg.query<typeof fila>('select capa.rpc_local($1, $2::jsonb) as r', [fn, JSON.stringify(p)])).rows[0]
      } catch (e: any) {
        throw new ErrorApi(e?.message ?? 'Error inesperado')
      }
      const err = fila.r.__error
      if (err) throw new ErrorApi(err.message, err.hint || 'ERROR', parseDetalle(err.detail))
      return fila.r.r as T
    },
    suscribirActividad(cb) {
      let cancelar: (() => Promise<void>) | null = null
      let activo = true
      let primera = true
      pg.live
        .query('select evento_id, version from public.actividad_eventos', [], () => {
          if (primera) { primera = false; return }
          cb()
        })
        .then((q) => {
          if (activo) cancelar = q.unsubscribe
          else q.unsubscribe()
        })
        .catch(() => {})
      return () => {
        activo = false
        cancelar?.()
      }
    },
    async restablecer() {
      await recrear(pg)
    },
  }
}

async function crearSupabase(url: string, clave: string): Promise<Backend> {
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, clave, { auth: { persistSession: false } })
  return {
    modo: 'supabase',
    async rpc<T>(fn: string, p: Record<string, unknown>) {
      const { data, error } = await sb.rpc(fn, { p })
      if (error) {
        throw new ErrorApi(error.message, error.hint || 'ERROR', parseDetalle(error.details))
      }
      return data as T
    },
    suscribirActividad(cb) {
      const canal = sb
        .channel(`actividad-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'actividad_eventos' }, () => cb())
        .subscribe()
      return () => {
        sb.removeChannel(canal)
      }
    },
  }
}

let instancia: Promise<Backend> | null = null

export function backend(): Promise<Backend> {
  if (!instancia) {
    const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
    const clave = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
    instancia = url && clave ? crearSupabase(url, clave) : crearLocal()
  }
  return instancia
}
