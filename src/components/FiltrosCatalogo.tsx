// CAP-81 · Panel de filtros, fichas activas y estado «No se encontraron eventos» (HU-15, CA-03 a CA-05).
// Rol: Diseño UI/UX (Medaly). Diseño en docs/diseno/CAP-81-filtros-catalogo/DISENO.md.
//
// Cohesión (diap. 26–28): las tres piezas de este archivo hablan de lo mismo, filtrar el catálogo.
// Bajo acoplamiento (diap. 29–35): reciben el estado y avisan los cambios por props; no llaman a la API
// ni leen la dirección. Eso lo hace Catalogo.tsx, y la lógica está en lib/filtrosCatalogo.ts.
import { useId } from 'react'
import { CalendarBlank, MagnifyingGlass, MapPin } from '@phosphor-icons/react'
import { Boton, Campo, cx, Entrada, FichaQuitable, Selector, Vacio } from './ui'
import { errorRango, fichasActivas, quitarFicha, type EstadoFiltros } from '../lib/filtrosCatalogo'
import { TIPOS_EVENTO } from '../lib/validacionEvento'
import { num } from '../lib/formato'

const MODALIDADES = [
  { valor: '', texto: 'Todas' },
  { valor: 'presencial', texto: 'Presencial' },
  { valor: 'virtual', texto: 'Virtual' },
  { valor: 'mixta', texto: 'Mixta' },
] as const

interface PropsPanel {
  filtros: EstadoFiltros
  onCambio: (f: EstadoFiltros) => void
}

/**
 * Dos filas: la búsqueda y la modalidad arriba (lo que más se usa) y debajo los filtros finos.
 * Cada control tiene etiqueta visible: un campo de fecha sin etiqueta no dice si es «desde» o «hasta».
 */
