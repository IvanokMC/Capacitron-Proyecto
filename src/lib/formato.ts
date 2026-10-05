// Fechas siempre en hora de Perú (UTC-5, sin horario de verano).
export const ZONA = 'America/Lima'

const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-PE', { timeZone: ZONA, ...o })

const fmtFechaLarga = f({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const fmtFechaCorta = f({ day: 'numeric', month: 'short', year: 'numeric' })
const fmtFechaCortaSinAnio = f({ day: 'numeric', month: 'short' })
const fmtHora = f({ hour: '2-digit', minute: '2-digit', hour12: false })
const fmtDia = f({ day: 'numeric' })
const fmtMes = f({ month: 'short' })
const fmtDiaSemana = f({ weekday: 'short' })
const fmtPartes = f({ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })

const d = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v)

export const fechaLarga = (v: string | Date) => fmtFechaLarga.format(d(v))
export const fechaCorta = (v: string | Date) => fmtFechaCorta.format(d(v)).replace('.', '')
export const fechaCortaSinAnio = (v: string | Date) => fmtFechaCortaSinAnio.format(d(v)).replace('.', '')
export const hora = (v: string | Date) => fmtHora.format(d(v))
export const dia = (v: string | Date) => fmtDia.format(d(v))
export const mes = (v: string | Date) => fmtMes.format(d(v)).replace('.', '')
export const diaSemana = (v: string | Date) => fmtDiaSemana.format(d(v)).replace('.', '')
export const fechaHora = (v: string | Date) => `${fechaCorta(v)}, ${hora(v)} h`

/** «lunes 12 de octubre, 15:00–19:00 h» o un rango de varios días. */
export function rangoEvento(inicio: string, fin: string) {
  const mismoDia = claveDia(inicio) === claveDia(fin)
  if (mismoDia) return `${fechaLarga(inicio)}, ${hora(inicio)}–${hora(fin)} h`
  return `${fechaCortaSinAnio(inicio)}, ${hora(inicio)} h – ${fechaCorta(fin)}, ${hora(fin)} h`
}

/** AAAA-MM-DD en hora de Lima. */
export function claveDia(v: string | Date) {
  const p = Object.fromEntries(fmtPartes.formatToParts(d(v)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}`
}

/** Valor para <input type="datetime-local">, expresado en hora de Lima. */
export function aInputLocal(v: string | Date | null | undefined) {
  if (!v) return ''
  const p = Object.fromEntries(fmtPartes.formatToParts(d(v)).map((x) => [x.type, x.value]))
  const h = p.hour === '24' ? '00' : p.hour
  return `${p.year}-${p.month}-${p.day}T${h}:${p.minute}`
}

/** Interpreta un valor de <input type="datetime-local"> como hora de Lima. */
export function desdeInputLocal(v: string) {
  if (!v) return ''
  return new Date(`${v}:00-05:00`).toISOString()
}

const fmtSoles = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 })
export const soles = (n: number) => fmtSoles.format(n).replace('PEN', 'S/').replace(/ /g, ' ')
export const precio = (n: number) => (n === 0 ? 'Gratis' : soles(n))

const fmtNum = new Intl.NumberFormat('es-PE')
export const num = (n: number) => fmtNum.format(n)

export const MODALIDAD: Record<string, string> = { presencial: 'Presencial', virtual: 'Virtual', mixta: 'Mixta' }
export const METODO: Record<string, string> = { yape: 'Yape', plin: 'Plin', paypal: 'PayPal' }
export const PLATAFORMA: Record<string, string> = { zoom: 'Zoom', meet: 'Google Meet', teams: 'Microsoft Teams' }
export const ROL: Record<string, string> = {
  asistente: 'Asistente', organizador: 'Organizador', ponente: 'Ponente', admin: 'Administración',
}

/** «en 3 h», «hace 2 días», respecto de la hora del sistema. */
export function relativo(v: string | Date, ahora: Date) {
  const diff = d(v).getTime() - ahora.getTime()
  const abs = Math.abs(diff)
  const min = Math.round(abs / 60000)
  let txt: string
  if (min < 1) return 'ahora'
  if (min < 60) txt = `${min} min`
  else if (min < 60 * 36) txt = `${Math.round(min / 60)} h`
  else txt = `${Math.round(min / 1440)} días`
  return diff > 0 ? `en ${txt}` : `hace ${txt}`
}

export function iniciales(nombre: string) {
  return nombre
    .replace(/^(Dra?\.|Mg\.|Ing\.|Lic\.)\s*/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}
