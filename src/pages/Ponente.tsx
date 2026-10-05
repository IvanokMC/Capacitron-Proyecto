import { Link } from 'react-router-dom'
import { Microphone } from '@phosphor-icons/react'
import { useCarga } from '../lib/app'
import type { Evento } from '../lib/tipos'
import { MODALIDAD, rangoEvento } from '../lib/formato'
import { InsigniaFase } from '../components/tejido'
import { CargandoLista, EncabezadoPagina, Panel, Vacio } from '../components/ui'
import { EnlaceVirtual } from './organizador/gestion/EnlaceVirtual'

export default function Ponente() {
  const { datos, cargando, recargar } = useCarga<(Evento & { enlace_virtual: string | null })[]>('eventos_ponente')

  return (
    <div>
      <EncabezadoPagina titulo="Mis charlas" descripcion="Eventos donde figuras como ponente. En los virtuales o mixtos puedes registrar el enlace de la sala." />
      {cargando && !datos ? <CargandoLista /> : !datos?.length ? (
        <Panel><Vacio icono={<Microphone className="size-6" />} titulo="Aún no figuras en ningún evento">
          Cuando un organizador te agregue como ponente con este mismo correo, el evento aparecerá aquí.
        </Vacio></Panel>
      ) : (
        <div className="space-y-6">
          {datos.map((e) => (
            <section key={e.id} aria-labelledby={`ev-${e.id}`} className="space-y-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <InsigniaFase fase={e.fase} />
                  <span className="text-[13px] text-tinta-3">{MODALIDAD[e.modalidad]} · {e.institucion?.nombre}</span>
                </div>
                <h2 id={`ev-${e.id}`} className="mt-1 text-lg font-semibold">
                  <Link to={`/eventos/${e.id}`} className="no-underline hover:text-grana-tinta">{e.nombre}</Link>
                </h2>
                <p className="text-sm text-tinta-3 first-letter:uppercase">{rangoEvento(e.fecha_inicio, e.fecha_fin)}</p>
              </div>
              {e.modalidad !== 'presencial'
                ? <EnlaceVirtual e={e} recargar={recargar} />
                : <p className="text-sm text-tinta-3">Evento presencial{e.lugar ? ` en ${e.lugar}` : ''}: no necesita enlace.</p>}
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