export function PanelFiltros({ filtros: f, onCambio }: PropsPanel) {
  const id = useId()
  const cambia = <K extends keyof EstadoFiltros>(k: K, v: EstadoFiltros[K]) => onCambio({ ...f, [k]: v })
  const rango = errorRango(f)

  return (
    <div role="search" className="mb-4 rounded-xl border border-linea bg-superficie p-3 sm:p-4" aria-label="Buscar y filtrar eventos">
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-tinta-3" />
          <Entrada
            type="search"
            aria-label="Buscar eventos"
            placeholder="Buscar por tema u organizador"
            value={f.q}
            onChange={(e) => cambia('q', e.target.value)}
            className="pl-10"
          />
        </div>
        <div role="radiogroup" aria-label="Modalidad" className="flex self-start rounded-lg bg-hundido p-1 md:self-auto">
          {MODALIDADES.map((m) => (
            <button
              key={m.valor}
              type="button"
              role="radio"
              aria-checked={f.modalidad === m.valor}
              onClick={() => cambia('modalidad', m.valor)}
              className={cx('h-9 rounded-md px-3 text-[13px] font-medium transition-colors',
                f.modalidad === m.valor ? 'bg-superficie text-tinta shadow-panel' : 'text-tinta-3 hover:text-tinta')}
            >
              {m.texto}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-linea pt-3 lg:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.4fr)]">
        <Campo etiqueta="Tipo" htmlFor={`${id}-tipo`}>
          <Selector id={`${id}-tipo`} value={f.tipo} onChange={(e) => cambia('tipo', e.target.value as EstadoFiltros['tipo'])}>
            <option value="">Todos</option>
            {TIPOS_EVENTO.map((t) => <option key={t.valor} value={t.valor}>{t.etiqueta}</option>)}
          </Selector>
        </Campo>
        <Campo etiqueta="Precio" htmlFor={`${id}-precio`}>
          <Selector id={`${id}-precio`} value={f.precio} onChange={(e) => cambia('precio', e.target.value as EstadoFiltros['precio'])}>
            <option value="">Cualquiera</option>
            <option value="gratis">Gratis</option>
            <option value="pago">De pago</option>
          </Selector>
        </Campo>
        <Campo etiqueta="Desde" htmlFor={`${id}-desde`}>
          <Entrada id={`${id}-desde`} type="date" value={f.desde} max={f.hasta || undefined}
            onChange={(e) => cambia('desde', e.target.value)} />
        </Campo>
        <Campo etiqueta="Hasta" htmlFor={`${id}-hasta`} error={rango}>
          <Entrada id={`${id}-hasta`} type="date" value={f.hasta} min={f.desde || undefined} invalido={!!rango}
            onChange={(e) => cambia('hasta', e.target.value)} />
        </Campo>
        <Campo etiqueta="Ubicación" htmlFor={`${id}-lugar`} className="col-span-2 lg:col-span-1">
          <div className="relative">
            <MapPin className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-tinta-3" />
            <Entrada id={`${id}-lugar`} type="search" placeholder="Auditorio, pabellón o ciudad" value={f.ubicacion}
              onChange={(e) => cambia('ubicacion', e.target.value)} className="pl-10" />
          </div>
        </Campo>
      </div>

      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[13px] text-tinta-2">
        <input type="checkbox" className="size-4 accent-grana" checked={f.pasados} onChange={(e) => cambia('pasados', e.target.checked)} />
        Incluir finalizados
      </label>
    </div>
  )
}

/**
 * Cuántos eventos hay y qué filtros están puestos, cada uno quitable. El total se anuncia con
 * aria-live para que quien usa lector de pantalla sepa que la lista cambió sin tener que buscarla.
 */
export function BarraFiltros({ filtros, total, onCambio, onLimpiar }: PropsPanel & { total: number | null; onLimpiar: () => void }) {
  const fichas = fichasActivas(filtros)
  return (
    <div className="mb-6 flex min-h-8 flex-wrap items-center gap-2">
      <p className="num mr-1 text-[13px] text-tinta-3" aria-live="polite">
        {total === null ? '' : total === 1 ? '1 evento' : `${num(total)} eventos`}
      </p>
      {fichas.map((fi) => (
        <FichaQuitable key={fi.clave} etiqueta={fi.texto} onQuitar={() => onCambio(quitarFicha(filtros, fi.clave))}>
          {fi.texto}
        </FichaQuitable>
      ))}
      {fichas.length > 1 && (
        <Boton variante="fantasma" tamano="sm" onClick={onLimpiar}>Limpiar filtros</Boton>
      )}
    </div>
  )
}

/**
 * CA-04: con filtros y sin coincidencias se dice «No se encontraron eventos» y se ofrece limpiar.
 * Si los finalizados están ocultos, se ofrece verlos: suele ser la razón de una búsqueda vacía.
 * Sin filtros, el catálogo vacío es otra situación y tiene otro mensaje.
 */
export function SinResultados({ hayFiltros, pasados, onLimpiar, onVerFinalizados }: {
  hayFiltros: boolean; pasados: boolean; onLimpiar: () => void; onVerFinalizados: () => void
}) {
  return (
    <div className="rounded-xl border border-dashed border-linea-fuerte bg-superficie">
      {hayFiltros ? (
        <Vacio
          icono={<MagnifyingGlass className="size-6" />}
          titulo="No se encontraron eventos"
          accion={
            <div className="flex flex-wrap justify-center gap-2">
              <Boton variante="primario" onClick={onLimpiar}>Limpiar filtros</Boton>
              {!pasados && <Boton onClick={onVerFinalizados}>Ver también finalizados</Boton>}
            </div>
          }
        >
          Ningún evento publicado cumple todos los filtros a la vez. Prueba con otra palabra o quita alguno.
        </Vacio>
      ) : (
        <Vacio icono={<CalendarBlank className="size-6" />} titulo="Todavía no hay eventos publicados">
          Cuando una institución publique un evento, aparecerá aquí.
        </Vacio>
      )}
    </div>
  )
}
