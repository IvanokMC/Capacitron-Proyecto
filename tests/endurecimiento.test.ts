import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
beforeEach(async () => { bd = await nuevaBd() })

async function admin() {
  await bd.cuenta('admin@test.pe')
  await bd.sql(`update capa.usuarios set rol = 'admin' where correo = 'admin@test.pe'`)
  return (await bd.rpc('iniciar_sesion', { correo: 'admin@test.pe', password: 'Clave2026x' })).token as string
}

describe('Pasarela simulada y modo demostración', () => {
  it('fuera del modo demostración la pasarela simulada no confirma pagos', async () => {
    const org = (await bd.organizador('org@test.pe')).token
    const e = await bd.evento(org, { costo: 30 })
    const ana = await bd.cuenta('ana@test.pe')
    const { inscripcion } = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    const { pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: inscripcion.id, metodo: 'yape' })
    await bd.rpc('admin_modo_demo', { token: await admin(), activo: false })
    await expect(bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'aprobado' }))
      .rejects.toMatchObject({ codigo: 'PASARELA_DESACTIVADA' })
    const [ins] = await bd.sql(`select estado from capa.inscripciones where id = $1`, [inscripcion.id])
    expect(ins.estado).toBe('pendiente_pago')
  })

  it('la implementación de la pasarela ya no es parte de la API pública', async () => {
    const r = await bd.sql(`select n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = 'pasarela_simulada'`)
    expect(r.map((x) => x.nspname)).toEqual(['capa'])
  })

  it('apagar el modo demostración cierra el buzón público, vuelve el reloj a la hora real y queda en el historial', async () => {
    const t = await admin()
    await bd.rpc('admin_reloj', { token: t, accion: 'avanzar', minutos: 120 })
    const r = await bd.rpc('admin_modo_demo', { token: t, activo: false })
    expect(r).toMatchObject({ modo_demo: false, reloj_desfase_min: 0 })
    await expect(bd.rpc('correo_demo', { para: 'admin@test.pe' })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    const h = await bd.rpc('admin_historial', { token: t })
    expect(h[0].accion).toBe('Desactivó el modo demostración')
  })

  it('solo la administración cambia el modo y consulta el diagnóstico', async () => {
    const ana = await bd.cuenta('ana@test.pe')
    await expect(bd.rpc('admin_modo_demo', { token: ana, activo: false })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    await expect(bd.rpc('admin_diagnostico', { token: ana })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
  })

  it('el diagnóstico informa cron, tiempo real y la última ejecución programada', async () => {
    const t = await admin()
    let d = await bd.rpc('admin_diagnostico', { token: t })
    expect(d).toMatchObject({ modo_demo: true, cron_instalado: false, realtime_activo: false, ultima_tarea_cron_en: null })
    await bd.rpc('procesar_tareas', { origen: 'cron' })
    d = await bd.rpc('admin_diagnostico', { token: t })
    expect(d.ultima_tarea_cron_en).toBeTruthy()
  })
})
