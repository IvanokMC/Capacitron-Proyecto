import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarBlank, MagnifyingGlass, MapPin, Plus, VideoCamera, Buildings } from '@phosphor-icons/react'
import { useApp, useCarga } from '../lib/app'
import type { Evento } from '../lib/tipos'
import { hora, MODALIDAD, num, precio, rangoEvento, claveDia } from '../lib/formato'
import { BandaCupos, BloqueFecha, InsigniaFase } from '../components/tejido'
import { Aviso, BotonEnlace, CargandoLista, cx, Entrada, Selector, Vacio, Boton } from '../components/ui'

const MODALIDADES = [
  { valor: '', texto: 'Todas' },
  { valor: 'presencial', texto: 'Presencial' },
  { valor: 'virtual', texto: 'Virtual' },
  { valor: 'mixta', texto: 'Mixta' },
]

export function Catalogo() {
  const { usuario } = useApp()
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [modalidad, setModalidad] = useState('')
  const [precioF, setPrecioF] = useState('')
  const [pasados, setPasados] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setQ(texto.trim()), 250)
    return () => window.clearTimeout(id)
  }, [texto])

  const { datos, cargando, error } = useCarga<Evento[]>('catalogo_eventos', {
    q, modalidad, precio: precioF, incluir_pasados: pasados,
  })

  const grupos = useMemo(() => {
    const ev = datos ?? []
    return [
      { id: 'en_curso', titulo: 'En curso ahora', eventos: ev.filter((e) => e.fase === 'en_curso') },
      { id: 'proximo', titulo: 'Próximos', eventos: ev.filter((e) => e.fase === 'proximo') },
      { id: 'finalizado', titulo: 'Finalizados', eventos: ev.filter((e) => e.fase === 'finalizado') },
    ].filter((g) => g.eventos.length > 0)
  }, [datos])

  const hayFiltros = q || modalidad || precioF

  return (
    <div>
      <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight sm:text-[34px]">Eventos académicos</h1>
          <p className="mt-1.5 max-w-[60ch] text-[15px] text-tinta-3">
            Talleres, cursos y seminarios con inscripción en línea, ingreso con código QR y certificado verificable.
          </p>
        </div>
        {usuario?.rol === 'organizador' && (
          <BotonEnlace to="/organizador/eventos/nuevo" variante="primario" icono={<Plus weight="bold" className="size-4" />}>
            Crear evento
          </BotonEnlace>
        )}
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-linea bg-superficie p-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-tinta-3" />
          <Entrada
            type="search"
            aria-label="Buscar eventos"
            placeholder="Buscar por nombre, tema o institución"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:flex-nowrap">
          <div role="radiogroup" aria-label="Modalidad" className="flex rounded-lg bg-hundido p-1">
            {MODALIDADES.map((m) => (
              <button
                key={m.valor}
                role="radio"
                aria-checked={modalidad === m.valor}
                onClick={() => setModalidad(m.valor)}
                className={cx('h-9 rounded-md px-3 text-[13px] font-medium transition-colors',
                  modalidad === m.valor ? 'bg-superficie text-tinta shadow-panel' : 'text-tinta-3 hover:text-tinta')}
              >
                {m.texto}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-44">
            <Selector aria-label="Precio" value={precioF} onChange={(e) => setPrecioF(e.target.value)}>
              <option value="">Cualquier precio</option>
              <option value="gratis">Gratis</option>
              <option value="pago">De pago</option>
            </Selector>
          </div>
          <label className="flex h-11 cursor-pointer items-center gap-2 whitespace-nowrap px-2 text-[13px] text-tinta-2">
            <input type="checkbox" className="size-4 accent-grana" checked={pasados} onChange={(e) => setPasados(e.target.checked)} />
            Incluir finalizados
          </label>
        </div>
      </div>

      {error && <Aviso tipo="error" titulo="No pudimos cargar los eventos">{error.message}</Aviso>}

      {cargando && !datos ? (
        <CargandoLista filas={5} />
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-linea-fuerte bg-superficie">
          <Vacio
            icono={<CalendarBlank className="size-6" />}
            titulo={hayFiltros ? 'Ningún evento coincide con tu búsqueda' : 'Todavía no hay eventos publicados'}
            accion={hayFiltros ? <Boton onClick={() => { setTexto(''); setModalidad(''); setPrecioF('') }}>Quitar filtros</Boton> : undefined}
          >
            {hayFiltros ? 'Prueba con otra palabra o cambia la modalidad y el precio.' : 'Cuando una institución publique un evento, aparecerá aquí.'}
          </Vacio>
        </div>
      ) : (
        <div className="space-y-9">
          {grupos.map((g) => (
            <section key={g.id} aria-labelledby={`g-${g.id}`}>
              <h2 id={`g-${g.id}`} className="mb-3 flex items-baseline gap-2 text-[17px] font-semibold">
                {g.titulo}
                <span className="num text-sm font-normal text-tinta-3">{g.eventos.length}</span>
              </h2>
              <ul className="divide-y divide-linea overflow-hidden rounded-xl border border-linea bg-superficie">
                {g.eventos.map((e) => <FilaEvento key={e.id} e={e} />)}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

function FilaEvento({ e }: { e: Evento }) {
  const lleno = e.cupos_disponibles === 0
  const pocos = !lleno && e.cupos_disponibles <= Math.max(3, Math.ceil(e.cupo_maximo * 0.1))
  const variosDias = claveDia(e.fecha_inicio) !== claveDia(e.fecha_fin)
  return (
    <li className="group relative transition-colors hover:bg-fondo/70">
      <div className="grid gap-x-5 gap-y-3 p-4 sm:grid-cols-[auto_minmax(0,1fr)_minmax(200px,260px)] sm:p-5">
        <BloqueFecha fecha={e.fecha_inicio} fase={e.fase} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {e.fase === 'en_curso' && <InsigniaFase fase="en_curso" />}
            {e.fase === 'finalizado' && <InsigniaFase fase="finalizado" />}
          </div>
          <h3 className="mt-0.5 text-[17px] font-semibold leading-snug">
            <Link to={`/eventos/${e.id}`} className="no-underline after:absolute after:inset-0 group-hover:text-grana-tinta">
              {e.nombre}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-tinta-3">
            <Buildings className="size-4 shrink-0" />
            <span className="truncate">{e.institucion?.nombre ?? e.organizador}</span>
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-tinta-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarBlank className="size-4 text-tinta-3" />
              {variosDias ? rangoEvento(e.fecha_inicio, e.fecha_fin) : `${hora(e.fecha_inicio)}–${hora(e.fecha_fin)} h`}
            </span>
            <span className="inline-flex min-w-0 items-center gap-1.5">
              {e.modalidad === 'virtual' ? <VideoCamera className="size-4 text-tinta-3" /> : <MapPin className="size-4 text-tinta-3" />}
              <span className="truncate">
                {MODALIDAD[e.modalidad]}
                {e.modalidad !== 'virtual' && e.lugar ? ` · ${e.lugar}` : ''}
              </span>
            </span>
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 sm:items-stretch">
          <div className="flex items-baseline justify-between gap-3">
            <span className={cx('num text-lg font-semibold', e.costo === 0 && 'text-chilca')}>{precio(e.costo)}</span>
            <span className={cx('num text-[13px]', lleno ? 'font-medium text-qolle-tinta' : pocos ? 'font-medium text-qolle-tinta' : 'text-tinta-3')}>
              {e.fase === 'finalizado'
                ? `${num(e.cupos_ocupados)} participantes`
                : lleno
                  ? e.en_espera > 0 ? `Lleno · ${e.en_espera} en espera` : 'Lleno · lista de espera'
                  : `${num(e.cupos_disponibles)} de ${num(e.cupo_maximo)} libres`}
            </span>
          </div>
          <BandaCupos total={e.cupo_maximo} ocupados={e.cupos_ocupados} compacta />
        </div>
      </div>
    </li>
  )
}
