import type { CertificadoDatos } from './tipos'
import { fechaCorta, fechaLarga, hora, METODO, MODALIDAD, soles, rangoEvento } from './formato'
import { qrDataUrl } from '../components/qr'

const GRANA: [number, number, number] = [110, 14, 49]
const TINTA: [number, number, number] = [22, 26, 46]
const TINTA3: [number, number, number] = [95, 101, 132]
const TINTES: [number, number, number][] = [[226, 162, 10], [75, 150, 88], [244, 245, 248], [80, 104, 196]]

async function jspdf() {
  const { jsPDF } = await import('jspdf')
  return jsPDF
}

/** Columna tejida: celdas de los cuatro tintes sobre la banda grana. */
function columnaTejida(doc: import('jspdf').jsPDF, x: number, y: number, ancho: number, alto: number) {
  doc.setFillColor(...GRANA)
  doc.rect(x, y, ancho, alto, 'F')
  const celda = 4.2
  const paso = celda + 1.6
  const cols = Math.floor((ancho - 4) / paso)
  const x0 = x + (ancho - cols * paso + 1.6) / 2
  let k = 0
  for (let yy = y + 6; yy + celda < y + alto - 4; yy += paso) {
    for (let c = 0; c < cols; c++) {
      doc.setFillColor(...TINTES[(k + c) % TINTES.length])
      doc.rect(x0 + c * paso, yy, celda, celda, 'F')
    }
    k++
  }
}

function descargar(doc: import('jspdf').jsPDF, nombre: string) {
  doc.save(nombre)
}

