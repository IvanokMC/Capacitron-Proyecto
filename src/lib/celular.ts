// CAP-100 · Celular del asistente en la pantalla (HU-18, CA-01, CA-03 y CA-05). Rol: Frontend (José).
//
// Code smells / duplicación (diap. 33): la regla del celular se escribe una sola vez y la usan el registro
// y Mi perfil. Es la misma que aplica la API (capa.celular_valido, CAP-99): aquí solo se avisa antes de
// enviar, la que decide es la base de datos.
// SRP (diap. 39–49): este módulo valida y arma el enlace; los componentes de CAP-98 solo muestran.

/** Mismo texto que devuelve la API (capa.mensaje_celular), para que la persona lea lo mismo en los dos casos. */
export const MENSAJE_CELULAR = 'El celular debe tener 9 dígitos y empezar con 9.'

export const FALTA_CELULAR = {
  registro: 'Escribe tu celular: lo necesitan los organizadores para avisos del evento.',
  /** Cuenta antigua sin celular que marca «Compartir». */
  compartirSinCelular: 'Para compartir tu celular, primero escríbelo.',
  /** Quien ya tiene celular no lo puede borrar (regla de CAP-99). */
  noSeQuita: 'El celular no se puede quitar. Si no quieres que lo vean, desmarca «Compartir mi celular».',
} as const

/** Deja solo los dígitos y quita un +51 inicial, como hace la API. */
export function limpiarCelular(v: string): string {
  const d = v.replace(/\D/g, '')
  return d.length === 11 && d.startsWith('51') ? d.slice(2) : d
}

/** CA-01: 9 dígitos que empiezan con 9. Devuelve el motivo o null si está bien (o vacío y no es obligatorio). */
export function validarCelular(valor: string, obligatorio: boolean, siFalta: string = FALTA_CELULAR.registro): string | null {
  const c = limpiarCelular(valor)
  if (!c) return obligatorio ? siFalta : null
  return /^9\d{8}$/.test(c) ? null : MENSAJE_CELULAR
}

/**
 * Regla de Mi perfil (CA-03): una cuenta antigua puede seguir sin celular, salvo que quiera compartirlo;
 * quien ya lo tiene puede cambiarlo, pero no borrarlo.
 */
export function validarCelularPerfil(valor: string, celularGuardado: string | null, comparte: boolean): string | null {
  const obligatorio = !!celularGuardado || comparte
  return validarCelular(valor, obligatorio, celularGuardado ? FALTA_CELULAR.noSeQuita : FALTA_CELULAR.compartirSinCelular)
}

/**
 * CA-05: enlace de WhatsApp (wa.me) con un saludo listo. Solo se arma si llegó el número, y el número solo
 * llega si la persona dio su consentimiento (CAP-99), así que aquí no hace falta volver a preguntarlo.
 */
export function enlaceWhatsapp(celular: string, nombre: string, evento: string): string {
  const primerNombre = nombre.trim().split(/\s+/)[0] ?? ''
  return enlaceWa(celular, `Hola ${primerNombre}, te escribo por el evento «${evento}» de CAPACITRON.`)
}

/**
 * CAP-90: enlace wa.me con un mensaje cualquiera. Lo usan el contacto con el asistente (CAP-100) y el pago por
 * WhatsApp (HU-16 CA-01): una sola forma de armar el enlace (code smells / duplicación, diap. 33).
 */
export function enlaceWa(celular: string, texto: string): string {
  return `https://wa.me/51${limpiarCelular(celular)}?text=${encodeURIComponent(texto)}`
}
