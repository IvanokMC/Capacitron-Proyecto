import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let org: string
beforeEach(async () => {
  bd = await nuevaBd()
  org = (await bd.organizador('org@test.pe')).token
})

const asuntos = async (correo: string) => (await bd.correos(correo)).map((c) => c.asunto)

describe('HU-06 Recordatorios automáticos', () => {
  it('CA-01 y CA-02 envía un recordatorio 24 h antes y otro 1 h antes', async () => {
    const e = await bd.evento(org, { inicioH: 48, nombre: 'Charla' })
    const ana = await bd.cuenta('ana@test.pe')
    await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await bd.adelantar(23 * 60)
    await bd.rpc('procesar_tareas')
    expect(await asuntos('ana@test.pe')).not.toContain('Mañana: Charla')
    await bd.adelantar(61)
    await bd.rpc('procesar_tareas')
    await bd.rpc('procesar_tareas') // idempotente: no duplica
    expect((await asuntos('ana@test.pe')).filter((a) => a === 'Mañana: Charla')).toHaveLength(1)
    await bd.adelantar(23 * 60)
    await bd.rpc('procesar_tareas')
    expect(await asuntos('ana@test.pe')).toContain('En 1 hora: Charla')
  })

  it('CA-03 el recordatorio incluye nombre, fecha, hora, modalidad y lugar', async () => {
    const e = await bd.evento(org, { inicioH: 10, nombre: 'Charla', lugar: 'Auditorio A', modalidad: 'presencial' })
    await bd.adelantar(-30 * 60) // inscripción con más de 24 h de anticipación
    const ana = await bd.cuenta('ana@test.pe')
    await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await bd.adelantar(30 * 60)
    await bd.rpc('procesar_tareas')
    const c = (await bd.correos('ana@test.pe')).find((x) => x.tipo === 'recordatorio')!
    expect(c.cuerpo).toContain('Evento: Charla')
    expect(c.cuerpo).toMatch(/Inicio: .+ \d\d:\d\d h/)
    expect(c.cuerpo).toContain('Modalidad: Presencial')
    expect(c.cuerpo).toContain('Lugar: Auditorio A')
  })

  it('CA-04 no envía recordatorios a quien los desactivó', async () => {
    const e = await bd.evento(org, { inicioH: 30 })
    const ana = await bd.cuenta('ana@test.pe')
    await bd.rpc('actualizar_perfil', { token: ana, nombres: 'Ana', apellidos: 'H', recordatorios_activos: false })
    await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await bd.adelantar(29 * 60 + 30)
    await bd.rpc('procesar_tareas')
    expect((await bd.correos('ana@test.pe')).filter((c) => c.tipo === 'recordatorio')).toHaveLength(0)
  })

  it('CA-05 si cambia la fecha, los recordatorios se reprograman con los datos nuevos', async () => {
    const e = await bd.evento(org, { inicioH: 30, nombre: 'Charla' })
    const ana = await bd.cuenta('ana@test.pe')
    await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await bd.adelantar(6 * 60 + 5) // faltan ~24 h
    await bd.rpc('procesar_tareas')
    expect(await asuntos('ana@test.pe')).toContain('Mañana: Charla')
    // Se posterga 3 días: el aviso de cambio llega y el recordatorio se vuelve a enviar con la nueva fecha.
    const nuevo = new Date(new Date(e.fecha_inicio).getTime() + 72 * 3600_000).toISOString()
    const fin = new Date(new Date(e.fecha_fin).getTime() + 72 * 3600_000).toISOString()
    await bd.rpc('guardar_evento', { ...e, token: org, id: e.id, fecha_inicio: nuevo, fecha_fin: fin })
    expect(await asuntos('ana@test.pe')).toContain('Cambios en Charla')
    await bd.adelantar(72 * 60)
    await bd.rpc('procesar_tareas')
    expect((await asuntos('ana@test.pe')).filter((a) => a === 'Mañana: Charla')).toHaveLength(2)
  })

  it('regla: no se recuerda a inscripciones canceladas ni a la lista de espera', async () => {
    const e = await bd.evento(org, { inicioH: 30, cupo_maximo: 1 })
    const ana = await bd.cuenta('ana@test.pe')
    const beto = await bd.cuenta('beto@test.pe')
    const { inscripcion } = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await bd.rpc('unirse_lista_espera', { token: beto, evento_id: e.id })
    await bd.rpc('cancelar_inscripcion', { token: ana, id: inscripcion.id })
    await bd.adelantar(6 * 60 + 5)
    await bd.rpc('procesar_tareas')
    expect((await bd.correos('ana@test.pe')).filter((c) => c.tipo === 'recordatorio')).toHaveLength(0)
    expect((await bd.correos('beto@test.pe')).filter((c) => c.tipo === 'recordatorio')).toHaveLength(0)
  })
})

