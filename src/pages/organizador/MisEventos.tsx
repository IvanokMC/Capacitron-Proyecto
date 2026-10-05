import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, PencilSimple } from '@phosphor-icons/react'
import { useApp, useCarga } from '../../lib/app'
import type { EventoOrganizador } from '../../lib/tipos'
import { hora, MODALIDAD, num, precio, soles } from '../../lib/formato'
import { BandaCupos, BloqueFecha, InsigniaFase } from '../../components/tejido'
import { BotonEnlace, CargandoLista, EncabezadoPagina, Panel, Pestanas, Vacio } from '../../components/ui'

type Filtro = 'activos' | 'borradores' | 'finalizados' | 'cancelados'

export default function MisEventos() {
  const { usuario } = useApp()
  const { datos, cargando } = useCarga<EventoOrganizador[]>('eventos_organizador')
  const [filtro, setFiltro] = useState<Filtro>('activos')
  const plan = usuario?.institucion?.plan

  const grupos = useMemo(() => {
    const ev = datos ?? []
    return {
      activos: ev.filter((e) => e.fase === 'proximo' || e.fase === 'en_curso').reverse(),
      borradores: ev.filter((e) => e.fase === 'borrador'),
      finalizados: ev.filter((e) => e.fase === 'finalizado'),
      cancelados: ev.filter((e) => e.fase === 'cancelado'),
    }
  }, [datos])

  const lista = grupos[filtro]

  return (
    <div>
      <EncabezadoPagina
        titulo="Mis eventos"
        descripcion={usuario?.institucion ? `${usuario.institucion.nombre} · plan ${plan?.nombre}` : undefined}
        acciones={<BotonEnlace to="/organizador/eventos/nuevo" variante="primario" icono={<CalendarPlus className="size-[18px]" />}>Crear evento</BotonEnlace>}
      />

      {plan && (
        <p className="mb-5 text-[13px] text-tinta-3">
          Tu plan permite {plan.max_eventos_activos ? `${plan.max_eventos_activos} eventos publicados a la vez` : 'eventos publicados sin límite'}
          {plan.max_cupo_evento ? `, hasta ${num(plan.max_cupo_evento)} cupos por evento` : ', sin límite de cupos'}
          {plan.permite_pagos ? ', cobros en línea' : ', solo eventos gratuitos'}
          {plan.permite_virtual ? ' y eventos virtuales.' : ' y solo modalidad presencial.'}
        </p>
      )}

      <Pestanas etiqueta="Estado" valor={filtro} onCambio={setFiltro} opciones={[
        { valor: 'activos', texto: 'Publicados', cuenta: grupos.activos.length },
        { valor: 'borradores', texto: 'Borradores', cuenta: grupos.borradores.length },
        { valor: 'finalizados', texto: 'Finalizados', cuenta: grupos.finalizados.length },
        { valor: 'cancelados', texto: 'Cancelados', cuenta: grupos.cancelados.length },
      ]} />

      <div className="mt-5">
        {cargando && !datos ? <CargandoLista /> : lista.length === 0 ? (
          <Panel>
            <Vacio icono={<CalendarPlus className="size-6" />} titulo="No hay eventos en esta lista"
              accion={filtro !== 'cancelados' ? <BotonEnlace to="/organizador/eventos/nuevo">Crear evento</BotonEnlace> : undefined}>
              {filtro === 'borradores' ? 'Guarda un evento como borrador para terminarlo después.' : 'Los eventos aparecerán aquí según su estado.'}
            </Vacio>
          </Panel>
        ) : (
          <ul className="divide-y divide-linea overflow-hidden rounded-xl border border-linea bg-superficie">
            {lista.map((e) => (
              <li key={e.id} className="group relative hover:bg-fondo/70">
                <div className="grid gap-x-5 gap-y-3 p-4 sm:p-5 md:grid-cols-[auto_minmax(0,1fr)_minmax(220px,280px)_auto]">
                  <BloqueFecha fecha={e.fecha_inicio} fase={e.fase} />
                  <div className="min-w-0">
                    <InsigniaFase fase={e.fase} />
                    <h2 className="mt-1 text-[17px] font-semibold leading-snug">
                      <Link to={`/organizador/eventos/${e.id}`} className="no-underline after:absolute after:inset-0 group-hover:text-grana-tinta">{e.nombre}</Link>
                    </h2>
                    <p className="mt-1 text-[13px] text-tinta-3">
                      {hora(e.fecha_inicio)} h · {MODALIDAD[e.modalidad]} · {precio(e.costo)}
                    </p>
                  </div>
                  <div className="flex flex-col justify-center gap-2">
                    <div className="num flex justify-between text-[13px] text-tinta-2">
                      <span><b className="font-semibold text-tinta">{num(e.inscritos)}</b> inscritos{e.pendientes_pago > 0 && ` · ${e.pendientes_pago} por pagar`}</span>
                      <span className="text-tinta-3">de {num(e.cupo_maximo)}</span>
                    </div>
                    <BandaCupos total={e.cupo_maximo} confirmados={e.inscritos} pendientes={e.pendientes_pago}
                      ofrecidos={Math.max(e.cupos_ocupados - e.inscritos - e.pendientes_pago, 0)} compacta />
                    <p className="num text-xs text-tinta-3">
                      {e.asistentes > 0 && `${num(e.asistentes)} asistieron · `}{e.costo > 0 ? `${soles(e.ingresos)} recaudado` : 'Gratuito'}
                      {e.en_espera > 0 && ` · ${e.en_espera} en espera`}
                    </p>
                  </div>
                  <div className="relative z-10 flex items-center">
                    {(e.fase === 'borrador' || e.fase === 'proximo') && (
                      <BotonEnlace to={`/organizador/eventos/${e.id}/editar`} tamano="sm" variante="fantasma" icono={<PencilSimple className="size-4" />}>Editar</BotonEnlace>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
