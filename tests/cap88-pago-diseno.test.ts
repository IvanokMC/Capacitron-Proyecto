// CAP-88 · Estados del diseño del pago real y de la bandeja de verificación (HU-16, CA-01 a CA-04 y CA-06).
// Rol: Diseño UI/UX (Medaly). Teoría: refactorizar con pruebas (diap. 140), OCP/Strategy (diap. 50–63 y
// 117–125): los medios de pago salen de una sola lista, y cohesión (diap. 26–28).
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  BandejaPagos, EstadoPago, FormComprobante, FormConfigPagos, FormRechazo, MEDIOS_PAGO, MOTIVOS_FRECUENTES, PanelTransferencia,
  PanelWhatsapp, PanelYape, SelectorMedioPago, TEXTOS_PAGO, type ConfigPagos,
} from '../src/components/PagoReal'

const nada = () => {}
const CONFIG: ConfigPagos = {
  yape_qr: 'https://x.pe/qr.png', yape_titular: 'Organización', banco: 'Banco de ejemplo',
  cuenta: '000-0000000000-00', cci: '000-000-000000000000-00', titular: 'Organización', whatsapp: '900000000',
}
const VACIA: ConfigPagos = { yape_qr: null, yape_titular: '', banco: '', cuenta: '', cci: '', titular: '', whatsapp: '' }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const r = (c: any, p: Record<string, unknown>) => renderToStaticMarkup(h(c, p))

describe('CAP-88 elegir el medio (CA-01)', () => {
  it('los tres medios salen de una sola lista (OCP), en un grupo de radio accesible', () => {
    expect(MEDIOS_PAGO.map((m) => m.medio)).toEqual(['yape', 'transferencia', 'whatsapp'])
    const html = r(SelectorMedioPago, { elegido: 'transferencia', onElegir: nada })
    expect(html).toContain('role="radiogroup"')
    expect((html.match(/role="radio"/g) ?? []).length).toBe(3)
    expect(html).toMatch(/aria-checked="true"[^>]*>.*Transferencia/s)
  })
})

describe('CAP-88 un panel por medio (Strategy)', () => {
  it('Yape: el QR con su descripción, el monto en soles y el titular', () => {
    const html = r(PanelYape, { config: CONFIG, monto: 80 })
    expect(html).toContain('src="https://x.pe/qr.png"')
    expect(html).toContain('alt="Código QR de Yape de Organización"')
    expect(html).toContain('S/')
    expect(html).toContain('80.00')
  })

  it('transferencia: banco, cuenta, CCI y titular, con «Copiar» en la cuenta y el CCI', () => {
    const html = r(PanelTransferencia, { config: CONFIG, monto: 80, onCopiar: nada })
    for (const t of ['Banco de ejemplo', '000-0000000000-00', '000-000-000000000000-00', 'Titular']) expect(html).toContain(t)
    expect(html).toContain('aria-label="Copiar número de cuenta"')
    expect(html).toContain('aria-label="Copiar cci (desde otros bancos)"')
  })

  it('WhatsApp: muestra el mensaje preparado y abre wa.me en otra pestaña', () => {
    const html = r(PanelWhatsapp, { config: CONFIG, enlace: 'https://wa.me/51900000000?text=Hola', mensaje: 'Hola, soy Ana' })
    expect(html).toContain('Hola, soy Ana')
    expect(html).toContain('href="https://wa.me/51900000000?text=Hola"')
    expect(html).toContain('target="_blank"')
  })

  it('si la administración no configuró un medio, se dice en vez de mostrar datos vacíos', () => {
    for (const p of [r(PanelYape, { config: VACIA, monto: 80 }), r(PanelTransferencia, { config: VACIA, monto: 80 }),
      r(PanelWhatsapp, { config: VACIA, enlace: null, mensaje: '' })]) {
      expect(p).toContain(TEXTOS_PAGO.sinConfig)
    }
  })
})

describe('CAP-88 registrar el pago (CA-02)', () => {
  it('número de operación, captura sin descripción pública y el botón de enviar', () => {
    const html = r(FormComprobante, { operacion: '00000001', onOperacion: nada, vista: 'https://x.pe/c.png', onElegir: nada, onEnviar: nada })
    expect(html).toContain(TEXTOS_PAGO.operacion)
    expect(html).toContain('value="00000001"')
    expect(html).toContain(TEXTOS_PAGO.comprobante)
    expect(html).toContain(TEXTOS_PAGO.ayudaComprobante)
    expect(html).not.toContain('Descripción para quien no puede ver la imagen')
    expect(html).toContain(TEXTOS_PAGO.enviar)
  })

  it('los errores del número y de la captura se anuncian', () => {
    const html = r(FormComprobante, { operacion: '', onOperacion: nada, onElegir: nada, onEnviar: nada,
      errorOperacion: 'Escribe el número de operación.', errorArchivo: 'Adjunta la captura del comprobante.' })
    expect((html.match(/role="alert"/g) ?? []).length).toBe(2)
  })
})

describe('CAP-88 estados del pago (CA-02 a CA-04)', () => {
  it('por verificar, aprobado y rechazado con su motivo y la opción de reenviar', () => {
    expect(r(EstadoPago, { estado: 'por_verificar' })).toContain(TEXTOS_PAGO.porVerificar)
    expect(r(EstadoPago, { estado: 'aprobado' })).toContain(TEXTOS_PAGO.aprobado)
    const rech = r(EstadoPago, { estado: 'rechazado', motivo: 'El monto no coincide.', accion: h('button', null, TEXTOS_PAGO.reenviar) })
    expect(rech).toContain('El monto no coincide.')
    expect(rech).toContain(TEXTOS_PAGO.reenviar)
    expect(rech).toContain('role="status"')
  })
})

describe('CAP-88 administración (CA-03, CA-04 y CA-06)', () => {
  const pago = { id: '1', persona: 'Ana', correo: 'a@b.pe', evento: 'Curso', monto: 80, medio: 'yape' as const, operacion: '0001', enviado: 'hace 5 min', comprobante: 'https://x.pe/c.png' }

  it('cada pago muestra la persona, el evento, el monto, el medio, la operación y su captura, con aprobar y rechazar', () => {
    const html = r(BandejaPagos, { pagos: [pago], onAprobar: nada, onRechazar: nada })
    for (const t of ['Ana', 'Curso', '80.00', 'Yape', 'Operación 0001', 'Aprobar', 'Rechazar']) expect(html).toContain(t)
    expect(html).toContain('aria-label="Ver comprobante de Ana"')
  })

  it('sin pagos por verificar lo dice', () => {
    expect(r(BandejaPagos, { pagos: [], onAprobar: nada, onRechazar: nada })).toContain('No hay pagos por verificar.')
  })

  it('rechazar pide un motivo y ofrece los frecuentes', () => {
    const html = r(FormRechazo, { motivo: '', onMotivo: nada })
    expect(html).toContain('Motivo del rechazo')
    for (const m of MOTIVOS_FRECUENTES) expect(html).toContain(m)
  })

  it('la configuración tiene el QR, la cuenta, el CCI, el titular y el WhatsApp', () => {
    const html = r(FormConfigPagos, { config: CONFIG, onCambio: nada, onElegirQr: nada })
    for (const t of ['Código QR', 'Banco', 'Número de cuenta', 'CCI', 'Titular de la cuenta', 'Número de WhatsApp de la organización']) expect(html).toContain(t)
  })
})
