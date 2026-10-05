import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let org: string
beforeEach(async () => {
  bd = await nuevaBd()
  org = (await bd.organizador('org@test.pe')).token
})

describe('HU-10 Reportes de participación', () => {
  it('CA-01 muestra inscritos, asistentes, porcentaje de asistencia e ingreso total', async () => {
    const e = await bd.evento(org, { inicioH: 1, costo: 0 })
    const ana = await bd.cuenta('ana@test.pe')
    const { inscripcion } = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await bd.rpc('inscribirse', { token: await bd.cuenta('beto@test.pe'), evento_id: e.id })
    await bd.adelantar(65)
    await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: inscripcion.codigo_qr })
    const r = await bd.rpc('reporte_participacion', { token: org })
    expect(r.totales).toMatchObject({ inscritos: 2, asistentes: 1, porcentaje_asistencia: 50, ingresos: 0 })
  })

  it('CA-02 cada inscripción, pago o asistencia actualiza la señal de tiempo real del evento', async () => {
    const e = await bd.evento(org)
    const version = async () => Number((await bd.sql(`select version from public.actividad_eventos where evento_id = $1`, [e.id]))[0]?.version ?? 0)
    const v0 = await version()
    await bd.rpc('inscribirse', { token: await bd.cuenta('ana@test.pe'), evento_id: e.id })
    expect(await version()).toBeGreaterThan(v0)
  })

  it('CA-04 filtra por fechas, modalidad y evento', async () => {
    await bd.evento(org, { nombre: 'Presencial', modalidad: 'presencial' })
    await bd.evento(org, { nombre: 'Virtual', modalidad: 'virtual', lugar: null })
    const r = await bd.rpc('reporte_participacion', { token: org, modalidad: 'virtual' })
    expect(r.eventos.map((x: any) => x.nombre)).toEqual(['Virtual'])
    const lejos = await bd.rpc('reporte_participacion', { token: org, desde: '2099-01-01' })
    expect(lejos.eventos).toHaveLength(0)
  })

  it('CA-05 niega el acceso a quien no es organizador y cada organizador ve solo sus eventos', async () => {
    const ana = await bd.cuenta('ana@test.pe')
    await expect(bd.rpc('reporte_participacion', { token: ana })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    await bd.evento(org)
    const otro = (await bd.organizador('otro@test.pe')).token
    expect((await bd.rpc('reporte_participacion', { token: otro })).eventos).toHaveLength(0)
  })

  it('CA-03 exportar exige un plan que lo incluya', async () => {
    const basico = (await bd.organizador('basico@test.pe', 'basico')).token
    await expect(bd.rpc('registrar_exportacion', { token: basico })).rejects.toMatchObject({ codigo: 'PLAN' })
    expect(await bd.rpc('registrar_exportacion', { token: org })).toEqual({ ok: true })
  })
})

