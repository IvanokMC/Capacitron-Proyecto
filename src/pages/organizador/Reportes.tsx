import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChartBar, FileXls, FilePdf } from '@phosphor-icons/react'
import { useApp, useCarga } from '../../lib/app'
import { ErrorApi } from '../../lib/backend'
import { fechaCorta, hora, METODO, MODALIDAD, num, soles } from '../../lib/formato'
import { pdfReporte, type FilaReporte } from '../../lib/pdf'
import { BarrasH } from '../../components/graficos'
import { Aviso, Boton, CargandoLista, Campo, EncabezadoPagina, Entrada, Panel, Selector, Vacio } from '../../components/ui'
import { useNotas } from '../../components/notificaciones'

interface Reporte {
  generado_en: string
  plan: string
  puede_exportar: boolean
  eventos: (FilaReporte & { id: string; fase: string; costo: number; pendientes_pago: number; respuestas_encuesta: number })[]
  totales: { eventos: number; inscritos: number; asistentes: number; pendientes_pago: number; en_espera: number; certificados: number; ingresos: number; porcentaje_asistencia: number }
  por_metodo: { metodo: string; monto: number; operaciones: number }[]
}

/** HU-10: panel de participación en tiempo real, con filtros y exportación. */
export default function Reportes() {
  const { api, suscribirActividad, modo } = useApp()
  const notas = useNotas()
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [modalidad, setModalidad] = useState('')
  const [evento, setEvento] = useState('')
  const [exportando, setExportando] = useState<string | null>(null)
  const [errorPlan, setErrorPlan] = useState<string | null>(null)
  const [vivo, setVivo] = useState(0)

  const { datos, cargando, error, recargar } = useCarga<Reporte>('reporte_participacion', { desde, hasta, modalidad, evento_id: evento })
  // Todos los eventos (sin filtros) para el selector de evento.
  const { datos: todos } = useCarga<Reporte>('reporte_participacion', {})

  // Las cifras se actualizan solas ante inscripciones, pagos y asistencias (CA-02).
  useEffect(() => suscribirActividad(() => { recargar(); setVivo((n) => n + 1) }), [suscribirActividad, recargar])

  const conDatos = (datos?.eventos ?? []).filter((e) => e.inscritos > 0)
  const asistencia = useMemo(() => conDatos
    .filter((e) => e.fase !== 'proximo')
    .map((e) => ({
      clave: e.id,
      etiqueta: e.nombre,
      valor: Number(e.porcentaje_asistencia),
      rotulo: `${Number(e.porcentaje_asistencia).toLocaleString('es-PE')} %`,
      detalle: `${num(e.asistentes)} asistieron de ${num(e.inscritos)} inscritos`,
    })), [conDatos])

  async function exportar(formato: 'excel' | 'pdf') {
    if (!datos) return
    setErrorPlan(null)
    setExportando(formato)
    try {
      await api('registrar_exportacion', { formato })
      const filtros = [
        desde && `desde ${desde}`, hasta && `hasta ${hasta}`, modalidad && MODALIDAD[modalidad],
        evento && datos.eventos[0]?.nombre,
      ].filter(Boolean).join(' · ') || 'Todos los eventos'
      if (formato === 'pdf') await pdfReporte('Reporte de participación', filtros, datos.totales, datos.eventos, datos.generado_en)
      else await excel(datos)
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'PLAN') setErrorPlan(e.message)
      else notas.error(e)
    } finally {
      setExportando(null)
    }
  }

  const t = datos?.totales

  return (
    <div>
      <EncabezadoPagina
        titulo="Reportes de participación"
        descripcion="Inscritos, asistentes y pagos confirmados de tus eventos publicados."
        acciones={<>
          <Boton icono={<FileXls className="size-[18px]" />} cargando={exportando === 'excel'} onClick={() => exportar('excel')}>Excel</Boton>
          <Boton icono={<FilePdf className="size-[18px]" />} cargando={exportando === 'pdf'} onClick={() => exportar('pdf')}>PDF</Boton>
        </>}
      />

      <Panel className="mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_2fr_auto] lg:items-end">
        <Campo etiqueta="Desde" htmlFor="desde"><Entrada id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
        <Campo etiqueta="Hasta" htmlFor="hasta"><Entrada id="hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
        <Campo etiqueta="Modalidad" htmlFor="mod">
          <Selector id="mod" value={modalidad} onChange={(e) => setModalidad(e.target.value)}>
            <option value="">Todas</option><option value="presencial">Presencial</option><option value="virtual">Virtual</option><option value="mixta">Mixta</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Evento" htmlFor="ev">
          <Selector id="ev" value={evento} onChange={(e) => setEvento(e.target.value)}>
            <option value="">Todos los eventos</option>
            {(todos?.eventos ?? []).map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
          </Selector>
        </Campo>
        <Boton variante="fantasma" className="h-11" onClick={() => { setDesde(''); setHasta(''); setModalidad(''); setEvento('') }}>Limpiar</Boton>
      </Panel>

      {errorPlan && <Aviso tipo="alerta" titulo="Exportación fuera de tu plan" className="mb-5">{errorPlan}</Aviso>}
      {error && <Aviso tipo="error" className="mb-5">{error.message}</Aviso>}

      {cargando && !datos ? <CargandoLista /> : !datos || datos.eventos.length === 0 ? (
        <Panel><Vacio icono={<ChartBar className="size-6" />} titulo="No hay eventos con estos filtros">Cambia las fechas o la modalidad, o publica un evento.</Vacio></Panel>
      ) : (
        <div className="space-y-6">
          <Panel>
            <div className="flex items-center justify-between border-b border-linea px-5 py-3">
              <p className="text-sm font-medium">Resumen</p>
              <span className="inline-flex items-center gap-1.5 text-xs text-tinta-3" title={modo === 'supabase' ? 'Supabase Realtime' : 'Consulta en vivo de PGlite'}>
                <span key={vivo} className="estampa size-2 rounded-full bg-chilca-viva" aria-hidden />
                En vivo · {hora(datos.generado_en)} h
              </span>
            </div>
            <dl className="grid grid-cols-2 divide-linea sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
              <Dato t="Inscritos" v={num(t!.inscritos)} d={t!.pendientes_pago ? `${t!.pendientes_pago} con pago pendiente` : undefined} />
              <Dato t="Asistentes" v={num(t!.asistentes)} />
              <Dato t="Asistencia" v={`${Number(t!.porcentaje_asistencia).toLocaleString('es-PE')} %`} />
              <Dato t="Ingresos confirmados" v={soles(Number(t!.ingresos))} />
              <Dato t="Certificados válidos" v={num(t!.certificados)} />
              <Dato t="En lista de espera" v={num(t!.en_espera)} />
            </dl>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel className="p-5">
              <h2 className="text-[15px] font-semibold">Porcentaje de asistencia por evento</h2>
              <p className="mb-5 mt-0.5 text-[13px] text-tinta-3">Inscritos confirmados que registraron al menos una jornada. Solo eventos en curso o terminados.</p>
              {asistencia.length ? <BarrasH filas={asistencia} maximo={100} titulo="Porcentaje de asistencia por evento" />
                : <p className="text-sm text-tinta-3">Aún no hay eventos en curso o terminados con inscritos.</p>}
            </Panel>
            <Panel className="p-5">
              <h2 className="text-[15px] font-semibold">Ingresos por medio de pago</h2>
              <p className="mb-5 mt-0.5 text-[13px] text-tinta-3">Solo pagos confirmados.</p>
              {datos.por_metodo.length ? (
                <BarrasH color="bg-anil-viva" titulo="Ingresos por medio de pago" filas={datos.por_metodo.map((m) => ({
                  clave: m.metodo, etiqueta: METODO[m.metodo], valor: Number(m.monto), rotulo: soles(Number(m.monto)),
                  detalle: `${m.operaciones} ${m.operaciones === 1 ? 'operación' : 'operaciones'}`,
                }))} />
              ) : <p className="text-sm text-tinta-3">Los eventos filtrados no tienen pagos confirmados.</p>}
            </Panel>
          </div>

          <section aria-labelledby="tabla">
            <h2 id="tabla" className="mb-3 text-[17px] font-semibold">Detalle por evento</h2>
            <div className="overflow-x-auto rounded-xl border border-linea bg-superficie">
              <table className="w-full min-w-[920px] text-sm">
                <thead className="border-b border-linea bg-fondo/60 text-left text-[13px] text-tinta-3">
                  <tr>
                    {['Evento', 'Fecha', 'Modalidad'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}
                    {['Cupo', 'Inscritos', 'Asistentes', 'Asistencia', 'Ingresos', 'Espera', 'Certif.', 'Satisf.'].map((h) => <th key={h} className="px-4 py-2.5 text-right font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-linea">
                  {datos.eventos.map((e) => (
                    <tr key={e.id} className="hover:bg-fondo/50">
                      <td className="max-w-[280px] px-4 py-3"><Link to={`/organizador/eventos/${e.id}`} className="font-medium no-underline hover:text-grana-tinta">{e.nombre}</Link></td>
                      <td className="whitespace-nowrap px-4 py-3 text-tinta-2">{fechaCorta(e.fecha_inicio)}</td>
                      <td className="px-4 py-3 text-tinta-2">{MODALIDAD[e.modalidad]}</td>
                      <td className="px-4 py-3 text-right">{num(e.cupo_maximo)}</td>
                      <td className="px-4 py-3 text-right">{num(e.inscritos)}</td>
                      <td className="px-4 py-3 text-right">{num(e.asistentes)}</td>
                      <td className="px-4 py-3 text-right">{Number(e.porcentaje_asistencia).toLocaleString('es-PE')} %</td>
                      <td className="px-4 py-3 text-right">{soles(Number(e.ingresos))}</td>
                      <td className="px-4 py-3 text-right">{num(e.en_espera)}</td>
                      <td className="px-4 py-3 text-right">{num(e.certificados)}</td>
                      <td className="px-4 py-3 text-right">{e.satisfaccion != null ? Number(e.satisfaccion).toFixed(1).replace('.', ',') : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

function Dato({ t, v, d }: { t: string; v: string; d?: string }) {
  return (
    <div className="px-5 py-4">
      <dt className="text-xs text-tinta-3">{t}</dt>
      <dd className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.03em]">{v}</dd>
      {d && <dd className="mt-0.5 text-xs text-qolle-tinta">{d}</dd>}
    </div>
  )
}

async function excel(r: Reporte) {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  const encabezado = ['Evento', 'Fecha', 'Modalidad', 'Cupo', 'Inscritos', 'Pago pendiente', 'Asistentes', '% asistencia', 'Ingresos (S/)', 'En espera', 'Certificados', 'Satisfacción']
    .map((value) => ({ value, fontWeight: 'bold' as const }))
  const filas = r.eventos.map((e) => [
    { value: e.nombre }, { value: new Date(e.fecha_inicio), type: Date, format: 'dd/mm/yyyy' }, { value: MODALIDAD[e.modalidad] },
    { value: e.cupo_maximo }, { value: e.inscritos }, { value: e.pendientes_pago }, { value: e.asistentes },
    { value: Number(e.porcentaje_asistencia) }, { value: Number(e.ingresos), format: '#,##0.00' }, { value: e.en_espera },
    { value: e.certificados }, e.satisfaccion != null ? { value: Number(e.satisfaccion) } : null,
  ])
  const total = [
    { value: 'Total', fontWeight: 'bold' as const }, null, null, null, { value: r.totales.inscritos }, { value: r.totales.pendientes_pago },
    { value: r.totales.asistentes }, { value: Number(r.totales.porcentaje_asistencia) }, { value: Number(r.totales.ingresos), format: '#,##0.00' },
    { value: r.totales.en_espera }, { value: r.totales.certificados }, null,
  ]
  await writeXlsxFile([encabezado, ...filas, total] as any, {
    sheet: 'Participación',
    columns: [{ width: 52 }, { width: 12 }, { width: 12 }, ...Array(9).fill({ width: 13 })],
  }).toFile(`reporte-participacion-${r.generado_en.slice(0, 10)}.xlsx`)
}
