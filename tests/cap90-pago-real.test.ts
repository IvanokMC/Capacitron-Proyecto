// CAP-90 · Pantalla de pago real y verificación en Administración (HU-16, CA-01 a CA-04 y CA-06). Rol: Frontend (José).
// Teoría: refactorizar con pruebas (diap. 140); Strategy y OCP (diap. 117–125 y 50–63): un panel por medio;
// DIP (diap. 92–106): la lógica recibe la API, el almacenamiento y la compresión como contratos.
// Los datos de pago son de ejemplo (cuentas con ceros, números de operación inventados).
import { readFileSync } from 'node:fs'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import { IMAGEN_INICIAL, type EstadoImagen } from '../src/lib/imagenElegida'
import {
  configParaPantalla, enlacePago, estadoPagoManual, mensajePago, MENSAJE_OPERACION, registrarPagoManual, validarOperacion,
} from '../src/lib/pagoManual'
import { MEDIOS_PAGO } from '../src/components/PagoReal'
import { nuevaBd, type Bd } from './bd'
// Pantallas importadas al inicio (con la suite en paralelo, un import dinámico puede pasar el tiempo límite).
import PagarInscripcion, { PANELES } from '../src/pages/PagarInscripcion'
import MisInscripciones from '../src/pages/MisInscripciones'
import { PagosAdmin } from '../src/pages/admin/Pagos'

const sesion = vi.hoisted(() => ({ usuario: null as any, modoDemo: false, cargas: {} as Record<string, unknown> }))
vi.mock('../src/lib/app', () => ({
  useApp: () => ({ usuario: sesion.usuario, api: async () => ({}), ahora: () => new Date(), latir: () => {}, listo: true,
    sistema: { modo_demo: sesion.modoDemo, ahora: new Date().toISOString(), reloj_desfase_min: 0 } }),
  useCarga: (fn: string) => ({ datos: sesion.cargas[fn] ?? null, cargando: false, error: null, recargar: () => {}, setDatos: () => {} }),
}))
vi.mock('../src/components/notificaciones', () => ({ useNotas: () => ({ exito: () => {}, error: () => {} }) }))
vi.mock('../src/lib/almacenamiento', async (original) => ({
  ...(await original<typeof import('../src/lib/almacenamiento')>()),
  useUrlArchivo: (bucket: string, ruta: string | null | undefined) => (ruta ? `https://x.supabase.co/storage/v1/object/public/${bucket}/${ruta}` : null),
}))

const MB = 1024 * 1024
const archivo = (tipo: string, bytes: number) => new Blob([new Uint8Array(bytes)], { type: tipo })
const conCaptura = (a: Blob): EstadoImagen => ({ archivo: a, previa: 'blob:x', quitar: false, error: null })
const pago = (extra: Record<string, unknown>) => ({ id: 'p', inscripcion_id: 'i', metodo: 'yape', monto: 80, referencia_externa: null,
  numero_comprobante: null, mensaje: null, creado_en: '2026-11-25T10:00:00Z', numero_operacion: '12345678', motivo_rechazo: null, ...extra }) as any

