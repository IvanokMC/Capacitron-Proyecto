import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let org: string
beforeEach(async () => {
  bd = await nuevaBd()
  org = (await bd.organizador('org@test.pe')).token
})

describe('HU-03 Inscripción a evento', () => {
  it('CA-01 registra la inscripción si hay cupos', async () => {
    const e = await bd.evento(org)
    const ana = await bd.cuenta('ana@test.pe')
    const r = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    expect(r.ok).toBe(true)
    expect(r.inscripcion.estado).toBe('confirmada')
  })

  it('CA-02 si ya está inscrito lo impide y devuelve la inscripción existente', async () => {
    const e = await bd.evento(org)
    const ana = await bd.cuenta('ana@test.pe')
    const primera = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    const r = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    expect(r).toMatchObject({ ok: false, motivo: 'ya_inscrito', inscripcion: { id: primera.inscripcion.id } })
  })

  it('CA-03 envía un correo con los datos del evento', async () => {
    const e = await bd.evento(org, { nombre: 'Taller QA', lugar: 'Aula 5' })
    const ana = await bd.cuenta('ana@test.pe')
    await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    const c = (await bd.correos('ana@test.pe')).at(-1)!
    expect(c.asunto).toBe('Inscripción confirmada: Taller QA')
    expect(c.cuerpo).toContain('Lugar: Aula 5')
    expect(c.cuerpo).toMatch(/Inicio: \S+ \d+ de \S+ de \d{4}, \d\d:\d\d h/)
  })

  it('CA-04 los cupos disponibles disminuyen en uno', async () => {
    const e = await bd.evento(org, { cupo_maximo: 10 })
    await bd.rpc('inscribirse', { token: await bd.cuenta('ana@test.pe'), evento_id: e.id })
    expect((await bd.rpc('detalle_evento', { id: e.id })).cupos_disponibles).toBe(9)
  })

  it('CA-05 en un evento con costo queda «pendiente de pago»', async () => {
    const e = await bd.evento(org, { costo: 50 })
    const r = await bd.rpc('inscribirse', { token: await bd.cuenta('ana@test.pe'), evento_id: e.id })
    expect(r.inscripcion).toMatchObject({ estado: 'pendiente_pago', monto: 50, codigo_qr: null })
  })

  it('regla: se puede cancelar hasta 24 horas antes y el cupo se libera', async () => {
    const e = await bd.evento(org, { inicioH: 30 })
    const ana = await bd.cuenta('ana@test.pe')
    const { inscripcion } = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await bd.adelantar(7 * 60) // faltan 23 h
    await expect(bd.rpc('cancelar_inscripcion', { token: ana, id: inscripcion.id })).rejects.toMatchObject({ codigo: 'FUERA_DE_PLAZO' })
    await bd.adelantar(-2 * 60) // faltan 25 h
    await bd.rpc('cancelar_inscripcion', { token: ana, id: inscripcion.id })
    expect((await bd.rpc('detalle_evento', { id: e.id })).cupos_disponibles).toBe(10)
  })
})

