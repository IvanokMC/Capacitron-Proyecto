// Verificaciones contra el proyecto Supabase configurado en .env.local:
//   1. Realtime publica los cambios de public.actividad_eventos.
//   2. Dos inscripciones simultáneas por el último cupo (HU-05 CA-04).
// Uso: node tests/supabase/verificar-supabase.mjs
// Deja datos de prueba (un evento cancelado y dos cuentas *@prueba.capacitron.demo);
// se limpian con supabase/reiniciar_demo.sql.
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.includes('=')).map((l) => l.trim().split(/=(.*)/s).slice(0, 2)))
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

async function rpc(fn, p = {}) {
  const { data, error } = await sb.rpc(fn, { p })
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}
const login = async (correo, password = 'Capacitron2026') => (await rpc('iniciar_sesion', { correo, password })).token

// 1) Realtime --------------------------------------------------------------
async function realtime() {
  const ana = await login('estudiante@capacitron.demo')
  const evento = (await rpc('catalogo_eventos')).find((e) => e.cupos_disponibles === 0 && e.fase === 'proximo')
  if (!evento) return 'SIN DATOS: no hay un evento lleno para provocar actividad'
  const recibidos = []
  await new Promise((ok, mal) => {
    sb.channel('verificacion').on('postgres_changes', { event: '*', schema: 'public', table: 'actividad_eventos' },
      (m) => recibidos.push(m)).subscribe((estado) => (estado === 'SUBSCRIBED' ? ok() : estado === 'CHANNEL_ERROR' ? mal(new Error(estado)) : null))
  })
  const salir = async () => {
    const mis = await rpc('mis_inscripciones', { token: ana })
    const espera = mis.lista_espera.find((l) => l.evento.id === evento.id)
    if (espera) await rpc('salir_lista_espera', { token: ana, id: espera.id })
  }
  await salir() // por si una ejecución anterior quedó a medias
  const r = await rpc('unirse_lista_espera', { token: ana, evento_id: evento.id })
  await salir()
  await new Promise((s) => setTimeout(s, 4000))
  await sb.removeAllChannels()
  return recibidos.length > 0
    ? `OK: ${recibidos.length} eventos de Realtime recibidos (lista de espera posición ${r.posicion}, luego retirada)`
    : 'FALLÓ: no llegó ningún evento de Realtime (revisar la publicación supabase_realtime)'
}

// 2) Concurrencia -----------------------------------------------------------
async function cuentaPrueba(correo) {
  try {
    await rpc('registrar_usuario', { nombres: 'Prueba', apellidos: correo.split('@')[0], correo, password: 'Prueba2026x', acepta_privacidad: true })
    const correos = await rpc('correo_demo', { para: correo })
    const token = correos.find((c) => c.tipo === 'confirmacion').accion_url.split('/').pop()
    await rpc('confirmar_cuenta', { token })
  } catch (e) {
    if (!String(e.message).includes('Ya existe')) throw e
  }
  return login(correo, 'Prueba2026x')
}

async function concurrencia() {
  const org = await login('coordinacion@capacitron.demo')
  const inicio = new Date(Date.now() + 5 * 86400_000)
  const { evento } = await rpc('guardar_evento', {
    token: org, accion: 'publicar', nombre: 'Prueba de concurrencia (HU-05 CA-04)', descripcion: 'Evento de verificación automática.',
    fecha_inicio: inicio.toISOString(), fecha_fin: new Date(inicio.getTime() + 3600_000).toISOString(),
    modalidad: 'presencial', lugar: 'Prueba', cupo_maximo: 1, costo: 0, horas_academicas: 1,
  })
  const [a, b] = await Promise.all([cuentaPrueba('a@prueba.capacitron.demo'), cuentaPrueba('b@prueba.capacitron.demo')])
  // Las dos solicitudes salen a la vez por conexiones HTTP distintas.
  const resultados = await Promise.all([a, b].map((token) => rpc('inscribirse', { token, evento_id: evento.id, lista_espera_automatica: true })))
  const g = await rpc('evento_gestion', { token: org, id: evento.id })
  await rpc('cancelar_evento', { token: org, id: evento.id, motivo: 'Evento de verificación automática' })
  const ok = resultados.filter((r) => r.ok).length === 1 && resultados.some((r) => r.motivo === 'sin_cupos' && r.en_lista_espera)
    && g.cupos.ocupados === 1 && g.cupos.en_espera === 1
  return `${ok ? 'OK' : 'FALLÓ'}: ${JSON.stringify(resultados.map((r) => (r.ok ? 'inscrito' : `${r.motivo}, en espera=${r.en_lista_espera}`)))} · cupos ocupados ${g.cupos.ocupados}/1, en espera ${g.cupos.en_espera}`
}

console.log('Realtime     →', await realtime().catch((e) => `ERROR: ${e.message}`))
if (!process.argv.includes('--solo-realtime')) console.log('Concurrencia →', await concurrencia().catch((e) => `ERROR: ${e.message}`))
process.exit(0)