describe('CAP-90 estado del pago y mensaje de WhatsApp (CA-01 a CA-04)', () => {
  it('el estado visible sale del último pago con número de operación', () => {
    expect(estadoPagoManual({ estado: 'pendiente_pago', pagos: [] })).toBeNull()
    expect(estadoPagoManual({ estado: 'pendiente_pago', pagos: [pago({ estado: 'por_verificar' })] })?.estado).toBe('por_verificar')
    expect(estadoPagoManual({ estado: 'confirmada', pagos: [pago({ estado: 'confirmado' })] })?.estado).toBe('aprobado')
    const viejo = pago({ estado: 'rechazado', creado_en: '2026-11-25T09:00:00Z', motivo_rechazo: 'La captura no se lee bien.' })
    expect(estadoPagoManual({ estado: 'pendiente_pago', pagos: [viejo, pago({ id: 'p2', estado: 'por_verificar' })] })?.pago.id).toBe('p2')
  })

  it('un intento de la pasarela simulada (sin número de operación) no cuenta como pago manual', () => {
    expect(estadoPagoManual({ estado: 'pendiente_pago', pagos: [pago({ estado: 'rechazado', numero_operacion: null })] })).toBeNull()
  })

  it('CA-01: el enlace de WhatsApp lleva el nombre, el evento y el monto', () => {
    const m = mensajePago('Ana Lucía Huamán', 'Curso de React', 80)
    const url = enlacePago('900 000 000', m)!
    expect(url.startsWith('https://wa.me/51900000000?text=')).toBe(true)
    const texto = decodeURIComponent(url.split('text=')[1])
    expect(texto).toContain('Ana Lucía Huamán')
    expect(texto).toContain('«Curso de React»')
    expect(texto).toContain('S/ 80.00')
    expect(enlacePago(null, m)).toBeNull()
  })

  it('el número de operación usa la misma regla que la API (CAP-89)', () => {
    expect(validarOperacion('12345678')).toBeNull()
    expect(validarOperacion('OP-2026-11')).toBeNull()
    expect(validarOperacion('12')).toBe(MENSAJE_OPERACION)
    expect(validarOperacion('123 456')).toBe(MENSAJE_OPERACION)
  })

  it('los paneles reciben textos vacíos en vez de null', () => {
    expect(configParaPantalla({ config: { yape_qr: null, yape_titular: null, banco: 'B', cuenta: null, cci: null, titular: null, whatsapp: null }, disponibles: [] }, null))
      .toMatchObject({ yape_qr: null, yape_titular: '', banco: 'B', cuenta: '' })
  })
})

describe('CAP-90 registrar el pago (CA-02)', () => {
  const INS = '7c3e2a10-5b4d-4e6f-9a81-0c2d3e4f5a6b'

  it('sin número de operación ni captura no llama a la API y dice qué falta', async () => {
    const api = vi.fn()
    const r = await registrarPagoManual(api, almacenamientoLocal({ persistir: false }), INS, 'yape', '', IMAGEN_INICIAL)
    expect(r).toEqual({ errores: { operacion: MENSAJE_OPERACION, captura: 'Adjunta la captura del comprobante.' } })
    expect(api).not.toHaveBeenCalled()
  })

  it('una captura de más de 3 MB se rechaza con lo que pesa', async () => {
    const r = await registrarPagoManual(vi.fn(), almacenamientoLocal({ persistir: false }), INS, 'yape', '12345678', conCaptura(archivo('image/png', 3 * MB + 1)))
    expect(r).toEqual({ errores: { captura: 'La captura pesa 3,1 MB y el límite es 3 MB.' } })
  })

  it('comprime después de validar, sube a la carpeta de la inscripción y manda lo que pide la API', async () => {
    const original = archivo('image/jpeg', 2 * MB)
    const comprimir = vi.fn(async () => archivo('image/webp', 100 * 1024))
    const api = vi.fn(async () => ({ pago: { id: 'p1', estado: 'por_verificar' } }))
    const r = await registrarPagoManual(api as any, almacenamientoLocal({ persistir: false }), INS, 'transferencia', ' 87654321 ', conCaptura(original), comprimir)
    expect(comprimir).toHaveBeenCalledWith(original)
    expect(api).toHaveBeenCalledWith('registrar_pago_manual', expect.objectContaining({
      inscripcion_id: INS, metodo: 'transferencia', numero_operacion: '87654321', comprobante: expect.stringMatching(new RegExp(`^${INS}/[a-z0-9-]+\\.webp$`)),
    }))
    expect(r).toEqual({ pago: { id: 'p1', estado: 'por_verificar' } })
  })
})