describe('HU-07 Registro de asistencia con QR', () => {
  async function enCurso() {
    const e = await bd.evento(org, { inicioH: 2, duracionH: 4 })
    const ana = await bd.cuenta('ana@test.pe')
    const { inscripcion } = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await bd.adelantar(2 * 60 + 5)
    return { e, ana, inscripcion }
  }

  it('CA-01 la inscripción confirmada muestra un QR único que no contiene datos personales', async () => {
    const { ana } = await enCurso()
    const { inscripciones } = await bd.rpc('mis_inscripciones', { token: ana })
    expect(inscripciones[0].codigo_qr).toMatch(/^[0-9a-f]{32}$/)
  })

  it('CA-02 un QR válido registra la asistencia con fecha, hora y nombre', async () => {
    const { e, inscripcion } = await enCurso()
    const r = await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: `CAPACITRON:${inscripcion.codigo_qr}` })
    expect(r).toMatchObject({ ok: true, tipo: 'registrado', nombre: 'ana Prueba' })
    expect(r.registrado_en).toBeTruthy()
  })

  it('CA-03 un QR ya registrado avisa y no duplica', async () => {
    const { e, inscripcion } = await enCurso()
    await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: inscripcion.codigo_qr })
    const r = await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: inscripcion.codigo_qr })
    expect(r).toMatchObject({ ok: false, tipo: 'duplicado', mensaje: expect.stringContaining('ya ingresó') })
    const [{ n }] = await bd.sql(`select count(*)::int n from capa.asistencias`)
    expect(n).toBe(1)
  })

  it('CA-04 rechaza un QR de otro evento o de una inscripción no confirmada', async () => {
    const { e } = await enCurso()
    const otro = await bd.evento(org, { inicioH: 1 })
    const { inscripcion: ajena } = await bd.rpc('inscribirse', { token: await bd.cuenta('beto@test.pe'), evento_id: otro.id })
    expect(await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: ajena.codigo_qr }))
      .toMatchObject({ ok: false, tipo: 'rechazado' })
    expect(await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: 'inventado' }))
      .toMatchObject({ ok: false, tipo: 'rechazado' })
  })

  it('CA-05 la lista muestra quién ingresó y a qué hora', async () => {
    const { e, inscripcion } = await enCurso()
    await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: inscripcion.codigo_qr })
    const r = await bd.rpc('asistencia_evento', { token: org, evento_id: e.id })
    expect(r.presentes_hoy).toBe(1)
    expect(r.registros[0]).toMatchObject({ nombre: 'ana Prueba' })
  })

  it('regla: solo los organizadores del evento registran asistencia', async () => {
    const { e, inscripcion } = await enCurso()
    const otro = (await bd.organizador('otro@test.pe')).token
    await expect(bd.rpc('registrar_asistencia', { token: otro, evento_id: e.id, codigo: inscripcion.codigo_qr }))
      .rejects.toMatchObject({ codigo: 'PROHIBIDO' })
  })
})

