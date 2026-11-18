import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarBlank, MapPin, Plus, VideoCamera, Buildings } from '@phosphor-icons/react'
import { useApp, useCarga } from '../lib/app'
import type { Evento } from '../lib/tipos'
import { hora, MODALIDAD, num, precio, rangoEvento, claveDia } from '../lib/formato'
import { BandaCupos, BloqueFecha, InsigniaFase } from '../components/tejido'
import { Aviso, BotonEnlace, CargandoLista, cx, Insignia } from '../components/ui'
import { BarraFiltros, PanelFiltros, SinResultados } from '../components/FiltrosCatalogo'
import { FILTROS_VACIOS, fichasActivas, filtrosAUrl, filtrosDesdeUrl, paramsCatalogo, useRetraso, type EstadoFiltros } from '../lib/filtrosCatalogo'
import { etiquetaTipo, textoOrganiza } from '../lib/validacionEvento'

export function Catalogo() {
  const { usuario } = useApp()
  // CAP-81 (Medaly): los filtros salen de la dirección y vuelven a ella (CA-05: no se guardan en
  // otro lado). Al volver del detalle de un evento, el catálogo sigue filtrado igual.
  const [sp, setSp] = useSearchParams()
  const [filtros, setFiltros] = useState<EstadoFiltros>(() => filtrosDesdeUrl(sp))
  // Solo lo que se escribe espera a que la persona termine; los selectores consultan de inmediato.
  const q = useRetraso(filtros.q)
  const ubicacion = useRetraso(filtros.ubicacion)
  const consulta = useMemo(() => ({ ...filtros, q, ubicacion }), [filtros, q, ubicacion])

  const escrita = useRef(sp.toString())
  useEffect(() => {
    const nueva = filtrosAUrl(consulta).toString()
    escrita.current = nueva
    if (nueva !== sp.toString()) setSp(nueva, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consulta])
  // Si la dirección cambia desde afuera (el enlace «Eventos» del menú, o atrás en el navegador),
  // el panel se pone al día con ella en vez de pisarla.
  useEffect(() => {
    if (sp.toString() !== escrita.current) {
      escrita.current = sp.toString()
      setFiltros(filtrosDesdeUrl(sp))
    }
  }, [sp])

  const { datos, cargando, error } = useCarga<Evento[]>('catalogo_eventos', { ...paramsCatalogo(consulta) })

  const grupos = useMemo(() => {
    const ev = datos ?? []
    return [
      { id: 'en_curso', titulo: 'En curso ahora', eventos: ev.filter((e) => e.fase === 'en_curso') },
      { id: 'proximo', titulo: 'Próximos', eventos: ev.filter((e) => e.fase === 'proximo') },
      { id: 'finalizado', titulo: 'Finalizados', eventos: ev.filter((e) => e.fase === 'finalizado') },
    ].filter((g) => g.eventos.length > 0)
  }, [datos])

  const hayFiltros = fichasActivas(consulta).length > 0
  const limpiar = () => setFiltros(FILTROS_VACIOS)

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

      <PanelFiltros filtros={filtros} onCambio={setFiltros} />
      <BarraFiltros filtros={filtros} onCambio={setFiltros} onLimpiar={limpiar}
        total={cargando && !datos ? null : (datos?.length ?? 0)} />

      {error && <Aviso tipo="error" titulo="No pudimos cargar los eventos">{error.message}</Aviso>}

      {cargando && !datos ? (
        <CargandoLista filas={5} />
      ) : grupos.length === 0 ? (
        <SinResultados hayFiltros={hayFiltros} pasados={filtros.pasados} onLimpiar={limpiar}
          onVerFinalizados={() => setFiltros({ ...filtros, pasados: true })} />
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
            {/* CAP-78 (José): tipo del evento en la tarjeta (HU-02 CA-06) */}
            {etiquetaTipo(e.tipo) && <Insignia tinte="anil" punto={false}>{etiquetaTipo(e.tipo)}</Insignia>}
          </div>
          <h3 className="mt-0.5 text-[17px] font-semibold leading-snug">
            <Link to={`/eventos/${e.id}`} className="no-underline after:absolute after:inset-0 group-hover:text-grana-tinta">
              {e.nombre}
            </Link>
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-tinta-3">
            <Buildings className="size-4 shrink-0" />
            <span className="truncate">{textoOrganiza(e)}</span>
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
