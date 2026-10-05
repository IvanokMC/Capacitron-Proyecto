import { useEffect, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { useApp, useCarga } from '../../../lib/app'
import { ErrorApi } from '../../../lib/backend'
import { fechaHora, num } from '../../../lib/formato'
import { Distribucion, LeyendaEscala } from '../../../components/graficos'
import { Aviso, Boton, Entrada, Interruptor, Panel, Vacio } from '../../../components/ui'
import { useNotas } from '../../../components/notificaciones'
import type { Gestion } from '../GestionEvento'

interface Config {
  plan_permite: boolean
  configurada: boolean
  anonima: boolean
  preguntas: string[]
  enviada_en: string | null
  cierra_en: string | null
}

interface Resultados {
  enviada: boolean
  anonima: boolean
  cerrada: boolean
  cierra_en: string
  invitados: number
  total_respuestas: number
  preguntas: { texto: string; promedio: number | null; distribucion: number[] }[]
  comentarios: { texto: string; creado_en: string; autor: string | null }[]
}

export function EncuestaGestion({ e }: { e: Gestion }) {
  const { datos: cfg, recargar } = useCarga<Config>('obtener_encuesta', { evento_id: e.id })
  const { datos: res } = useCarga<Resultados>('resultados_encuesta', { evento_id: e.id })
  if (!cfg || !res) return null
  if (!cfg.plan_permite) {
    return <Aviso tipo="alerta" titulo="Función fuera de tu plan">El plan {e.plan.nombre} no incluye encuestas de satisfacción. Mejora al plan Pro para habilitarlas.</Aviso>
  }
  return res.enviada ? <ResultadosEncuesta r={res} /> : <ConfigEncuesta e={e} cfg={cfg} onListo={recargar} />
}

function ConfigEncuesta({ e, cfg, onListo }: { e: Gestion; cfg: Config; onListo: () => void }) {
  const { api } = useApp()
  const notas = useNotas()
  const [preguntas, setPreguntas] = useState<string[]>(cfg.preguntas)
  const [anonima, setAnonima] = useState(cfg.anonima)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { setPreguntas(cfg.preguntas); setAnonima(cfg.anonima) }, [cfg])

  async function guardar() {
    setError(null)
    setGuardando(true)
    try {
      await api('guardar_encuesta', { evento_id: e.id, anonima, preguntas })
      notas.exito('Encuesta guardada')
      onListo()
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : String(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel className="p-5 sm:p-6">
        <h2 className="text-[17px] font-semibold">Preguntas</h2>
        <p className="mt-1 text-sm text-tinta-3">Hasta 10 preguntas con escala del 1 al 5; los asistentes también pueden dejar un comentario.</p>
        <ol className="mt-4 space-y-2">
          {preguntas.map((p, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="num w-6 shrink-0 text-right text-sm text-tinta-3">{i + 1}.</span>
              <Entrada aria-label={`Pregunta ${i + 1}`} value={p} maxLength={200}
                onChange={(ev) => setPreguntas((x) => x.map((q, k) => (k === i ? ev.target.value : q)))} />
              <Boton variante="fantasma" aria-label={`Quitar pregunta ${i + 1}`} disabled={preguntas.length === 1}
                icono={<Trash className="size-4" />} onClick={() => setPreguntas((x) => x.filter((_, k) => k !== i))} />
            </li>
          ))}
        </ol>
        <Boton tamano="sm" className="mt-3" icono={<Plus className="size-4" weight="bold" />} disabled={preguntas.length >= 10}
          onClick={() => setPreguntas((x) => [...x, ''])}>
          {preguntas.length >= 10 ? 'Máximo 10 preguntas' : 'Agregar pregunta'}
        </Boton>
      </Panel>
      <div className="space-y-4">
        <Panel className="p-5">
          <Interruptor activo={anonima} onChange={setAnonima} etiqueta="Respuestas anónimas"
            descripcion="Verás los resultados sin saber quién respondió cada cosa." />
        </Panel>
        <Aviso tipo="info">
          Se envía sola por correo a quienes registraron asistencia cuando termine el evento ({fechaHora(e.fecha_fin)}) y cierra 7 días después.
          {!cfg.configurada && ' Si no la guardas, se usarán estas preguntas predeterminadas.'}
        </Aviso>
        {error && <Aviso tipo="error">{error}</Aviso>}
        <Boton variante="primario" className="w-full" cargando={guardando} onClick={guardar}>Guardar encuesta</Boton>
      </div>
    </div>
  )
}

function ResultadosEncuesta({ r }: { r: Resultados }) {
  const general = r.preguntas.filter((p) => p.promedio != null)
  const promedio = general.length ? general.reduce((s, p) => s + Number(p.promedio), 0) / general.length : null
  return (
    <div className="space-y-6">
      <Panel className="grid grid-cols-2 divide-linea sm:grid-cols-4 sm:divide-x">
        <Dato v={promedio != null ? promedio.toFixed(2).replace('.', ',') : '—'} t="Promedio general (1 a 5)" />
        <Dato v={num(r.total_respuestas)} t="Respuestas" />
        <Dato v={r.invitados ? `${Math.round((100 * r.total_respuestas) / r.invitados)} %` : '—'} t={`Tasa de respuesta (${r.invitados} invitados)`} />
        <Dato v={r.cerrada ? 'Cerrada' : 'Abierta'} t={r.cerrada ? `Cerró el ${fechaHora(r.cierra_en)}` : `Cierra el ${fechaHora(r.cierra_en)}`} />
      </Panel>

      <Panel className="p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[17px] font-semibold">Resultados por pregunta</h2>
          <LeyendaEscala />
        </div>
        {r.total_respuestas === 0 ? <p className="text-sm text-tinta-3">Todavía no hay respuestas.</p> : (
          <ol className="space-y-5">
            {r.preguntas.map((p, i) => (
              <li key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(200px,320px)_56px] sm:items-center sm:gap-5">
                <p className="text-sm text-tinta-2"><span className="num mr-1 text-tinta-3">{i + 1}.</span>{p.texto}</p>
                <Distribucion conteos={p.distribucion} etiqueta={p.texto} />
                <p className="num text-right text-[17px] font-semibold">{p.promedio != null ? Number(p.promedio).toFixed(1).replace('.', ',') : '—'}</p>
              </li>
            ))}
          </ol>
        )}
      </Panel>

      <section aria-labelledby="coment">
        <h2 id="coment" className="mb-3 text-[17px] font-semibold">Comentarios {r.anonima && <span className="text-sm font-normal text-tinta-3">· anónimos</span>}</h2>
        {r.comentarios.length === 0 ? <Panel><Vacio titulo="Sin comentarios" /></Panel> : (
          <ul className="divide-y divide-linea rounded-xl border border-linea bg-superficie">
            {r.comentarios.map((c, i) => (
              <li key={i} className="px-5 py-4">
                <p className="max-w-[70ch] text-[15px] leading-relaxed">{c.texto}</p>
                <p className="mt-1 text-xs text-tinta-3">{c.autor ?? 'Anónimo'} · {fechaHora(c.creado_en)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Dato({ v, t }: { v: string; t: string }) {
  return (
    <div className="px-5 py-4">
      <p className="text-[26px] font-semibold leading-none tracking-[-0.03em]">{v}</p>
      <p className="mt-1.5 text-xs text-tinta-3">{t}</p>
    </div>
  )
}
