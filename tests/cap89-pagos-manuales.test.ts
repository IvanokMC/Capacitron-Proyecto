// CAP-89 · Pagos manuales con verificación de la administración (HU-16, CA-02 a CA-06). Rol: Backend (Carlos).
// Teoría: refactorizar con pruebas (diap. 140); encapsulación (diap. 20–24): el pago solo cambia por funciones que
// validan rol y estado; OCP (diap. 50–63): los medios disponibles salen de un solo lugar.
// Los datos de pago de estas pruebas son de ejemplo (cuentas con ceros, números de operación inventados).
import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let admin: string
let ana: string
let org: string

const CONFIG = {
  yape_qr: 'config/yape-qr-ejemplo.png', yape_titular: 'Organización de prueba', banco: 'Banco de ejemplo',
  cuenta: '000-0000000-0-00', cci: '000 000 000000000000 00', titular: 'Organización de prueba', whatsapp: '+51 900 000 000',
}

async function evento(costo = 80) {
  return bd.evento(org, { costo, nombre: 'Curso de prueba' })
}
async function reservar(e?: any) {
  e ??= await evento()
  const r = await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
  return { e, ins: r.inscripcion }
}
const registrar = (ins: any, extra: Record<string, unknown> = {}) => bd.rpc('registrar_pago_manual', {
  token: ana, inscripcion_id: ins.id, metodo: 'yape', numero_operacion: '12345678', comprobante: `${ins.id}/captura.webp`, ...extra,
})

beforeEach(async () => {
  bd = await nuevaBd()
  await bd.cuenta('admin@test.pe')
  await bd.sql(`update capa.usuarios set rol = 'admin' where correo = 'admin@test.pe'`)
  admin = (await bd.rpc('iniciar_sesion', { correo: 'admin@test.pe', password: 'Clave2026x' })).token
  org = (await bd.organizador('org@test.pe')).token
  ana = await bd.cuenta('ana@test.pe')
  await bd.rpc('guardar_config_pagos', { token: admin, ...CONFIG })
})

