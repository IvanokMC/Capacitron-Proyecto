// Base de datos de prueba: PGlite en memoria con las mismas migraciones que Supabase.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readFileSync } from 'node:fs'

const MIGRACIONES = [
  '20261005000001_esquema.sql',
  '20261005000002_funciones_base.sql',
  '20261005000003_funciones_operacion.sql',
  '20261005000004_demo.sql',
  '20261005000006_endurecimiento.sql',
].map((f) => readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8'))

export class ErrorRpc extends Error {
  constructor(message: string, public codigo: string, public detalle: any) {
    super(message)
  }
}

export type Bd = Awaited<ReturnType<typeof nuevaBd>>

export async function nuevaBd({ demo = false } = {}) {
  const db = await PGlite.create({ extensions: { pgcrypto } })
  await db.exec('create schema if not exists extensions;')
  for (const sql of MIGRACIONES) await db.exec(sql)
  if (demo) await db.query('select capa.sembrar_demo()')

  async function rpc<T = any>(fn: string, p: Record<string, unknown> = {}): Promise<T> {
    try {
      const r = await db.query<{ r: T }>(`select public.${fn}($1::jsonb) as r`, [JSON.stringify(p)])
      return r.rows[0].r
    } catch (e: any) {
      let detalle = null
      try { detalle = e.detail ? JSON.parse(e.detail) : null } catch { /* texto plano */ }
      throw new ErrorRpc(e.message, e.hint ?? 'ERROR', detalle)
    }
  }

  async function sql<T = any>(q: string, params: unknown[] = []) {
    return (await db.query<T>(q, params)).rows
  }

  /** Adelanta el reloj de negocio (capa.ahora) en minutos. */
  async function adelantar(minutos: number) {
    await db.query(`update capa.config set reloj_offset = reloj_offset + make_interval(mins => $1::int)`, [minutos])
  }

  async function correos(para: string) {
    return sql<{ asunto: string; cuerpo: string; tipo: string; accion_url: string | null }>(
      `select asunto, cuerpo, tipo, accion_url from capa.correos where lower(para) = lower($1) order by enviado_en, orden`, [para])
  }

  /** Crea una cuenta activa y devuelve su token de sesión. */
  async function cuenta(correo: string, rol = 'asistente', institucion_id?: string) {
    await rpc('registrar_usuario', {
      nombres: correo.split('@')[0], apellidos: 'Prueba', correo, password: 'Clave2026x', rol,
      institucion_id, acepta_privacidad: true,
    })
    const [{ token }] = await sql<{ token: string }>(
      `select t.token from capa.tokens_confirmacion t join capa.usuarios u on u.id = t.usuario_id where u.correo = $1`, [correo])
    await rpc('confirmar_cuenta', { token })
    const r = await rpc('iniciar_sesion', { correo, password: 'Clave2026x' })
    return r.token as string
  }

  async function institucion(plan = 'enterprise', nombre = `Inst ${plan} ${Math.random()}`) {
    const [{ id }] = await sql<{ id: string }>(
      `insert into capa.instituciones (nombre, plan_codigo) values ($1, $2) returning id`, [nombre, plan])
    return id
  }

  /** Organizador con institución del plan indicado. */
  async function organizador(correo: string, plan = 'enterprise') {
    const inst = await institucion(plan)
    return { token: await cuenta(correo, 'organizador', inst), institucion: inst }
  }

  async function ahora() {
    return new Date((await sql<{ t: string }>(`select capa.ahora()::text as t`))[0].t)
  }

  /** Crea y publica un evento; las fechas se expresan en horas desde ahora. */
  async function evento(token: string, extra: Record<string, unknown> = {}, accion = 'publicar') {
    const base = await ahora()
    const h = (n: number) => new Date(base.getTime() + n * 3600_000).toISOString()
    const { inicioH = 72, duracionH = 3, ...resto } = extra as any
    const r = await rpc('guardar_evento', {
      token, nombre: 'Evento de prueba', descripcion: 'Descripción', fecha_inicio: h(inicioH),
      fecha_fin: h(inicioH + duracionH), modalidad: 'presencial', lugar: 'Aula 1', cupo_maximo: 10, costo: 0,
      horas_academicas: 3, accion, ...resto,
    })
    return r.evento as any
  }

  return { db, rpc, sql, adelantar, correos, cuenta, institucion, organizador, evento, ahora }
}