export async function pdfCertificado(c: CertificadoDatos) {
  const JsPDF = await jspdf()
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const W = 297
  const H = 210
  const url = `${location.origin}/verificar/${c.codigo}`

  columnaTejida(doc, 0, 0, 26, H)

  const x = 44
  doc.setTextColor(...TINTA3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setCharSpace(1.2)
  doc.text('CAPACITRON', x, 26)
  doc.setCharSpace(0)
  doc.setFont('helvetica', 'normal')
  if (c.institucion) doc.text(c.institucion, x, 31.5)

  doc.setTextColor(...GRANA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(34)
  doc.text('Certificado', x, 54)

  doc.setTextColor(...TINTA3)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.text('Se otorga el presente certificado a', x, 70)

  doc.setTextColor(...TINTA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text(c.titular, x, 84, { maxWidth: W - x - 20 })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(12)
  doc.setTextColor(...TINTA3)
  doc.text('por su participación en', x, 98)
  doc.setTextColor(...TINTA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  const lineasEvento = doc.splitTextToSize(c.evento, W - x - 70)
  doc.text(lineasEvento, x, 107)

  const yDet = 107 + lineasEvento.length * 7 + 3
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(...TINTA3)
  const detalle = `${MODALIDAD[c.modalidad]}, ${rangoEvento(c.fecha_inicio, c.fecha_fin)}. Duración: ${c.horas_academicas} horas académicas. Asistencia registrada: ${Number(c.porcentaje_asistencia).toLocaleString('es-PE')} %.`
  doc.text(doc.splitTextToSize(detalle, W - x - 70), x, yDet)

  // Firma
  const yFirma = 172
  doc.setDrawColor(...TINTA3)
  doc.setLineWidth(0.3)
  doc.line(x, yFirma, x + 80, yFirma)
  doc.setFont('times', 'italic')
  doc.setFontSize(20)
  doc.setTextColor(...TINTA)
  doc.text(c.firmante_nombre ?? '', x + 2, yFirma - 3)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text(c.firmante_nombre ?? '', x, yFirma + 5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TINTA3)
  doc.text(c.firmante_cargo ?? '', x, yFirma + 10.5)
  doc.text(`Emitido el ${fechaCorta(c.emitido_en)}`, x, yFirma + 17)

  // Verificación
  const qr = await qrDataUrl(url, 500)
  const lado = 40
  const qx = W - 20 - lado
  doc.addImage(qr, 'PNG', qx, 128, lado, lado)
  doc.setFontSize(8.5)
  doc.setTextColor(...TINTA3)
  doc.text('Código de verificación', qx + lado / 2, 174, { align: 'center' })
  doc.setFont('courier', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(...TINTA)
  doc.text(c.codigo, qx + lado / 2, 179.5, { align: 'center' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...TINTA3)
  doc.text(doc.splitTextToSize(`${location.host}/verificar`, 60), qx + lado / 2, 184.5, { align: 'center' })

  if (c.estado === 'revocado') {
    doc.setTextColor(179, 38, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(56)
    doc.text('REVOCADO', W / 2 + 10, H / 2 + 10, { align: 'center', angle: 18 })
  }

  doc.setProperties({ title: `Certificado ${c.codigo}`, subject: c.evento, author: 'CAPACITRON' })
  descargar(doc, `certificado-${c.codigo}.pdf`)
}

export interface DatosComprobante {
  numero_comprobante: string
  referencia_externa: string | null
  metodo: string
  monto: number
  actualizado_en?: string
  creado_en: string
  titular: string
  correo: string
  evento: string
  evento_fecha: string
  institucion: string | null
}

export async function pdfComprobante(c: DatosComprobante) {
  const JsPDF = await jspdf()
  const doc = new JsPDF({ unit: 'mm', format: 'a5' })
  const W = 148
  doc.setFillColor(...GRANA)
  doc.rect(0, 0, W, 26, 'F')
  for (let i = 0; i < W / 6; i++) {
    doc.setFillColor(...TINTES[i % 4])
    doc.rect(i * 6, 26, 4.4, 1.6, 'F')
  }
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setCharSpace(1)
  doc.text('CAPACITRON', 14, 12)
  doc.setCharSpace(0)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text('Comprobante de pago electrónico', 14, 18)

  doc.setTextColor(...TINTA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(c.numero_comprobante, 14, 42)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TINTA3)
  const fecha = c.actualizado_en ?? c.creado_en
  doc.text(`${fechaLarga(fecha)}, ${hora(fecha)} h`, 14, 48)

  const filas: [string, string][] = [
    ['Titular', c.titular],
    ['Correo', c.correo],
    ['Concepto', `Inscripción: ${c.evento}`],
    ['Fecha del evento', fechaLarga(c.evento_fecha)],
    ['Organiza', c.institucion ?? '—'],
    ['Medio de pago', METODO[c.metodo] ?? c.metodo],
    ['Referencia de la operación', c.referencia_externa ?? '—'],
  ]
  let y = 62
  doc.setFontSize(9.5)
  for (const [k, v] of filas) {
    doc.setTextColor(...TINTA3)
    doc.text(k, 14, y)
    doc.setTextColor(...TINTA)
    const lineas = doc.splitTextToSize(v, 78)
    doc.text(lineas, 56, y)
    y += Math.max(lineas.length, 1) * 5 + 3
  }
  doc.setDrawColor(224, 227, 234)
  doc.line(14, y, W - 14, y)
  y += 9
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Total pagado', 14, y)
  doc.text(soles(c.monto), W - 14, y, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...TINTA3)
  doc.text(doc.splitTextToSize('Pago procesado por la pasarela simulada de la versión de demostración de CAPACITRON. CAPACITRON no almacena números de tarjeta ni credenciales de pago.', W - 28), 14, 196)
  doc.setProperties({ title: `Comprobante ${c.numero_comprobante}`, author: 'CAPACITRON' })
  descargar(doc, `comprobante-${c.numero_comprobante}.pdf`)
}

export interface FilaReporte {
  nombre: string
  fecha_inicio: string
  modalidad: string
  cupo_maximo: number
  inscritos: number
  asistentes: number
  porcentaje_asistencia: number
  ingresos: number
  en_espera: number
  certificados: number
  satisfaccion: number | null
}

export async function pdfReporte(titulo: string, filtros: string, totales: Record<string, number>, filas: FilaReporte[], generado: string) {
  const JsPDF = await jspdf()
  const { default: autoTable } = await import('jspdf-autotable')
  const doc = new JsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  doc.setFillColor(...GRANA)
  doc.rect(0, 0, 297, 4, 'F')
  doc.setTextColor(...TINTA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(titulo, 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...TINTA3)
  doc.text(`${filtros} · Generado el ${fechaCorta(generado)} a las ${hora(generado)} h`, 14, 24)

  const resumen: [string, string][] = [
    ['Eventos', String(totales.eventos)],
    ['Inscritos', String(totales.inscritos)],
    ['Asistentes', String(totales.asistentes)],
    ['Asistencia', `${totales.porcentaje_asistencia} %`],
    ['Ingresos confirmados', soles(totales.ingresos)],
    ['Certificados válidos', String(totales.certificados)],
  ]
  let x = 14
  for (const [k, v] of resumen) {
    doc.setFontSize(8.5)
    doc.setTextColor(...TINTA3)
    doc.text(k, x, 34)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TINTA)
    doc.text(v, x, 41)
    doc.setFont('helvetica', 'normal')
    x += 45
  }

  autoTable(doc, {
    startY: 48,
    head: [['Evento', 'Fecha', 'Modalidad', 'Cupo', 'Inscritos', 'Asistentes', '% asist.', 'Ingresos', 'En espera', 'Certif.', 'Satisf.']],
    body: filas.map((f) => [
      f.nombre, fechaCorta(f.fecha_inicio), MODALIDAD[f.modalidad], f.cupo_maximo, f.inscritos, f.asistentes,
      `${f.porcentaje_asistencia} %`, soles(f.ingresos), f.en_espera, f.certificados, f.satisfaccion ?? '—',
    ]),
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.2, textColor: TINTA, lineColor: [224, 227, 234], lineWidth: 0.1 },
    headStyles: { fillColor: [236, 238, 243], textColor: TINTA, fontStyle: 'bold' },
    columnStyles: { 0: { cellWidth: 72 } },
    alternateRowStyles: { fillColor: [250, 250, 252] },
  })
  doc.setProperties({ title: titulo, author: 'CAPACITRON' })
  descargar(doc, `reporte-participacion-${generado.slice(0, 10)}.pdf`)
}