describe('CAP-89 configuración y medios de pago (CA-01 y CA-06)', () => {
  it('CA-06: la administración guarda la configuración; cuenta, CCI y WhatsApp quedan normalizados', async () => {
    const r = await bd.rpc('medios_pago')
    expect(r.config).toMatchObject({ cuenta: '0000000000000', cci: '00000000000000000000', whatsapp: '900000000' })
    expect(r.disponibles).toEqual(['yape', 'transferencia', 'whatsapp'])
  })

  it('CA-06: nadie más puede configurar los pagos', async () => {
    await expect(bd.rpc('guardar_config_pagos', { token: org, whatsapp: '911111111' })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    await expect(bd.rpc('guardar_config_pagos', { token: ana, whatsapp: '911111111' })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
  })

  it('rechaza un CCI, una cuenta o un WhatsApp con otra forma, diciendo cuál', async () => {
    await expect(bd.rpc('guardar_config_pagos', { token: admin, cci: '123' }))
      .rejects.toMatchObject({ message: 'El CCI debe tener 20 dígitos.', detalle: { campos: ['cci'] } })
    await expect(bd.rpc('guardar_config_pagos', { token: admin, cuenta: '12' }))
      .rejects.toMatchObject({ message: 'El número de cuenta debe tener de 8 a 20 dígitos.' })
    await expect(bd.rpc('guardar_config_pagos', { token: admin, whatsapp: '812345678' }))
      .rejects.toMatchObject({ message: 'El WhatsApp debe tener 9 dígitos y empezar con 9.' })
  })

  it('OCP: un medio sin sus datos no se ofrece; una clave ausente no se toca y una vacía se borra', async () => {
    await bd.rpc('guardar_config_pagos', { token: admin, whatsapp: '' })
    const r = await bd.rpc('medios_pago')
    expect(r.disponibles).toEqual(['yape', 'transferencia'])
    expect(r.config.banco).toBe('Banco de ejemplo')
  })

  it('los medios de pago se pueden ver sin sesión (los necesita quien va a pagar)', async () => {
    expect((await bd.rpc('medios_pago', {})).disponibles).toContain('yape')
  })
})

describe('CAP-89 registrar el pago (CA-02)', () => {
  it('CA-02: con número de operación y captura queda «por verificar» y el cupo sigue reservado', async () => {
    const { e, ins } = await reservar()
    const r = await registrar(ins)
    expect(r.pago).toMatchObject({ estado: 'por_verificar', metodo: 'yape', numero_operacion: '12345678', monto: 80 })
    expect(r.pago).not.toHaveProperty('comprobante_ruta')
    const [i] = await bd.sql(`select estado, reserva_expira_en from capa.inscripciones where id = $1`, [ins.id])
    expect(i).toMatchObject({ estado: 'pendiente_pago', reserva_expira_en: null })
    expect((await bd.rpc('detalle_evento', { id: e.id })).cupos_disponibles).toBe(9)
  })

  it('CA-02 y CA-05: mientras se verifica, el vencimiento automático no libera el cupo', async () => {
    const { e, ins } = await reservar()
    await registrar(ins)
    await bd.adelantar(120)
    await bd.rpc('procesar_tareas')
    const [i] = await bd.sql(`select estado from capa.inscripciones where id = $1`, [ins.id])
    expect(i.estado).toBe('pendiente_pago')
    expect((await bd.rpc('detalle_evento', { id: e.id })).cupos_disponibles).toBe(9)
  })

  it('pide los tres datos y dice cuáles faltan', async () => {
    const { ins } = await reservar()
    await expect(registrar(ins, { numero_operacion: '', comprobante: null }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['numero_operacion', 'comprobante'] } })
    await expect(registrar(ins, { metodo: 'plin' }))
      .rejects.toMatchObject({ message: 'Elige un medio de pago disponible: Yape, transferencia o WhatsApp.' })
  })

  it('la captura debe estar en la carpeta de ESA inscripción', async () => {
    const { ins } = await reservar()
    const otra = (await reservar()).ins
    await expect(registrar(ins, { comprobante: `${otra.id}/captura.webp` }))
      .rejects.toMatchObject({ detalle: { campos: ['comprobante'] } })
  })

  it('no se puede enviar otro comprobante mientras uno espera, ni repetir un número de operación', async () => {
    const { ins } = await reservar()
    await registrar(ins)
    await expect(registrar(ins, { numero_operacion: '99999999' })).rejects.toMatchObject({ codigo: 'POR_VERIFICAR' })
    const otra = (await reservar()).ins
    await expect(registrar(otra, { comprobante: `${otra.id}/c.png` }))
      .rejects.toMatchObject({ message: 'Ese número de operación ya se registró en otro pago. Revisa tu constancia.' })
  })

  it('no sirve para la inscripción de otra persona ni para una reserva vencida', async () => {
    const { ins } = await reservar()
    const luis = await bd.cuenta('luis@test.pe')
    await expect(bd.rpc('registrar_pago_manual', { token: luis, inscripcion_id: ins.id, metodo: 'yape', numero_operacion: '1234', comprobante: `${ins.id}/a.png` }))
      .rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' })
    await bd.adelantar(31)
    await expect(registrar(ins)).rejects.toMatchObject({ codigo: 'VENCIDA' })
  })
})

describe('CAP-89 verificar el pago (CA-03, CA-04 y CA-06)', () => {
  it('CA-06: la bandeja muestra los pagos por verificar solo a la administración, con la captura', async () => {
    const { ins } = await reservar()
    await registrar(ins)
    const bandeja = await bd.rpc<any[]>('pagos_por_verificar', { token: admin })
    expect(bandeja).toHaveLength(1)
    expect(bandeja[0]).toMatchObject({ persona: 'ana Prueba', correo: 'ana@test.pe', evento: 'Curso de prueba', monto: 80,
      medio: 'yape', operacion: '12345678', comprobante: `${ins.id}/captura.webp` })
    await expect(bd.rpc('pagos_por_verificar', { token: org })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    await expect(bd.rpc('aprobar_pago', { token: ana, pago_id: bandeja[0].id })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
  })

  it('CA-03: aprobar confirma la inscripción, genera el comprobante y envía el correo', async () => {
    const { ins } = await reservar()
    const { pago } = await registrar(ins)
    const r = await bd.rpc('aprobar_pago', { token: admin, pago_id: pago.id })
    expect(r.pago).toMatchObject({ estado: 'confirmado', numero_comprobante: expect.stringMatching(/^CP-\d{4}-\d{6}$/), referencia_externa: '12345678' })
    const [i] = await bd.sql(`select estado from capa.inscripciones where id = $1`, [ins.id])
    expect(i.estado).toBe('confirmada')
    const correo = (await bd.correos('ana@test.pe')).find((c) => c.asunto.startsWith('Pago confirmado'))
    expect(correo?.cuerpo).toContain('Número de operación: 12345678')
    expect(correo?.accion_url).toBe(`/mis-inscripciones?comprobante=${pago.id}`)
    expect((await bd.rpc('comprobante_pago', { token: ana, pago_id: pago.id })).numero_comprobante).toBe(r.pago.numero_comprobante)
    expect(await bd.rpc('pagos_por_verificar', { token: admin })).toEqual([])
  })

  it('CA-04: rechazar guarda el motivo, envía el correo y da 30 minutos para volver a enviar', async () => {
    const { ins } = await reservar()
    const { pago } = await registrar(ins)
    await bd.adelantar(60)
    const r = await bd.rpc('rechazar_pago', { token: admin, pago_id: pago.id, motivo: 'El monto no coincide con el costo del evento.' })
    expect(r.pago).toMatchObject({ estado: 'rechazado', motivo_rechazo: 'El monto no coincide con el costo del evento.' })
    const mias = await bd.rpc<any[]>('mis_inscripciones', { token: ana })
    const mia = (Array.isArray(mias) ? mias : (mias as any).inscripciones).find((x: any) => x.id === ins.id)
    expect(mia.pagos[0]).toMatchObject({ estado: 'rechazado', motivo_rechazo: 'El monto no coincide con el costo del evento.' })
    const correo = (await bd.correos('ana@test.pe')).find((c) => c.asunto.startsWith('Revisa tu pago'))
    expect(correo?.cuerpo).toContain('Motivo: El monto no coincide con el costo del evento.')
    expect(correo?.accion_url).toBe(`/mis-inscripciones?pagar=${ins.id}`)
    // Puede volver a enviar el comprobante, ahora con otro número.
    expect((await registrar(ins, { numero_operacion: '87654321' })).pago.estado).toBe('por_verificar')
  })

  it('CA-04 y CA-05: si después del rechazo no reenvía en 30 minutos, el cupo se libera', async () => {
    const { e, ins } = await reservar()
    const { pago } = await registrar(ins)
    await bd.rpc('rechazar_pago', { token: admin, pago_id: pago.id, motivo: 'La captura no se lee bien.' })
    await bd.adelantar(31)
    await bd.rpc('procesar_tareas')
    const [i] = await bd.sql(`select estado from capa.inscripciones where id = $1`, [ins.id])
    expect(i.estado).toBe('expirada')
    expect((await bd.rpc('detalle_evento', { id: e.id })).cupos_disponibles).toBe(10)
  })

  it('rechazar exige un motivo; un pago ya revisado no se vuelve a revisar', async () => {
    const { ins } = await reservar()
    const { pago } = await registrar(ins)
    await expect(bd.rpc('rechazar_pago', { token: admin, pago_id: pago.id, motivo: ' ' })).rejects.toMatchObject({ detalle: { campos: ['motivo'] } })
    await bd.rpc('aprobar_pago', { token: admin, pago_id: pago.id })
    await expect(bd.rpc('rechazar_pago', { token: admin, pago_id: pago.id, motivo: 'Tarde' })).rejects.toMatchObject({ message: 'Este pago ya fue revisado.' })
  })

  it('D-02: si el asistente canceló, el pago sigue en la bandeja marcado; no se aprueba y al revisarlo sale', async () => {
    const e = await bd.evento(org, { costo: 80, inicioH: 72 })
    const { ins } = await reservar(e)
    const { pago } = await registrar(ins)
    await bd.rpc('cancelar_inscripcion', { token: ana, id: ins.id })
    expect(await bd.rpc('pagos_por_verificar', { token: admin })).toMatchObject([{ id: pago.id, inscripcion_vigente: false }])
    const r = await bd.rpc('aprobar_pago', { token: admin, pago_id: pago.id })
    expect(r).toMatchObject({ ok: false, motivo: 'no_vigente', pago: { estado: 'rechazado' } })
    expect(await bd.rpc('pagos_por_verificar', { token: admin })).toEqual([])
  })

  it('D-02: si el organizador cancela el evento, el pago por verificar también aparece para coordinar la devolución', async () => {
    const e = await bd.evento(org, { costo: 80, inicioH: 72 })
    const { ins } = await reservar(e)
    await registrar(ins)
    await bd.rpc('cancelar_evento', { token: org, id: e.id, motivo: 'Prueba de cancelación del evento' })
    expect(await bd.rpc('pagos_por_verificar', { token: admin })).toMatchObject([{ inscripcion_id: ins.id, inscripcion_vigente: false }])
  })

  it('D-02: si cancela y se vuelve a inscribir, puede reenviar el mismo pago; el anterior queda rechazado', async () => {
    const e = await bd.evento(org, { costo: 80, inicioH: 72 })
    const primera = (await reservar(e)).ins
    const { pago: viejo } = await registrar(primera)
    await bd.rpc('cancelar_inscripcion', { token: ana, id: primera.id })
    const segunda = (await reservar(e)).ins
    expect((await registrar(segunda, { comprobante: `${segunda.id}/c.png` })).pago.estado).toBe('por_verificar')
    const [v] = await bd.sql(`select estado, motivo_rechazo from capa.pagos where id = $1`, [viejo.id])
    expect(v).toMatchObject({ estado: 'rechazado', motivo_rechazo: 'Se reenvió en una nueva inscripción.' })
  })
})

describe('CAP-89 la captura es privada y la pasarela simulada solo existe en la demostración', () => {
  it('Ley N.° 29733: el organizador no recibe la ruta de la captura en el comprobante', async () => {
    const { ins } = await reservar()
    const { pago } = await registrar(ins)
    await bd.rpc('aprobar_pago', { token: admin, pago_id: pago.id })
    const c = await bd.rpc('comprobante_pago', { token: org, pago_id: pago.id })
    expect(JSON.stringify(c)).not.toContain('captura.webp')
  })

  it('con el modo demostración apagado, respuesta_pasarela no confirma pagos', async () => {
    const { ins } = await reservar()
    const { pago } = await bd.rpc('iniciar_pago', { token: ana, inscripcion_id: ins.id, metodo: 'yape' })
    await bd.rpc('admin_modo_demo', { token: admin, activo: false })
    await expect(bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'aprobado' }))
      .rejects.toMatchObject({ codigo: 'PASARELA_DESACTIVADA' })
  })
})
