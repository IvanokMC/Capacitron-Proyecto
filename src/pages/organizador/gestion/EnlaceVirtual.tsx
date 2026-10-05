import { useState, type FormEvent } from 'react'
import { VideoCamera } from '@phosphor-icons/react'
import { useApp } from '../../../lib/app'
import { ErrorApi } from '../../../lib/backend'
import { PLATAFORMA } from '../../../lib/formato'
import type { Evento } from '../../../lib/tipos'
import { Aviso, Boton, Campo, Entrada, Panel } from '../../../components/ui'
import { useNotas } from '../../../components/notificaciones'

/** HU-12: lo usan el organizador (gestión del evento) y el ponente (Mis charlas). */
export function EnlaceVirtual({ e, recargar }: { e: Pick<Evento, 'id' | 'fase' | 'estado' | 'enlace_plataforma'> & { enlace_virtual?: string | null }; recargar: () => void }) {
  const { api } = useApp()
  const notas = useNotas()
  const [enlace, setEnlace] = useState(e.enlace_virtual ?? '')
  const [error, setError] = useState<{ texto: string; plan?: boolean } | null>(null)
  const [guardando, setGuardando] = useState(false)
  const cerrado = e.estado === 'cancelado' || e.fase === 'finalizado'

  async function guardar(ev: FormEvent) {
    ev.preventDefault()
    setError(null)
    if (!enlace.trim()) { setError({ texto: 'Pega el enlace de la sala.' }); return }
    setGuardando(true)
    try {
      const r = await api<{ plataforma: string; reemplazado: boolean }>('guardar_enlace_virtual', { evento_id: e.id, enlace: enlace.trim() })
      notas.exito(r.reemplazado ? 'Enlace reemplazado: avisamos a los inscritos confirmados' : `Enlace de ${PLATAFORMA[r.plataforma]} guardado`)
      recargar()
    } catch (err) {
      setError({ texto: err instanceof Error ? err.message : String(err), plan: err instanceof ErrorApi && err.codigo === 'PLAN' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Panel className="max-w-2xl p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-anil-clara text-anil"><VideoCamera className="size-5" /></span>
        <div>
          <h2 className="text-[17px] font-semibold">Sala de videoconferencia</h2>
          <p className="mt-0.5 text-sm text-tinta-3">Solo lo ven los inscritos confirmados, y va incluido en los recordatorios. Si lo reemplazas, enviamos el nuevo por correo.</p>
        </div>
      </div>
      <form onSubmit={guardar} className="mt-5 space-y-3" noValidate>
        <Campo etiqueta="Enlace de Zoom, Google Meet o Microsoft Teams" htmlFor="enlace" error={error && !error.plan ? error.texto : null}
          ayuda={e.enlace_plataforma ? `Plataforma actual: ${PLATAFORMA[e.enlace_plataforma]}` : 'Por ejemplo: https://meet.google.com/abc-defg-hij'}>
          <Entrada id="enlace" type="url" value={enlace} onChange={(ev) => { setEnlace(ev.target.value); setError(null) }}
            invalido={!!error && !error.plan} disabled={cerrado} placeholder="https://" />
        </Campo>
        {error?.plan && <Aviso tipo="alerta" titulo="Función fuera del plan">{error.texto}</Aviso>}
        {cerrado ? <p className="text-sm text-tinta-3">El evento ya no admite cambios de enlace.</p> : (
          <Boton type="submit" variante="primario" cargando={guardando}>{e.enlace_virtual ? 'Reemplazar enlace' : 'Guardar enlace'}</Boton>
        )}
      </form>
    </Panel>
  )
}