describe('CAP-90 de punta a punta con la base de datos', () => {
  let bd: Bd
  let admin: string
  let ana: string
  let ins: any
  beforeEach(async () => {
    bd = await nuevaBd()
    await bd.cuenta('admin@test.pe')
    await bd.sql(`update capa.usuarios set rol = 'admin' where correo = 'admin@test.pe'`)
    admin = (await bd.rpc('iniciar_sesion', { correo: 'admin@test.pe', password: 'Clave2026x' })).token
    const org = (await bd.organizador('org@test.pe')).token
    ana = await bd.cuenta('ana@test.pe')
    await bd.rpc('guardar_config_pagos', { token: admin, yape_qr: 'admin/qr.png', yape_titular: 'Organización de prueba', whatsapp: '900000000' })
    const e = await bd.evento(org, { costo: 80, nombre: 'Curso de prueba' })
    ins = (await bd.rpc('inscribirse', { token: ana, evento_id: e.id })).inscripcion
  })
  const apiDe = (token: string) => ((fn: string, p: Record<string, unknown> = {}) => bd.rpc(fn, { token, ...p })) as any
  const mia = async () => (await bd.rpc<any>('mis_inscripciones', { token: ana })).inscripciones.find((x: any) => x.id === ins.id)

  it('CA-02 y CA-03: registra, aparece en la bandeja y al aprobar se ve «aprobado»', async () => {
    await registrarPagoManual(apiDe(ana), almacenamientoLocal({ persistir: false }), ins.id, 'yape', '12345678', conCaptura(archivo('image/png', 1000)), async (a) => a)
    expect(estadoPagoManual(await mia())?.estado).toBe('por_verificar')
    const [fila] = await bd.rpc<any[]>('pagos_por_verificar', { token: admin })
    expect(fila).toMatchObject({ persona: 'ana Prueba', medio: 'yape', operacion: '12345678' })
    await bd.rpc('aprobar_pago', { token: admin, pago_id: fila.id })
    expect(estadoPagoManual(await mia())?.estado).toBe('aprobado')
  })

  it('CA-04: al rechazar se ve el motivo y se puede volver a enviar', async () => {
    const r: any = await registrarPagoManual(apiDe(ana), almacenamientoLocal({ persistir: false }), ins.id, 'whatsapp', '12345678', conCaptura(archivo('image/png', 1000)), async (a) => a)
    await bd.rpc('rechazar_pago', { token: admin, pago_id: r.pago.id, motivo: 'La captura no se lee bien.' })
    const estado = estadoPagoManual(await mia())
    expect(estado).toMatchObject({ estado: 'rechazado', pago: { motivo_rechazo: 'La captura no se lee bien.' } })
    const otra: any = await registrarPagoManual(apiDe(ana), almacenamientoLocal({ persistir: false }), ins.id, 'whatsapp', '99887766', conCaptura(archivo('image/png', 1000)), async (a) => a)
    expect(otra.pago.estado).toBe('por_verificar')
  })

  it('la pantalla de pago se dibuja con los datos reales: medios, QR de Yape y formulario', async () => {
    sesion.usuario = { id: 'u', nombre_completo: 'ana Prueba', rol: 'asistente' }
    sesion.modoDemo = false
    sesion.cargas = { mis_inscripciones: await bd.rpc('mis_inscripciones', { token: ana }), medios_pago: await bd.rpc('medios_pago') }
    const html = renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/mis-inscripciones/${ins.id}/pagar`] },
      h(Routes, null, h(Route, { path: '/mis-inscripciones/:id/pagar', element: h(PagarInscripcion) }))))
    expect(html).toContain('Paga tu inscripción')
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('src="https://x.supabase.co/storage/v1/object/public/fotos/admin/qr.png" alt="Código QR de Yape de Organización de prueba"')
    expect(html).toContain('Enviar para verificar')
    expect(html).not.toContain('pasarela simulada')
  })
})

describe('CAP-90 pantallas', () => {
  const INS_ID = 'a1b2c3d4-0000-4000-8000-000000000001'
  const inscripcion = (estado: string, pagos: any[]) => ({
    id: INS_ID, estado, monto: 80, reserva_expira_en: null, pagos, recordatorios: [], certificado: null, encuesta: null, puede_cancelar: false,
    jornadas_asistidas: 0, porcentaje_asistencia: 0, motivo_cancelacion: null, codigo_qr: 'x',
    evento: { id: 'e', nombre: 'Curso de prueba', fecha_inicio: '2026-11-28T15:00:00Z', fecha_fin: '2026-11-28T18:00:00Z', modalidad: 'presencial',
      lugar: 'Aula', fase: 'proximo', estado: 'publicado', total_jornadas: 1, porcentaje_minimo: 80 },
  })
  const medios = { config: { yape_qr: 'https://x/qr.png', yape_titular: 'Org', banco: null, cuenta: null, cci: null, titular: null, whatsapp: '900000000' }, disponibles: ['yape', 'whatsapp'] }
  const pantalla = () => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [`/mis-inscripciones/${INS_ID}/pagar`] },
    h(Routes, null, h(Route, { path: '/mis-inscripciones/:id/pagar', element: h(PagarInscripcion) }))))
  beforeEach(() => { sesion.usuario = { id: 'u', nombre_completo: 'Ana Huamán', rol: 'asistente' }; sesion.modoDemo = false })

  it('Strategy y OCP: cada medio del diseño tiene su panel, y el de WhatsApp abre wa.me', () => {
    for (const m of MEDIOS_PAGO) expect(PANELES).toHaveProperty(m.medio)
    const html = renderToStaticMarkup(h(MemoryRouter, null, PANELES.whatsapp({
      config: configParaPantalla(medios as any, null), monto: 80, mensaje: 'Hola', enlace: 'https://wa.me/51900000000?text=Hola', copiar: () => {},
    })))
    expect(html).toContain('href="https://wa.me/51900000000?text=Hola"')
  })

  it('CA-02: con un pago por verificar se ve el estado y no el formulario', () => {
    sesion.cargas = { mis_inscripciones: { inscripciones: [inscripcion('pendiente_pago', [pago({ estado: 'por_verificar' })])] }, medios_pago: medios }
    const html = pantalla()
    expect(html).toContain('Pago por verificar')
    expect(html).toContain('Operación 12345678')
    expect(html).not.toContain('Enviar para verificar')
  })

  it('CA-04: rechazado muestra el motivo y «Volver a enviar»', () => {
    sesion.cargas = { mis_inscripciones: { inscripciones: [inscripcion('pendiente_pago', [pago({ estado: 'rechazado', motivo_rechazo: 'El monto no coincide con el costo del evento.' })])] }, medios_pago: medios }
    const html = pantalla()
    expect(html).toContain('El monto no coincide con el costo del evento.')
    expect(html).toContain('Volver a enviar')
  })

  it('la pasarela simulada solo se ofrece en modo demostración', () => {
    sesion.cargas = { mis_inscripciones: { inscripciones: [inscripcion('pendiente_pago', [])] }, medios_pago: medios }
    expect(pantalla()).not.toContain('Usar la pasarela simulada')
    sesion.modoDemo = true
    expect(pantalla()).toContain('Usar la pasarela simulada')
  })

  it('SRP: la pasarela simulada salió de Mis inscripciones; la lista lleva a la pantalla de pago', () => {
    expect(readFileSync(new URL('../src/pages/MisInscripciones.tsx', import.meta.url), 'utf8')).not.toContain('respuesta_pasarela')
    expect(readFileSync(new URL('../src/components/PasarelaSimulada.tsx', import.meta.url), 'utf8')).toContain('respuesta_pasarela')
    sesion.cargas = { mis_inscripciones: { inscripciones: [inscripcion('pendiente_pago', [pago({ estado: 'por_verificar' })])], lista_espera: [] } }
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(MisInscripciones)))
    expect(html).toContain('Ver mi pago')
    expect(html).toContain('Pago por verificar (operación 12345678)')
  })

  it('CA-06: la bandeja de Administración muestra cada pago con aprobar y rechazar', () => {
    sesion.cargas = { pagos_por_verificar: [{ id: 'p1', inscripcion_id: INS_ID, persona: 'Ana Huamán', correo: 'ana@test.pe', evento: 'Curso de prueba',
      monto: 80, medio: 'yape', operacion: '12345678', enviado: '2026-11-25T15:00:00Z', comprobante: `${INS_ID}/c.webp` }] }
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(PagosAdmin)))
    expect(html).toContain('Ana Huamán')
    expect(html).toContain('Operación 12345678')
    expect(html).toContain('Aprobar')
    expect(html).toContain('Rechazar')
    expect(html).toContain('Configuración')
  })

  it('D-02 (CAP-91): un pago de una inscripción cancelada se ve marcado para coordinar la devolución', () => {
    sesion.cargas = { pagos_por_verificar: [{ id: 'p1', inscripcion_id: INS_ID, persona: 'Ana Huamán', correo: 'ana@test.pe', evento: 'Curso de prueba',
      monto: 80, medio: 'yape', operacion: '12345678', enviado: '2026-11-25T15:00:00Z', comprobante: null, inscripcion_vigente: false }] }
    expect(renderToStaticMarkup(h(MemoryRouter, null, h(PagosAdmin)))).toContain('Inscripción cancelada: rechaza el pago y coordina la devolución si hubo cobro')
  })
})
