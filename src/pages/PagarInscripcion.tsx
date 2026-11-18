// Pantalla de pago real de una inscripción (CAP-90 · José, Frontend · HU-16 CA-01 a CA-04).
// Diseño de Medaly (CAP-88, components/PagoReal.tsx); API de Carlos (CAP-89).
//
// Teoría de Diseño de Software:
// · SRP (diap. 39–49): el pago tiene su pantalla propia (/mis-inscripciones/:id/pagar); ya no vive dentro de la lista.
// · Strategy y OCP (diap. 117–125 y 50–63): un panel por medio en PANELES. Sumar Plin sería una entrada en
//   MEDIOS_PAGO (CAP-88) y otra aquí; el resto de la pantalla no cambia.
// · DIP (diap. 92–106): la pantalla llama a la API (useApp) y al módulo de almacenamiento, no a Supabase.
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, DownloadSimple, Flask } from '@phosphor-icons/react'
import { useApp, useCarga } from '../lib/app'
import { ErrorApi } from '../lib/backend'
import { almacenamiento, ErrorAlmacenamiento, REGLAS, useUrlArchivo } from '../lib/almacenamiento'
import { imagenVisible, useImagenElegida } from '../lib/imagenElegida'
import {
  configParaPantalla, enlacePago, esDireccion, estadoPagoManual, mensajePago, registrarPagoManual,
} from '../lib/pagoManual'
import type { MediosPago, MiInscripcion } from '../lib/tipos'
import { hora, soles } from '../lib/formato'
import { pdfComprobante } from '../lib/pdf'
import {
  EstadoPago, FormComprobante, PanelTransferencia, PanelWhatsapp, PanelYape, SelectorMedioPago, TEXTOS_PAGO,
  type ConfigPagos, type Medio,
} from '../components/PagoReal'
import { PasarelaSimulada } from '../components/PasarelaSimulada'
import { Aviso, Boton, BotonEnlace, CargandoLista, Panel, Vacio } from '../components/ui'
import { useNotas } from '../components/notificaciones'

/** Lo que necesita cada panel para dibujarse. */
interface ContextoPanel { config: ConfigPagos; monto: number; enlace: string | null; mensaje: string; copiar: (v: string) => void }

/** Strategy: un panel por medio de pago. Una prueba comprueba que cada medio de MEDIOS_PAGO tenga el suyo. */
export const PANELES: Record<Medio, (c: ContextoPanel) => ReactNode> = {
  yape: (c) => <PanelYape config={c.config} monto={c.monto} />,
  transferencia: (c) => <PanelTransferencia config={c.config} monto={c.monto} onCopiar={c.copiar} />,
  whatsapp: (c) => <PanelWhatsapp config={c.config} enlace={c.enlace} mensaje={c.mensaje} />,
}

/** Dirección del QR de Yape: ruta en el bucket «fotos» o dirección completa (ver lib/pagoManual.ts). */
function useUrlQr(valor: string | null | undefined): string | null {
  const ruta = valor && !esDireccion(valor) ? valor : null
  const url = useUrlArchivo('fotos', ruta)
  return valor && esDireccion(valor) ? valor : url
}

export default function PagarInscripcion() {
  const { id } = useParams()
  const { datos, cargando, recargar } = useCarga<{ inscripciones: MiInscripcion[] }>('mis_inscripciones')
  const medios = useCarga<MediosPago>('medios_pago')
  const urlQr = useUrlQr(medios.datos?.config.yape_qr)
  const i = datos?.inscripciones.find((x) => x.id === id)

  if ((cargando && !datos) || (medios.cargando && !medios.datos)) return <CargandoLista filas={2} />
  return (
    <div className="mx-auto max-w-[560px]">
      <Link to="/mis-inscripciones" className="mb-4 inline-flex items-center gap-1.5 text-sm text-tinta-3 no-underline hover:text-tinta">
        <ArrowLeft className="size-4" /> Mis inscripciones
      </Link>
      {!i || (i.estado !== 'pendiente_pago' && i.estado !== 'confirmada') ? (
        <Panel>
          <Vacio titulo="Esta inscripción no tiene un pago pendiente" accion={<BotonEnlace to="/mis-inscripciones">Volver</BotonEnlace>}>
            Puede que la reserva haya vencido o que la inscripción se haya cancelado.
          </Vacio>
        </Panel>
      ) : (
        <ContenidoPago i={i} medios={medios.datos} urlQr={urlQr} onCambio={recargar} />
      )}
    </div>
  )
}

