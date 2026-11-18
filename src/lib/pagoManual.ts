// Pago real con verificación manual: estado del pago, mensaje de WhatsApp y registro del comprobante
// (CAP-90 · José, Frontend · HU-16 CA-01 a CA-04 y CA-06). La API es de CAP-89 (Carlos).
//
// Teoría de Diseño de Software:
// · SRP (diap. 39–49): aquí está la lógica del pago (qué estado mostrar, qué validar, qué mandar a la API); las
//   pantallas (PagarInscripcion.tsx y admin/Pagos.tsx) solo la dibujan con los componentes de Medaly (CAP-88).
//   Por eso se prueba sin navegador.
// · DIP (diap. 92–106): registrarPagoManual recibe la API, el almacenamiento y la compresión como contratos;
//   no conoce Supabase.
// · Code smells / duplicación (diap. 33): la captura se valida con el módulo común (REGLAS.comprobantes y el mismo
//   estado de imagen que el perfil y el flyer, imagenElegida.ts), el número de operación con la misma regla que
//   la API y el enlace de WhatsApp con el de CAP-100 (enlaceWa).
import { REGLAS, subirArchivo, validarArchivo, type Almacenamiento } from './almacenamiento'
import { comprimirImagen } from './almacenamiento/comprimir'
import { enlaceWa } from './celular'
import { soles } from './formato'
import type { EstadoImagen } from './imagenElegida'
import type { MedioPagoManual, MediosPago, MiInscripcion, Pago } from './tipos'

export type EstadoPagoVisible = 'por_verificar' | 'aprobado' | 'rechazado'

/** El último pago con verificación manual (los de la pasarela simulada no tienen número de operación). */
export function ultimoPagoManual(pagos: Pago[]): Pago | null {
  return [...pagos].sort((a, b) => b.creado_en.localeCompare(a.creado_en)).find((p) => !!p.numero_operacion) ?? null
}

/** Qué estado del pago ve la persona (EstadoPago, CAP-88). null = todavía no envió un comprobante. */
export function estadoPagoManual(i: Pick<MiInscripcion, 'estado' | 'pagos'>): { estado: EstadoPagoVisible; pago: Pago } | null {
  const p = ultimoPagoManual(i.pagos)
  if (!p) return null
  if (p.estado === 'confirmado' && i.estado === 'confirmada') return { estado: 'aprobado', pago: p }
  if (p.estado === 'por_verificar' && i.estado === 'pendiente_pago') return { estado: 'por_verificar', pago: p }
  if (p.estado === 'rechazado' && i.estado === 'pendiente_pago') return { estado: 'rechazado', pago: p }
  return null
}

/** CA-01: mensaje preparado con el nombre, el evento y el monto. */
export function mensajePago(nombre: string, evento: string, monto: number): string {
  return `Hola, soy ${nombre.trim()}. Quiero pagar mi inscripción en «${evento}» (${soles(monto)}). ¿Me ayudan a completar el pago?`
}

/** Enlace de WhatsApp de la organización con el mensaje, o null si no hay número configurado. */
export function enlacePago(whatsapp: string | null | undefined, mensaje: string): string | null {
  return whatsapp ? enlaceWa(whatsapp, mensaje) : null
}

/** Los datos de pago tal como los muestran los paneles de CAP-88 (sin null) y la dirección del QR ya resuelta. */
export function configParaPantalla(m: MediosPago | null, urlQr: string | null) {
  const c = m?.config
  return {
    yape_qr: urlQr, yape_titular: c?.yape_titular ?? '', banco: c?.banco ?? '', cuenta: c?.cuenta ?? '',
    cci: c?.cci ?? '', titular: c?.titular ?? '', whatsapp: c?.whatsapp ?? '',
  }
}

/** El QR se guarda como ruta en el bucket «fotos» (carpeta de la cuenta de administración) o como dirección completa. */
export const esDireccion = (v: string) => /^https?:\/\//.test(v)

export const MENSAJE_OPERACION = 'Escribe el número de operación de la constancia (de 4 a 30 letras o números).'

/** Misma regla que registrar_pago_manual (CAP-89). */
export function validarOperacion(v: string): string | null {
  return /^[A-Za-z0-9-]{4,30}$/.test(v.trim()) ? null : MENSAJE_OPERACION
}

export interface ErroresPago { operacion?: string; captura?: string }

type Api = <T = any>(fn: string, p?: Record<string, unknown>) => Promise<T>
type Comprimir = (archivo: Blob) => Promise<Blob>

/**
 * CA-02: valida, comprime la captura (CAP-112), la sube a «comprobantes/<id de la inscripción>/…» y registra el pago.
 * Devuelve los errores para el formulario, o el pago registrado.
 */
export async function registrarPagoManual(
  api: Api, alm: Almacenamiento, inscripcionId: string, medio: MedioPagoManual, operacion: string, captura: EstadoImagen,
  comprimir: Comprimir = comprimirImagen,
): Promise<{ errores: ErroresPago } | { pago: Pago }> {
  const errores: ErroresPago = {}
  const op = validarOperacion(operacion)
  if (op) errores.operacion = op
  if (!captura.archivo) errores.captura = 'Adjunta la captura del comprobante.'
  else {
    const motivo = validarArchivo(captura.archivo, REGLAS.comprobantes)
    if (motivo) errores.captura = motivo
  }
  if (errores.operacion || errores.captura) return { errores }
  // Se comprime después de validar el original, como el flyer (CA-04 de la HU-20): la captura sigue legible a 1600 px.
  const archivo = await comprimir(captura.archivo!)
  const ruta = await subirArchivo(alm, 'comprobantes', inscripcionId, archivo)
  const r = await api<{ pago: Pago }>('registrar_pago_manual', {
    inscripcion_id: inscripcionId, metodo: medio, numero_operacion: operacion.trim(), comprobante: ruta,
  })
  return { pago: r.pago }
}

/** Una fila de pagos_por_verificar (CAP-89) para la bandeja de CAP-88. */
export interface FilaPorVerificar {
  id: string; inscripcion_id: string; persona: string; correo: string; evento: string; monto: number
  medio: MedioPagoManual; operacion: string; enviado: string; comprobante: string | null
  /** false si la inscripción se canceló con el pago por verificar (D-02 de CAP-91): hay que coordinar la devolución. */
  inscripcion_vigente?: boolean
}

export const AVISO_NO_VIGENTE = 'Inscripción cancelada: rechaza el pago y coordina la devolución si hubo cobro'
