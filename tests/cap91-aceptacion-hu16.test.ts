// CAP-91 · Pruebas de aceptación de la HU-16 «Pago real con verificación manual» (CA-01 a CA-06).
// Rol: QA (Andree). Plan, matriz y hallazgos en docs/pruebas/HU-16/PLAN_DE_PRUEBAS.md.
//
// Recorren la historia con las piezas reales:
// 1. la administración configura los medios (CAP-89);
// 2. la asistente reserva su cupo y abre la pantalla de pago (CAP-90 con el diseño de CAP-88);
// 3. registra el número de operación y la captura (almacenamiento local, la misma interfaz que Supabase);
// 4. la administración aprueba o rechaza desde su bandeja, y el vencimiento automático libera los cupos sin pago.
//
// No se usan servicios externos: la base es PGlite y el almacenamiento el local. El bucket privado en Supabase
// (CAP-92) y WhatsApp en un celular real se prueban a mano.
// Teoría: refactorizar con pruebas (diap. 140): fijan el comportamiento antes de retirar la pasarela simulada;
// mantenibilidad (diap. 137): se prueba sin servicios externos.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import { configParaPantalla, enlacePago, mensajePago, registrarPagoManual } from '../src/lib/pagoManual'
import { nuevaBd, type Bd } from './bd'
// Pantallas importadas al inicio (con la suite en paralelo, un import dinámico puede pasar el tiempo límite).
import PagarInscripcion, { PANELES } from '../src/pages/PagarInscripcion'
import { PagosAdmin } from '../src/pages/admin/Pagos'

const pantalla = vi.hoisted(() => ({ usuario: null as any, modoDemo: false, cargas: {} as Record<string, unknown> }))
vi.mock('../src/lib/app', () => ({
  useApp: () => ({ usuario: pantalla.usuario, api: async () => ({}), ahora: () => new Date(), latir: () => {}, listo: true,
    sistema: { modo_demo: pantalla.modoDemo, ahora: new Date().toISOString(), reloj_desfase_min: 0 } }),
  useCarga: (fn: string) => ({ datos: pantalla.cargas[fn] ?? null, cargando: false, error: null, recargar: () => {}, setDatos: () => {} }),
}))
vi.mock('../src/components/notificaciones', () => ({ useNotas: () => ({ exito: () => {}, error: () => {} }) }))
vi.mock('../src/lib/almacenamiento', async (original) => ({
  ...(await original<typeof import('../src/lib/almacenamiento')>()),
  useUrlArchivo: (bucket: string, ruta: string | null | undefined) => (ruta ? `https://x.supabase.co/storage/v1/object/public/${bucket}/${ruta}` : null),
}))

// Datos de pago de ejemplo: cuentas con ceros y números de operación inventados.
const CONFIG = { yape_qr: 'admin/qr-ejemplo.png', yape_titular: 'Organización de prueba', banco: 'Banco de ejemplo',
  cuenta: '0000000000000', cci: '00000000000000000000', titular: 'Organización de prueba', whatsapp: '900000000' }
const captura = () => ({ archivo: new Blob([new Uint8Array(2000)], { type: 'image/png' }), previa: 'blob:x', quitar: false, error: null })
const sinComprimir = async (a: Blob) => a // la compresión (canvas) necesita un navegador; se mide en CAP-112

let bd: Bd
let admin: string
let carmen: string
let ana: string
let ev: any
let ins: any
beforeEach(async () => {
  bd = await nuevaBd()
  await bd.cuenta('lucia@unsaac.test')
  await bd.sql(`update capa.usuarios set rol = 'admin' where correo = 'lucia@unsaac.test'`)
  admin = (await bd.rpc('iniciar_sesion', { correo: 'lucia@unsaac.test', password: 'Clave2026x' })).token
  carmen = (await bd.organizador('carmen@unsaac.test')).token
  ana = await bd.cuenta('ana@unsaac.test')
  await bd.rpc('guardar_config_pagos', { token: admin, ...CONFIG })
  ev = await bd.evento(carmen, { costo: 80, nombre: 'Curso de React', inicioH: 72 })
  ins = (await bd.rpc('inscribirse', { token: ana, evento_id: ev.id })).inscripcion
})

