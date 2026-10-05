import { useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { CheckCircle, Lock } from '@phosphor-icons/react'
import { useApp, useCarga } from '../lib/app'
import type { Evento } from '../lib/tipos'
import { fechaHora } from '../lib/formato'
import { Aviso, AreaTexto, Boton, BotonEnlace, CargandoLista, cx, Panel, Vacio } from '../components/ui'
import { useNotas } from '../components/notificaciones'

interface DatosEncuesta {
  es_organizador?: boolean
  disponible?: boolean
  mensaje?: string
  evento: Evento
  anonima: boolean
  preguntas: string[]
  cierra_en: string | null
  cerrada: boolean
  ya_respondio: boolean
}

const ESCALA = ['Muy mal', 'Mal', 'Regular', 'Bien', 'Excelente']

export default function Encuesta() {
  const { id } = useParams()
  const { api } = useApp()
  const notas = useNotas()
  const { datos, error, cargando, recargar } = useCarga<DatosEncuesta>('obtener_encuesta', { evento_id: id })
  const [puntajes, setPuntajes] = useState<(number | null)[]>([])
  const [comentario, setComentario] = useState('')
  const [faltan, setFaltan] = useState(false)
  const [enviando, setEnviando] = useState(false)

  if (cargando && !datos) return <CargandoLista filas={3} />
  if (error) return <Vacio titulo="Encuesta no disponible" accion={<BotonEnlace to="/mis-inscripciones">Mis inscripciones</BotonEnlace>}>{error.message}</Vacio>
  if (!datos) return null
  if (datos.es_organizador) return <Navigate to={`/organizador/eventos/${id}?pestana=encuesta`} replace />

  const e = datos.evento
  if (!datos.disponible) return <Vacio titulo="La encuesta aún no está abierta">{datos.mensaje}</Vacio>

  async function enviar() {
    const valores = datos!.preguntas.map((_, i) => puntajes[i] ?? null)
    if (valores.some((v) => v == null)) {
      setFaltan(true)
      return
    }
    setEnviando(true)
    try {
      await api('responder_encuesta', { evento_id: id, puntajes: valores, comentario: comentario.trim() || null })
      notas.exito('¡Gracias por tu opinión!')
      recargar()
    } catch (err) {
      notas.error(err)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto max-w-[680px]">
      <h1 className="text-[26px] font-semibold leading-tight">¿Qué te pareció?</h1>
      <p className="mt-1.5 text-[15px] text-tinta-3">{e.nombre}</p>

      {datos.ya_respondio ? (
        <Panel className="estampa mt-6 flex gap-3 p-5">
          <CheckCircle weight="fill" className="size-7 shrink-0 text-chilca" />
          <div><p className="font-semibold">Ya respondiste esta encuesta</p><p className="text-sm text-tinta-3">Tu opinión ayuda a mejorar las próximas ediciones.</p></div>
        </Panel>
      ) : datos.cerrada ? (
        <Panel className="mt-6 flex gap-3 p-5">
          <Lock className="size-7 shrink-0 text-tinta-3" />
          <div><p className="font-semibold">La encuesta cerró</p><p className="text-sm text-tinta-3">Estuvo abierta hasta el {fechaHora(datos.cierra_en!)}.</p></div>
        </Panel>
      ) : (
        <>
          <p className="mt-3 text-sm text-tinta-3">
            {datos.anonima ? 'Es anónima: el organizador verá los resultados sin saber quién respondió.' : 'El organizador verá tu nombre junto a tus respuestas.'}
            {' '}Cierra el {fechaHora(datos.cierra_en!)}.
          </p>
          <ol className="mt-6 space-y-3">
            {datos.preguntas.map((p, i) => {
              const sinResponder = faltan && puntajes[i] == null
              return (
                <li key={i}>
                  <Panel className={cx('p-4 sm:p-5', sinResponder && 'border-error')}>
                    <fieldset>
                      <legend className="text-[15px] font-medium"><span className="num mr-1.5 text-tinta-3">{i + 1}.</span>{p}</legend>
                      <div role="radiogroup" className="mt-3 grid grid-cols-5 gap-1.5">
                        {ESCALA.map((t, k) => {
                          const v = k + 1
                          const sel = puntajes[i] === v
                          return (
                            <label key={v} className={cx('pulsable flex cursor-pointer flex-col items-center gap-0.5 rounded-lg border py-2.5 text-center transition-colors',
                              sel ? 'border-grana bg-grana text-white' : 'border-linea-fuerte hover:border-tinta-3')}>
                              <input type="radio" name={`p${i}`} value={v} checked={sel} className="sr-only"
                                onChange={() => setPuntajes((x) => { const n = [...x]; n[i] = v; return n })} />
                              <span className="num text-lg font-semibold">{v}</span>
                              <span className={cx('hidden text-[11px] sm:block', sel ? 'text-white/85' : 'text-tinta-3')}>{t}</span>
                            </label>
                          )
                        })}
                      </div>
                    </fieldset>
                  </Panel>
                </li>
              )
            })}
          </ol>
          <div className="mt-5">
            <label htmlFor="comentario" className="text-[13px] font-medium text-tinta-2">Comentario <span className="font-normal text-tinta-3">(opcional)</span></label>
            <AreaTexto id="comentario" className="mt-1.5" maxLength={1000} value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder="¿Qué mejorarías para la próxima edición?" />
            <p className="num mt-1 text-right text-xs text-tinta-3">{comentario.length}/1000</p>
          </div>
          {faltan && datos.preguntas.some((_, i) => puntajes[i] == null) && (
            <Aviso tipo="error" className="mt-3">Califica todas las preguntas del 1 al 5 para enviar.</Aviso>
          )}
          <Boton variante="primario" tamano="lg" className="mt-5 w-full sm:w-auto" cargando={enviando} onClick={enviar}>Enviar respuestas</Boton>
        </>
      )}
    </div>
  )
}