describe('HU-11 Gestión de ponentes y programa', () => {
  it('CA-01 y CA-02 el ponente aparece en la página y el cronograma se ordena por hora', async () => {
    const e = await bd.evento(org, { duracionH: 6 })
    const { ponente } = await bd.rpc('guardar_ponente', { token: org, evento_id: e.id, nombre: 'Dra. Rojas', biografia: 'Bio', consentimiento: true })
    const t = (h: number) => new Date(new Date(e.fecha_inicio).getTime() + h * 3600_000).toISOString()
    await bd.rpc('guardar_sesion_programa', { token: org, evento_id: e.id, titulo: 'Segunda', inicio: t(3), fin: t(4), ponente_ids: [ponente.id] })
    await bd.rpc('guardar_sesion_programa', { token: org, evento_id: e.id, titulo: 'Primera', inicio: t(0), fin: t(1), ponente_ids: [ponente.id] })
    const d = await bd.rpc('detalle_evento', { id: e.id })
    expect(d.ponentes.map((x: any) => x.nombre)).toEqual(['Dra. Rojas'])
    expect(d.sesiones.map((x: any) => x.titulo)).toEqual(['Primera', 'Segunda'])
  })

  it('CA-03 advierte si dos sesiones del mismo ponente se cruzan', async () => {
    const e = await bd.evento(org, { duracionH: 6 })
    const { ponente } = await bd.rpc('guardar_ponente', { token: org, evento_id: e.id, nombre: 'Dra. Rojas', consentimiento: true })
    const t = (h: number) => new Date(new Date(e.fecha_inicio).getTime() + h * 3600_000).toISOString()
    await bd.rpc('guardar_sesion_programa', { token: org, evento_id: e.id, titulo: 'A', inicio: t(0), fin: t(2), ponente_ids: [ponente.id] })
    const r = await bd.rpc('guardar_sesion_programa', { token: org, evento_id: e.id, titulo: 'B', inicio: t(1), fin: t(3), ponente_ids: [ponente.id] })
    expect(r).toMatchObject({ ok: false, motivo: 'cruce', mensaje: expect.stringContaining('Dra. Rojas ya tiene la sesión «A»') })
    const forzado = await bd.rpc('guardar_sesion_programa', { token: org, evento_id: e.id, titulo: 'B', inicio: t(1), fin: t(3), ponente_ids: [ponente.id], forzar: true })
    expect(forzado).toMatchObject({ ok: true, con_cruce: true })
  })

  it('CA-04 al modificar el programa se notifica a los inscritos', async () => {
    const e = await bd.evento(org)
    await bd.rpc('inscribirse', { token: await bd.cuenta('ana@test.pe'), evento_id: e.id })
    await bd.rpc('guardar_ponente', { token: org, evento_id: e.id, nombre: 'Dra. Rojas', consentimiento: true })
    expect((await bd.correos('ana@test.pe')).at(-1)!.asunto).toMatch(/Se actualizó el programa/)
  })

  it('CA-05 rechaza fotos que no son imagen o que superan 1 MB', async () => {
    const e = await bd.evento(org)
    const base = { token: org, evento_id: e.id, nombre: 'X', consentimiento: true }
    await expect(bd.rpc('guardar_ponente', { ...base, foto: 'data:application/pdf;base64,AAAA' }))
      .rejects.toMatchObject({ detalle: { campos: ['foto'] } })
    await expect(bd.rpc('guardar_ponente', { ...base, foto: 'data:image/png;base64,' + 'A'.repeat(1_400_000) }))
      .rejects.toMatchObject({ message: expect.stringContaining('1 MB') })
    expect((await bd.rpc('guardar_ponente', { ...base, foto: 'data:image/png;base64,iVBORw0KGgo=' })).ok).toBe(true)
  })

  it('regla: los datos del ponente se publican solo con su consentimiento', async () => {
    const e = await bd.evento(org)
    await expect(bd.rpc('guardar_ponente', { token: org, evento_id: e.id, nombre: 'X', consentimiento: false }))
      .rejects.toMatchObject({ detalle: { campos: ['consentimiento'] } })
  })
})