function ContenidoPago({ i, medios, urlQr, onCambio }: { i: MiInscripcion; medios: MediosPago | null; urlQr: string | null; onCambio: () => void }) {
  const { api, usuario, sistema, latir } = useApp()
  const notas = useNotas()
  const disponibles = medios?.disponibles ?? []
  const [medio, setMedio] = useState<Medio>(disponibles[0] ?? 'yape')
  const [operacion, setOperacion] = useState('')
  const [errorOperacion, setErrorOperacion] = useState<string | null>(null)
  const captura = useImagenElegida(REGLAS.comprobantes)
  const [enviando, setEnviando] = useState(false)
  const [reenviar, setReenviar] = useState(false)
  const [simulador, setSimulador] = useState(false)
  useEffect(() => { if (disponibles.length && !disponibles.includes(medio)) setMedio(disponibles[0]) }, [disponibles, medio])

  const manual = estadoPagoManual(i)
  const config = configParaPantalla(medios, urlQr)
  const mensaje = mensajePago(usuario?.nombre_completo ?? '', i.evento.nombre, i.monto)

  async function enviar() {
    setErrorOperacion(null)
    setEnviando(true)
    try {
      const r = await registrarPagoManual(api, await almacenamiento(), i.id, medio, operacion, captura.estado)
      if ('errores' in r) {
        setErrorOperacion(r.errores.operacion ?? null)
        if (r.errores.captura) captura.fallo(r.errores.captura)
        return
      }
      notas.exito('Comprobante enviado. La administración lo revisará.')
      captura.guardada()
      setOperacion('')
      setReenviar(false)
      latir()
      onCambio()
    } catch (err) {
      if (err instanceof ErrorApi && err.campos.includes('numero_operacion')) setErrorOperacion(err.message)
      else if (err instanceof ErrorApi && err.campos.includes('comprobante')) captura.fallo(err.message)
      else if (err instanceof ErrorAlmacenamiento && err.codigo === 'ARCHIVO') captura.fallo(err.message)
      else notas.error(err)
    } finally {
      setEnviando(false)
    }
  }

  async function descargar() {
    try { await pdfComprobante(await api('comprobante_pago', { pago_id: manual!.pago.id })) } catch (e) { notas.error(e) }
  }

  // CA-03: aprobado. Si se confirmó con la pasarela de la demostración, no hay pago manual que mostrar.
  if (i.estado === 'confirmada') {
    return (
      <EstadoPago estado="aprobado" operacion={manual?.pago.numero_operacion}
        accion={manual && <Boton icono={<DownloadSimple className="size-4" />} onClick={descargar}>Descargar comprobante</Boton>} />
    )
  }
  // CA-02: por verificar, el cupo sigue reservado.
  if (manual?.estado === 'por_verificar') return <EstadoPago estado="por_verificar" operacion={manual.pago.numero_operacion} />

  return (
    <div className="space-y-5">
      {/* CA-04: rechazado con el motivo; puede volver a enviar mientras dure la reserva. */}
      {manual?.estado === 'rechazado' && !reenviar && (
        <EstadoPago estado="rechazado" operacion={manual.pago.numero_operacion} motivo={manual.pago.motivo_rechazo}
          accion={<Boton variante="primario" onClick={() => setReenviar(true)}>{TEXTOS_PAGO.reenviar}</Boton>} />
      )}
      {(!manual || reenviar) && (
        <>
          <Panel className="space-y-4 p-5">
            <div>
              <h1 className="text-[22px] font-semibold">{TEXTOS_PAGO.titulo}</h1>
              <p className="mt-1 text-[14px] text-tinta-3">{i.evento.nombre}</p>
            </div>
            <div className="flex items-baseline justify-between rounded-lg bg-fondo px-4 py-3">
              <span className="text-sm text-tinta-3">Total</span>
              <span className="num text-2xl font-semibold">{soles(i.monto)}</span>
            </div>
            {i.reserva_expira_en && <p className="text-[13px] font-medium text-qolle-tinta">{TEXTOS_PAGO.reserva(`${hora(i.reserva_expira_en)} h`)}</p>}
            <p className="text-[14px] text-tinta-2">{TEXTOS_PAGO.ayudaMedio}</p>
            {disponibles.length === 0 ? (
              <Aviso tipo="alerta">{TEXTOS_PAGO.sinConfig}</Aviso>
            ) : (
              <>
                <SelectorMedioPago elegido={medio} onElegir={setMedio} />
                {PANELES[medio]({
                  config, monto: i.monto, mensaje, enlace: enlacePago(medios?.config.whatsapp, mensaje),
                  copiar: (v) => navigator.clipboard?.writeText(v).then(() => notas.exito('Copiado'), () => notas.error('No se pudo copiar.')),
                })}
              </>
            )}
          </Panel>
          {disponibles.length > 0 && (
            <Panel className="p-5">
              <h2 className="mb-3 text-[15px] font-semibold">Registra tu pago</h2>
              <FormComprobante operacion={operacion} onOperacion={(v) => { setOperacion(v); setErrorOperacion(null) }}
                vista={imagenVisible(captura.estado, null)} onElegir={captura.elegir} onQuitar={captura.quitar}
                errorOperacion={errorOperacion} errorArchivo={captura.estado.error} enviando={enviando} onEnviar={enviar} />
            </Panel>
          )}
        </>
      )}
      {/* La pasarela simulada solo existe en el modo demostración (la API también lo exige). */}
      {sistema?.modo_demo && (
        <div className="rounded-lg border border-dashed border-linea-fuerte p-4 text-[13px] text-tinta-3">
          <p className="flex items-center gap-2 font-medium text-tinta-2"><Flask className="size-4" />Modo demostración</p>
          <p className="mt-1">Puedes confirmar el pago al instante con la pasarela simulada, sin verificación.</p>
          <Boton tamano="sm" className="mt-2" onClick={() => setSimulador(true)}>Usar la pasarela simulada</Boton>
        </div>
      )}
      {simulador && <PasarelaSimulada i={i} onCerrar={() => { setSimulador(false); onCambio() }} />}
    </div>
  )
}