describe('HU-08 Certificados digitales y HU-09 verificación', () => {
  // Evento de dos jornadas: Ana asiste a ambas (100 %), Beto a una (50 %).
  async function terminado() {
    const base = await bd.ahora()
    const lima = new Date(base.getTime() - 5 * 3600_000)
    const manana9 = Date.UTC(lima.getUTCFullYear(), lima.getUTCMonth(), lima.getUTCDate() + 1, 9 + 5)
    const e = await bd.evento(org, {
      fecha_inicio: new Date(manana9).toISOString(),
      fecha_fin: new Date(manana9 + 28 * 3600_000).toISOString(),
      porcentaje_minimo: 80, nombre: 'Curso de dos días', firmante_nombre: 'Dra. Prueba',
    })
    const ana = await bd.cuenta('ana@test.pe')
    const beto = await bd.cuenta('beto@test.pe')
    const a = (await bd.rpc('inscribirse', { token: ana, evento_id: e.id })).inscripcion
    const b = (await bd.rpc('inscribirse', { token: beto, evento_id: e.id })).inscripcion
    const desde = (new Date(manana9).getTime() - base.getTime()) / 60000
    await bd.adelantar(Math.ceil(desde) + 10)
    await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: a.codigo_qr })
    await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: b.codigo_qr })
    await bd.adelantar(24 * 60)
    await bd.rpc('registrar_asistencia', { token: org, evento_id: e.id, codigo: a.codigo_qr })
    return { e, ana, beto, a, b }
  }

  it('HU-08 CA-01 a CA-04 emite el certificado al finalizar a quien cumplió el porcentaje, con sus datos y código único', async () => {
    const { ana, a } = await terminado()
    expect(await bd.rpc('mi_certificado', { token: ana, inscripcion_id: a.id }))
      .toMatchObject({ elegible: false, mensaje: expect.stringContaining('cuando el evento termine') })
    await bd.adelantar(5 * 60)
    await bd.rpc('procesar_tareas')
    const r = await bd.rpc('mi_certificado', { token: ana, inscripcion_id: a.id })
    expect(r.elegible).toBe(true)
    expect(r.certificado).toMatchObject({
      titular: 'ana Prueba', evento: 'Curso de dos días', horas_academicas: 3, firmante_nombre: 'Dra. Prueba', estado: 'valido',
    })
    expect(r.certificado.codigo).toMatch(/^CAP-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    expect((await asuntos('ana@test.pe')).some((s) => s.startsWith('Tu certificado'))).toBe(true)
  })

  it('HU-08 CA-02 quien no cumplió el porcentaje recibe el motivo', async () => {
    const { beto, b } = await terminado()
    await bd.adelantar(5 * 60)
    const r = await bd.rpc('mi_certificado', { token: beto, inscripcion_id: b.id })
    expect(r).toMatchObject({ elegible: false, porcentaje: 50 })
    expect(r.mensaje).toBe('No eres elegible: asististe a 1 de 2 jornadas (50 %) y este evento exige un mínimo de 80 %.')
  })

  it('HU-08 CA-05 y HU-09 CA-03 el organizador revoca con motivo y la verificación lo muestra inválido con fecha', async () => {
    const { e, ana, a } = await terminado()
    await bd.adelantar(5 * 60)
    const { certificado } = await bd.rpc('mi_certificado', { token: ana, inscripcion_id: a.id })
    await expect(bd.rpc('revocar_certificado', { token: org, certificado_id: certificado.id }))
      .rejects.toMatchObject({ detalle: { campos: ['motivo'] } })
    await bd.rpc('revocar_certificado', { token: org, certificado_id: certificado.id, motivo: 'Error de registro' })
    const lista = await bd.rpc('certificados_evento', { token: org, evento_id: e.id })
    expect(lista.participantes.find((x: any) => x.inscripcion_id === a.id).certificado)
      .toMatchObject({ estado: 'revocado', motivo_revocacion: 'Error de registro' })
    const v = await bd.rpc('verificar_certificado', { codigo: certificado.codigo, solicitante: 'x' })
    expect(v.estado).toBe('invalido')
    expect(v.revocado_en).toBeTruthy()
    const [h] = await bd.sql(`select accion, detalle from capa.auditoria`)
    expect(h).toMatchObject({ accion: 'Revocó certificado', detalle: expect.stringContaining('Error de registro') })
  })

  it('HU-09 CA-01 y CA-04 cualquiera, sin sesión, verifica un certificado válido y ve solo datos mínimos', async () => {
    const { ana, a } = await terminado()
    await bd.adelantar(5 * 60)
    const { certificado } = await bd.rpc('mi_certificado', { token: ana, inscripcion_id: a.id })
    const v = await bd.rpc('verificar_certificado', { codigo: `https://capacitron.pe/verificar/${certificado.codigo.toLowerCase()}` })
    expect(v).toMatchObject({ estado: 'valido', titular: 'ana Prueba', evento: 'Curso de dos días' })
    expect(v).not.toHaveProperty('correo')
    expect(v).not.toHaveProperty('porcentaje_asistencia')
    const [{ n }] = await bd.sql(`select count(*)::int n from capa.verificaciones`)
    expect(n).toBe(1)
  })

  it('HU-09 CA-02 un código inexistente devuelve «no encontrado» sin datos de otros certificados', async () => {
    const v = await bd.rpc('verificar_certificado', { codigo: 'CAP-AAAA-BBBB-CCCC', solicitante: 'nav-1' })
    expect(v).toEqual({ estado: 'no_encontrado', mensaje: expect.stringContaining('no encontrado') })
  })

  it('HU-09 CA-05 bloquea temporalmente a quien prueba códigos inventados', async () => {
    for (let i = 0; i < 5; i++) await bd.rpc('verificar_certificado', { codigo: `CAP-FAKE-${i}`, solicitante: 'bot' })
    expect(await bd.rpc('verificar_certificado', { codigo: 'CAP-FAKE-9', solicitante: 'bot' })).toMatchObject({ estado: 'bloqueado' })
    expect(await bd.rpc('verificar_certificado', { codigo: 'CAP-FAKE-9', solicitante: 'otro' })).toMatchObject({ estado: 'no_encontrado' })
    await bd.adelantar(16)
    expect(await bd.rpc('verificar_certificado', { codigo: 'CAP-FAKE-9', solicitante: 'bot' })).toMatchObject({ estado: 'no_encontrado' })
  })
})