const apiDe = (token: string) => ((fn: string, p: Record<string, unknown> = {}) => bd.rpc(fn, { token, ...p })) as any
/** Lo que hace la pantalla al pulsar «Enviar para verificar» (CAP-90). */
const enviarComprobante = (operacion = '12345678', medio: 'yape' | 'transferencia' | 'whatsapp' = 'yape') =>
  registrarPagoManual(apiDe(ana), almacenamientoLocal({ persistir: false }), ins.id, medio, operacion, captura(), sinComprimir) as Promise<any>
const libres = async () => (await bd.rpc<any>('detalle_evento', { id: ev.id })).cupos_disponibles
const estadoInscripcion = async () => (await bd.sql(`select estado from capa.inscripciones where id = $1`, [ins.id]))[0].estado
async function paginaDePago() {
  pantalla.usuario = { id: 'ana', nombre_completo: 'ana Prueba', rol: 'asistente' }
  pantalla.cargas = { mis_inscripciones: await bd.rpc('mis_inscripciones', { token: ana }), medios_pago: await bd.rpc('medios_pago') }
  return renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/mis-inscripciones/${ins.id}/pagar`] },
    h(Routes, null, h(Route, { path: '/mis-inscripciones/:id/pagar', element: h(PagarInscripcion) }))))
}

describe('HU-16 CA-01: al reservar veo el QR de Yape, los datos de la cuenta y el botón de WhatsApp', () => {
  beforeEach(() => { pantalla.modoDemo = false })

  it('dado un evento con costo, cuando abro la pantalla de pago, entonces veo las tres opciones y el QR de Yape', async () => {
    const html = await paginaDePago()
    for (const medio of ['Yape', 'Transferencia', 'WhatsApp']) expect(html).toContain(`>${medio}<`)
    expect(html).toContain('alt="Código QR de Yape de Organización de prueba"')
    expect(html).toContain('S/ 80.00')
  })

  it('dado que elijo transferencia, entonces veo el banco, la cuenta, el CCI y el titular', async () => {
    const config = configParaPantalla(await bd.rpc('medios_pago'), null)
    const html = renderToStaticMarkup(h(MemoryRouter, null, PANELES.transferencia({ config, monto: 80, mensaje: '', enlace: null, copiar: () => {} })))
    for (const dato of ['Banco de ejemplo', '0000000000000', '00000000000000000000', 'Organización de prueba']) expect(html).toContain(dato)
  })

  it('dado que elijo WhatsApp, entonces el botón abre wa.me con el evento, mi nombre y el monto', async () => {
    const m = await bd.rpc<any>('medios_pago')
    const enlace = enlacePago(m.config.whatsapp, mensajePago('ana Prueba', ev.nombre, 80))!
    const html = renderToStaticMarkup(h(MemoryRouter, null, PANELES.whatsapp({ config: configParaPantalla(m, null), monto: 80, mensaje: '', enlace, copiar: () => {} })))
    expect(html).toContain('href="https://wa.me/51900000000?text=')
    const texto = decodeURIComponent(enlace.split('text=')[1])
    for (const parte of ['ana Prueba', '«Curso de React»', 'S/ 80.00']) expect(texto).toContain(parte)
  })

  it('dado un medio sin configurar, entonces no se ofrece como disponible', async () => {
    await bd.rpc('guardar_config_pagos', { token: admin, whatsapp: '' })
    expect((await bd.rpc<any>('medios_pago')).disponibles).toEqual(['yape', 'transferencia'])
  })
})

describe('HU-16 CA-02: con número de operación y captura, el pago queda «Por verificar» y el cupo sigue reservado', () => {
  it('dado que ya pagué, cuando envío el comprobante, entonces queda por verificar y mi cupo no se libera aunque pasen horas', async () => {
    expect(await libres()).toBe(9)
    expect((await enviarComprobante()).pago.estado).toBe('por_verificar')
    await bd.adelantar(180)
    await bd.rpc('procesar_tareas')
    expect(await estadoInscripcion()).toBe('pendiente_pago')
    expect(await libres()).toBe(9)
  })

  it('dado un pago por verificar, cuando vuelvo a la pantalla, entonces veo el estado y no el formulario', async () => {
    await enviarComprobante()
    const html = await paginaDePago()
    expect(html).toContain('Pago por verificar')
    expect(html).not.toContain('Enviar para verificar')
  })
})

describe('HU-16 CA-03: al aprobar, la inscripción se confirma, se genera el comprobante y recibo un correo', () => {
  it('dado un pago por verificar, cuando la administración lo aprueba desde la bandeja, entonces todo eso ocurre', async () => {
    await enviarComprobante('00012345')
    const [fila] = await bd.rpc<any[]>('pagos_por_verificar', { token: admin })
    expect(fila).toMatchObject({ persona: 'ana Prueba', evento: 'Curso de React', monto: 80, operacion: '00012345', inscripcion_vigente: true })
    const r = await bd.rpc<any>('aprobar_pago', { token: admin, pago_id: fila.id })
    expect(await estadoInscripcion()).toBe('confirmada')
    expect(r.pago.numero_comprobante).toMatch(/^CP-\d{4}-\d{6}$/)
    expect((await bd.rpc<any>('comprobante_pago', { token: ana, pago_id: fila.id })).numero_comprobante).toBe(r.pago.numero_comprobante)
    const correo = (await bd.correos('ana@unsaac.test')).find((c) => c.asunto === `Pago confirmado · comprobante ${r.pago.numero_comprobante}`)
    expect(correo?.accion_url).toBe(`/mis-inscripciones?comprobante=${fila.id}`)
    const html = await paginaDePago()
    expect(html).toContain('Pago aprobado')
    expect(html).toContain('Descargar comprobante')
  })
})

describe('HU-16 CA-04: al rechazar con un motivo, lo veo, recibo un correo y puedo volver a enviar', () => {
  it('dado un pago por verificar, cuando se rechaza, entonces veo el motivo en la pantalla y en el correo, y puedo reenviar', async () => {
    const { pago } = await enviarComprobante()
    await bd.rpc('rechazar_pago', { token: admin, pago_id: pago.id, motivo: 'No encontramos la operación en nuestra cuenta.' })
    const html = await paginaDePago()
    expect(html).toContain('No encontramos la operación en nuestra cuenta.')
    expect(html).toContain('Volver a enviar')
    const correo = (await bd.correos('ana@unsaac.test')).find((c) => c.asunto === 'Revisa tu pago en Curso de React')
    expect(correo?.cuerpo).toContain('Motivo: No encontramos la operación en nuestra cuenta.')
    expect((await enviarComprobante('87654321')).pago.estado).toBe('por_verificar')
  })

  it('dado un rechazo, la administración debe escribir un motivo', async () => {
    const { pago } = await enviarComprobante()
    await expect(bd.rpc('rechazar_pago', { token: admin, pago_id: pago.id, motivo: '' })).rejects.toMatchObject({ detalle: { campos: ['motivo'] } })
  })
})

describe('HU-16 CA-05: si vence la reserva sin un pago aprobado, el cupo se libera', () => {
  it('dado que no envío el comprobante, cuando pasan 30 minutos, entonces el cupo se libera', async () => {
    await bd.adelantar(31)
    await bd.rpc('procesar_tareas')
    expect(await estadoInscripcion()).toBe('expirada')
    expect(await libres()).toBe(10)
  })

  it('dado un rechazo, cuando no vuelvo a enviar en 30 minutos, entonces el cupo se libera', async () => {
    const { pago } = await enviarComprobante()
    await bd.rpc('rechazar_pago', { token: admin, pago_id: pago.id, motivo: 'La captura no se lee bien.' })
    await bd.adelantar(31)
    await bd.rpc('procesar_tareas')
    expect(await estadoInscripcion()).toBe('expirada')
    expect(await libres()).toBe(10)
  })
})

describe('HU-16 CA-06: solo la administración aprueba, rechaza y configura', () => {
  it('dado el organizador del evento o la asistente, cuando intentan aprobar, rechazar o configurar, entonces se rechaza', async () => {
    const { pago } = await enviarComprobante()
    for (const token of [carmen, ana]) {
      await expect(bd.rpc('pagos_por_verificar', { token })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
      await expect(bd.rpc('aprobar_pago', { token, pago_id: pago.id })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
      await expect(bd.rpc('rechazar_pago', { token, pago_id: pago.id, motivo: 'Intento indebido' })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
      await expect(bd.rpc('guardar_config_pagos', { token, whatsapp: '911111111' })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    }
    await expect(bd.rpc('aprobar_pago', { pago_id: pago.id })).rejects.toThrow()
    expect(await estadoInscripcion()).toBe('pendiente_pago')
  })

  it('dado la administración, la bandeja muestra el pago con aprobar y rechazar', async () => {
    await enviarComprobante('00012345')
    pantalla.cargas = { pagos_por_verificar: await bd.rpc('pagos_por_verificar', { token: admin }) }
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(PagosAdmin)))
    expect(html).toContain('Operación 00012345')
    expect(html).toContain('Aprobar')
  })
})

describe('HU-16: otro usuario no puede ver el comprobante ajeno (Ley N.° 29733)', () => {
  it('dado otra asistente, entonces no recibe mi pago ni puede pedir mi comprobante', async () => {
    const { pago } = await enviarComprobante()
    await bd.rpc('aprobar_pago', { token: admin, pago_id: pago.id })
    const luis = await bd.cuenta('luis@unsaac.test')
    expect(JSON.stringify(await bd.rpc('mis_inscripciones', { token: luis }))).not.toContain(pago.id)
    await expect(bd.rpc('comprobante_pago', { token: luis, pago_id: pago.id })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
  })

  it('dado el organizador del evento, el comprobante que ve no trae la ruta de mi captura', async () => {
    const { pago } = await enviarComprobante()
    await bd.rpc('aprobar_pago', { token: admin, pago_id: pago.id })
    const c = await bd.rpc('comprobante_pago', { token: carmen, pago_id: pago.id })
    expect(JSON.stringify(c)).not.toContain(ins.id + '/')
  })

  // H-01 (ver el plan): en Supabase la captura todavía no está en un bucket privado con lectura firmada (CAP-92).
  it.todo('en Supabase, la captura solo se lee con un enlace firmado que pide la administración o su dueña (CAP-92)')
})

describe('HU-16: casos que encontró esta tarea y la pasarela de la demostración', () => {
  it('D-02: si cancelo con un pago por verificar, la administración lo ve marcado para coordinar la devolución', async () => {
    await enviarComprobante()
    await bd.rpc('cancelar_inscripcion', { token: ana, id: ins.id })
    expect(await bd.rpc('pagos_por_verificar', { token: admin })).toMatchObject([{ inscripcion_id: ins.id, inscripcion_vigente: false }])
  })

  it('con el modo demostración apagado, la pasarela simulada no confirma pagos ni se ofrece en la pantalla', async () => {
    const { pago } = await bd.rpc<any>('iniciar_pago', { token: ana, inscripcion_id: ins.id, metodo: 'yape' })
    await bd.rpc('admin_modo_demo', { token: admin, activo: false })
    await expect(bd.rpc('respuesta_pasarela', { token: ana, pago_id: pago.id, resultado: 'aprobado' })).rejects.toMatchObject({ codigo: 'PASARELA_DESACTIVADA' })
    pantalla.modoDemo = false
    expect(await paginaDePago()).not.toContain('Usar la pasarela simulada')
  })
})