describe('HU-12 Eventos virtuales', () => {
  async function virtual() {
    const e = await bd.evento(org, { modalidad: 'virtual', lugar: null, inicioH: 30, costo: 10 })
    const ponente = await bd.cuenta('ponente@test.pe', 'ponente')
    await bd.rpc('guardar_ponente', { token: org, evento_id: e.id, nombre: 'P', correo: 'ponente@test.pe', consentimiento: true })
    return { e, ponente }
  }

  it('CA-01 el ponente o el organizador asocian un enlace válido de Zoom, Meet o Teams', async () => {
    const { e, ponente } = await virtual()
    for (const enlace of ['https://us02web.zoom.us/j/123456789', 'https://meet.google.com/abc-defg-hij',
                          'https://teams.microsoft.com/l/meetup-join/19%3ameeting']) {
      expect((await bd.rpc('guardar_enlace_virtual', { token: ponente, evento_id: e.id, enlace })).ok).toBe(true)
    }
  })

  it('CA-02 rechaza enlaces de plataformas no admitidas', async () => {
    const { e } = await virtual()
    for (const enlace of ['https://youtube.com/live/x', 'http://meet.google.com/abc-defg-hij', 'https://zoom.us.evil.com/j/1']) {
      await expect(bd.rpc('guardar_enlace_virtual', { token: org, evento_id: e.id, enlace }))
        .rejects.toMatchObject({ detalle: { campos: ['enlace'] } })
    }
  })

  it('CA-03 y CA-04 solo lo ve quien tiene la inscripción confirmada', async () => {
    const { e } = await virtual()
    await bd.rpc('guardar_enlace_virtual', { token: org, evento_id: e.id, enlace: 'https://meet.google.com/abc-defg-hij' })
    const ana = await bd.cuenta('ana@test.pe')
    expect((await bd.rpc('detalle_evento', { id: e.id })).enlace_virtual).toBeNull()
    const { inscripcion } = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    expect((await bd.rpc('detalle_evento', { token: ana, id: e.id })).enlace_virtual).toBeNull() // pago pendiente
    const { pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: inscripcion.id, metodo: 'yape' })
    await bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'aprobado' })
    expect((await bd.rpc('detalle_evento', { token: ana, id: e.id })).enlace_virtual).toBe('https://meet.google.com/abc-defg-hij')
  })

  it('CA-05 los recordatorios incluyen el enlace y un reemplazo se envía por correo', async () => {
    const { e } = await virtual()
    await bd.rpc('guardar_enlace_virtual', { token: org, evento_id: e.id, enlace: 'https://meet.google.com/abc-defg-hij' })
    const ana = await bd.cuenta('ana@test.pe')
    const { inscripcion } = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    const { pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: inscripcion.id, metodo: 'plin' })
    await bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'aprobado' })
    await bd.rpc('guardar_enlace_virtual', { token: org, evento_id: e.id, enlace: 'https://meet.google.com/xyz-wxyz-xyz' })
    expect((await bd.correos('ana@test.pe')).at(-1)).toMatchObject({ asunto: expect.stringMatching(/Nuevo enlace/), accion_url: 'https://meet.google.com/xyz-wxyz-xyz' })
    await bd.adelantar(6 * 60 + 5)
    await bd.rpc('procesar_tareas')
    const rec = (await bd.correos('ana@test.pe')).find((c) => c.tipo === 'recordatorio')!
    expect(rec.cuerpo).toContain('Enlace de la sala: https://meet.google.com/xyz-wxyz-xyz')
  })
})