describe('HU-04 Pago en línea', () => {
  async function pendiente(costo = 40) {
    const e = await bd.evento(org, { costo })
    const ana = await bd.cuenta('ana@test.pe')
    const { inscripcion } = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    return { e, ana, inscripcion }
  }

  it('CA-01 y CA-02 un pago aprobado confirma la inscripción y genera un comprobante enviado por correo', async () => {
    const { ana, inscripcion } = await pendiente()
    const { pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: inscripcion.id, metodo: 'yape' })
    const r = await bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'aprobado' })
    expect(r.ok).toBe(true)
    expect(r.pago.numero_comprobante).toMatch(/^CP-\d{4}-\d{6}$/)
    const [ins] = await bd.sql(`select estado from capa.inscripciones where id = $1`, [inscripcion.id])
    expect(ins.estado).toBe('confirmada')
    const comp = await bd.rpc('comprobante_pago', { token: ana, pago_id: pago.id })
    expect(comp).toMatchObject({ monto: 40, metodo: 'yape', estado: 'confirmado' })
    expect((await bd.correos('ana@test.pe')).at(-1)!.asunto).toContain(r.pago.numero_comprobante)
  })

  it('CA-03 si la plataforma rechaza o no responde, la inscripción sigue pendiente y se puede reintentar', async () => {
    const { ana, inscripcion } = await pendiente()
    let { pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: inscripcion.id, metodo: 'plin' })
    const rech = await bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'rechazado' })
    expect(rech).toMatchObject({ ok: false, motivo: 'rechazado', mensaje: expect.stringContaining('reintentar') })
    ;({ pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: inscripcion.id, metodo: 'paypal' }))
    const sin = await bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'sin_respuesta' })
    expect(sin).toMatchObject({ ok: false, motivo: 'sin_respuesta' })
    const [ins] = await bd.sql(`select estado from capa.inscripciones where id = $1`, [inscripcion.id])
    expect(ins.estado).toBe('pendiente_pago')
    // Los intentos fallidos quedan registrados para conciliación.
    const pagos = await bd.sql(`select estado from capa.pagos order by creado_en, id`)
    expect(pagos.map((p) => p.estado).sort()).toEqual(['rechazado', 'sin_respuesta'])
    ;({ pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: inscripcion.id, metodo: 'yape' }))
    expect((await bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'aprobado' })).ok).toBe(true)
  })

  it('CA-04 sin pago confirmado en 30 minutos se libera el cupo reservado', async () => {
    const { e, inscripcion } = await pendiente()
    expect((await bd.rpc('detalle_evento', { id: e.id })).cupos_disponibles).toBe(9)
    await bd.adelantar(29)
    await bd.rpc('procesar_tareas')
    expect((await bd.rpc('detalle_evento', { id: e.id })).cupos_disponibles).toBe(9)
    await bd.adelantar(2)
    await bd.rpc('procesar_tareas')
    const [ins] = await bd.sql(`select estado from capa.inscripciones where id = $1`, [inscripcion.id])
    expect(ins.estado).toBe('expirada')
    expect((await bd.rpc('detalle_evento', { id: e.id })).cupos_disponibles).toBe(10)
  })

  it('CA-05 el monto aparece en los reportes del organizador asociado al evento', async () => {
    const { e, ana, inscripcion } = await pendiente(35)
    const { pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: inscripcion.id, metodo: 'yape' })
    await bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'aprobado' })
    const rep = await bd.rpc('reporte_participacion', { token: org })
    expect(rep.eventos.find((x: any) => x.id === e.id).ingresos).toBe(35)
    expect(rep.por_metodo).toEqual([{ metodo: 'yape', monto: 35, operaciones: 1 }])
  })

  it('regla: no se guardan datos de tarjeta, solo una referencia de la plataforma', async () => {
    const cols = await bd.sql(`select column_name from information_schema.columns where table_schema = 'capa' and table_name = 'pagos'`)
    expect(cols.map((c) => c.column_name)).not.toEqual(expect.arrayContaining(['tarjeta', 'numero_tarjeta', 'cvv']))
  })
})

describe('HU-05 Control de cupos', () => {
  async function lleno(cupo = 1) {
    const e = await bd.evento(org, { cupo_maximo: cupo })
    const primero = await bd.cuenta('primero@test.pe')
    const ins = await bd.rpc('inscribirse', { token: primero, evento_id: e.id })
    return { e, primero, ins: ins.inscripcion }
  }

  it('CA-01 con los cupos agotados bloquea la inscripción y ofrece la lista de espera', async () => {
    const { e } = await lleno()
    const ana = await bd.cuenta('ana@test.pe')
    const r = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    expect(r).toMatchObject({ ok: false, motivo: 'sin_cupos', en_lista_espera: false })
    expect((await bd.rpc('unirse_lista_espera', { token: ana, evento_id: e.id })).posicion).toBe(1)
  })

  it('CA-02 al liberarse un cupo se notifica por correo al primero de la lista', async () => {
    const { e, primero, ins } = await lleno()
    const ana = await bd.cuenta('ana@test.pe')
    const beto = await bd.cuenta('beto@test.pe')
    await bd.rpc('unirse_lista_espera', { token: ana, evento_id: e.id })
    await bd.rpc('unirse_lista_espera', { token: beto, evento_id: e.id })
    await bd.rpc('cancelar_inscripcion', { token: primero, id: ins.id })
    expect((await bd.correos('ana@test.pe')).at(-1)!.asunto).toMatch(/Se liberó un cupo/)
    expect((await bd.correos('beto@test.pe')).at(-1)!.asunto).not.toMatch(/Se liberó un cupo/)
    const mis = await bd.rpc('mis_inscripciones', { token: ana })
    const r = await bd.rpc('aceptar_oferta_espera', { token: ana, id: mis.lista_espera[0].id })
    expect(r.inscripcion.estado).toBe('confirmada')
  })

  it('CA-03 si no confirma en 24 horas el cupo pasa al siguiente de la lista', async () => {
    const { e, primero, ins } = await lleno()
    const ana = await bd.cuenta('ana@test.pe')
    const beto = await bd.cuenta('beto@test.pe')
    await bd.rpc('unirse_lista_espera', { token: ana, evento_id: e.id })
    await bd.rpc('unirse_lista_espera', { token: beto, evento_id: e.id })
    await bd.rpc('cancelar_inscripcion', { token: primero, id: ins.id })
    await bd.adelantar(24 * 60 + 1)
    await bd.rpc('procesar_tareas')
    expect((await bd.correos('ana@test.pe')).at(-1)!.asunto).toMatch(/Venció tu cupo/)
    expect((await bd.correos('beto@test.pe')).at(-1)!.asunto).toMatch(/Se liberó un cupo/)
  })

  it('CA-04 si dos personas piden el último cupo, solo una lo obtiene y la otra pasa a la lista de espera', async () => {
    const e = await bd.evento(org, { cupo_maximo: 1 })
    const ana = await bd.cuenta('ana@test.pe')
    const beto = await bd.cuenta('beto@test.pe')
    // Ambas pantallas mostraban «1 cupo disponible» y enviaron la inscripción.
    const [a, b] = await Promise.all([
      bd.rpc('inscribirse', { token: ana, evento_id: e.id, lista_espera_automatica: true }),
      bd.rpc('inscribirse', { token: beto, evento_id: e.id, lista_espera_automatica: true }),
    ])
    const ganadores = [a, b].filter((r) => r.ok)
    const perdedores = [a, b].filter((r) => !r.ok)
    expect(ganadores).toHaveLength(1)
    expect(perdedores[0]).toMatchObject({ motivo: 'sin_cupos', en_lista_espera: true, posicion: 1 })
    const [{ n }] = await bd.sql(`select count(*)::int n from capa.inscripciones where estado = 'confirmada'`)
    expect(n).toBe(1)
  })

  it('CA-05 el organizador ve cupos totales, ocupados, disponibles y personas en espera', async () => {
    const { e } = await lleno(2)
    await bd.rpc('inscribirse', { token: await bd.cuenta('dos@test.pe'), evento_id: e.id })
    await bd.rpc('unirse_lista_espera', { token: await bd.cuenta('ana@test.pe'), evento_id: e.id })
    const g = await bd.rpc('evento_gestion', { token: org, id: e.id })
    expect(g.cupos).toMatchObject({ total: 2, ocupados: 2, disponibles: 0, en_espera: 1 })
  })

  it('regla: si el organizador amplía el cupo se notifica a quienes esperan', async () => {
    const { e } = await lleno(1)
    await bd.rpc('unirse_lista_espera', { token: await bd.cuenta('ana@test.pe'), evento_id: e.id })
    await bd.rpc('guardar_evento', { ...e, token: org, id: e.id, cupo_maximo: 2 })
    expect((await bd.correos('ana@test.pe')).at(-1)!.asunto).toMatch(/Se liberó un cupo/)
  })
})