describe('HU-13 Panel de administración', () => {
  let admin: string
  beforeEach(async () => {
    await bd.cuenta('admin@test.pe')
    await bd.sql(`update capa.usuarios set rol = 'admin' where correo = 'admin@test.pe'`)
    admin = (await bd.rpc('iniciar_sesion', { correo: 'admin@test.pe', password: 'Clave2026x' })).token
  })

  it('CA-01 y CA-02 suspender aplica de inmediato y el usuario ve el motivo al ingresar', async () => {
    const ana = await bd.cuenta('ana@test.pe')
    const [{ id }] = await bd.sql(`select id from capa.usuarios where correo = 'ana@test.pe'`)
    await bd.rpc('admin_estado_usuario', { token: admin, id, estado: 'suspendida', motivo: 'Uso indebido' })
    await expect(bd.rpc('mis_inscripciones', { token: ana })).rejects.toMatchObject({ codigo: 'NO_AUTH' })
    expect(await bd.rpc('iniciar_sesion', { correo: 'ana@test.pe', password: 'Clave2026x' }))
      .toMatchObject({ ok: false, motivo: 'suspendida', mensaje: expect.stringContaining('Uso indebido') })
  })

  it('CA-03 una institución no usa funciones fuera de su plan y se le sugiere mejorarlo', async () => {
    const basico = (await bd.organizador('basico@test.pe', 'basico')).token
    await expect(bd.evento(basico, { costo: 20 })).rejects.toMatchObject({
      codigo: 'PLAN', message: 'El plan Básico de tu institución no incluye eventos con costo y pagos en línea. Mejora al plan Pro para habilitarlo.',
    })
    await expect(bd.evento(basico, { modalidad: 'virtual', lugar: null })).rejects.toMatchObject({ codigo: 'PLAN' })
  })

  it('CA-04 los nuevos límites de un plan rigen desde que se guardan', async () => {
    const basico = (await bd.organizador('basico@test.pe', 'basico')).token
    await expect(bd.evento(basico, { costo: 20 })).rejects.toMatchObject({ codigo: 'PLAN' })
    await bd.rpc('admin_guardar_plan', { token: admin, codigo: 'basico', precio_mensual: 0, max_eventos_activos: 3,
                                         max_cupo_evento: 100, permite_pagos: true })
    expect((await bd.evento(basico, { costo: 20 })).costo).toBe(20)
  })

  it('CA-05 cada acción queda en un historial con autor, fecha y detalle que no se puede borrar', async () => {
    await bd.rpc('admin_guardar_institucion', { token: admin, nombre: 'Nueva', plan_codigo: 'pro' })
    const h = await bd.rpc('admin_historial', { token: admin })
    expect(h[0]).toMatchObject({ actor_nombre: 'admin Prueba', accion: 'Creó institución', detalle: 'Nueva · plan pro' })
    expect(h[0].creado_en).toBeTruthy()
    await expect(bd.sql(`delete from capa.auditoria`)).rejects.toThrow(/no se puede modificar ni borrar/)
    await expect(bd.sql(`update capa.auditoria set detalle = 'x'`)).rejects.toThrow(/no se puede modificar ni borrar/)
  })

  it('regla: solo el administrador cambia roles', async () => {
    const ana = await bd.cuenta('ana@test.pe')
    const [{ id }] = await bd.sql(`select id from capa.usuarios where correo = 'ana@test.pe'`)
    await expect(bd.rpc('admin_editar_usuario', { token: ana, id, nombres: 'a', apellidos: 'b', rol: 'admin' }))
      .rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    await bd.rpc('admin_editar_usuario', { token: admin, id, nombres: 'Ana', apellidos: 'H', rol: 'ponente' })
    const [u] = await bd.sql(`select rol from capa.usuarios where id = $1`, [id])
    expect(u.rol).toBe('ponente')
  })

  it('una institución suspendida no puede ingresar', async () => {
    const o = await bd.organizador('o2@test.pe')
    await bd.rpc('admin_estado_institucion', { token: admin, id: o.institucion, estado: 'suspendida', motivo: 'Falta de pago' })
    expect(await bd.rpc('iniciar_sesion', { correo: 'o2@test.pe', password: 'Clave2026x' }))
      .toMatchObject({ ok: false, mensaje: expect.stringContaining('Falta de pago') })
  })
})

describe('HU-14 Encuesta de satisfacción', () => {
  async function conAsistentes() {
    const e = await bd.evento(org, { inicioH: 1, duracionH: 2 })
    const ana = await bd.cuenta('ana@test.pe')
    const beto = await bd.cuenta('beto@test.pe')
    const ausente = await bd.cuenta('ausente@test.pe')
    const a = (await bd.rpc('inscribirse', { token: ana, evento_id: e.id })).inscripcion
    const b = (await bd.rpc('inscribirse', { token: beto, evento_id: e.id })).inscripcion
    await bd.rpc('inscribirse', { token: ausente, evento_id: e.id })
    await bd.adelantar(65)
    await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: a.codigo_qr })
    await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: b.codigo_qr })
    return { e, ana, beto, ausente }
  }

  it('CA-01 al cerrar el evento se envía la encuesta solo a los asistentes registrados', async () => {
    const { e } = await conAsistentes()
    await bd.rpc('guardar_encuesta', { token: org, evento_id: e.id, anonima: false, preguntas: ['¿Te gustó?', '¿Volverías?'] })
    await bd.adelantar(2 * 60)
    await bd.rpc('procesar_tareas')
    expect((await bd.correos('ana@test.pe')).some((c) => c.tipo === 'encuesta')).toBe(true)
    expect((await bd.correos('ausente@test.pe')).some((c) => c.tipo === 'encuesta')).toBe(false)
  })

  it('CA-02 la respuesta se guarda una sola vez', async () => {
    const { e, ana } = await conAsistentes()
    await bd.adelantar(2 * 60)
    await bd.rpc('procesar_tareas')
    await bd.rpc('responder_encuesta', { token: ana, evento_id: e.id, puntajes: [5, 4, 5, 4, 5], comentario: 'Bien' })
    await expect(bd.rpc('responder_encuesta', { token: ana, evento_id: e.id, puntajes: [1, 1, 1, 1, 1] }))
      .rejects.toMatchObject({ codigo: 'YA_RESPONDIO' })
  })

  it('CA-03 y CA-04 con modo anónimo no se ve quién respondió; se muestran promedios y distribución por pregunta', async () => {
    const { e, ana, beto } = await conAsistentes()
    await bd.rpc('guardar_encuesta', { token: org, evento_id: e.id, anonima: true, preguntas: ['P1', 'P2'] })
    await bd.adelantar(2 * 60)
    await bd.rpc('procesar_tareas')
    await bd.rpc('responder_encuesta', { token: ana, evento_id: e.id, puntajes: [5, 3], comentario: 'Excelente' })
    await bd.rpc('responder_encuesta', { token: beto, evento_id: e.id, puntajes: [4, 3] })
    const r = await bd.rpc('resultados_encuesta', { token: org, evento_id: e.id })
    expect(r.total_respuestas).toBe(2)
    expect(r.preguntas[0]).toEqual({ texto: 'P1', promedio: 4.5, distribucion: [0, 0, 0, 1, 1] })
    expect(r.comentarios).toEqual([expect.objectContaining({ texto: 'Excelente', autor: null })])
    expect(JSON.stringify(r)).not.toContain('ana@test.pe')
  })

  it('CA-05 la encuesta se cierra a los 7 días', async () => {
    const { e, ana } = await conAsistentes()
    await bd.adelantar(2 * 60)
    await bd.rpc('procesar_tareas')
    await bd.adelantar(7 * 24 * 60 + 1)
    await expect(bd.rpc('responder_encuesta', { token: ana, evento_id: e.id, puntajes: [5, 5, 5, 5, 5] }))
      .rejects.toMatchObject({ codigo: 'CERRADA' })
  })

  it('regla: máximo 10 preguntas con escala de 1 a 5', async () => {
    const { e, ana } = await conAsistentes()
    await expect(bd.rpc('guardar_encuesta', { token: org, evento_id: e.id, preguntas: Array.from({ length: 11 }, (_, i) => `P${i}`) }))
      .rejects.toMatchObject({ detalle: { campos: ['preguntas'] } })
    await bd.adelantar(2 * 60)
    await bd.rpc('procesar_tareas')
    await expect(bd.rpc('responder_encuesta', { token: ana, evento_id: e.id, puntajes: [6, 5, 5, 5, 5] }))
      .rejects.toMatchObject({ detalle: { campos: ['puntajes'] } })
  })
})

describe('Datos de demostración', () => {
  it('siembra eventos en todas las fases y se puede ingresar con cada rol', async () => {
    const demo = await nuevaBd({ demo: true })
    const fases = (await demo.rpc('catalogo_eventos', { incluir_pasados: true })).map((e: any) => e.fase)
    expect(new Set(fases)).toEqual(new Set(['finalizado', 'en_curso', 'proximo']))
    for (const correo of ['admin', 'coordinacion', 'ponente', 'estudiante'].map((c) => `${c}@capacitron.demo`)) {
      expect((await demo.rpc('iniciar_sesion', { correo, password: 'Capacitron2026' })).ok).toBe(true)
    }
    const [{ n }] = await demo.sql(`select count(*)::int n from capa.certificados where estado = 'revocado'`)
    expect(n).toBe(1)
  })
})
