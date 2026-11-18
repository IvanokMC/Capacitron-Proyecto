// Administración → «Pagos»: bandeja de pagos por verificar y configuración de los medios de pago
// (CAP-90 · José, Frontend · HU-16 CA-03, CA-04 y CA-06). Diseño de CAP-88 (Medaly); API de CAP-89 (Carlos).
//
// Teoría de Diseño de Software:
// · SRP (diap. 39–49): la pestaña vive en su propio archivo; Admin.tsx solo la agrega a la lista de pestañas.
// · DIP (diap. 92–106): la bandeja pide la dirección de cada captura al módulo de almacenamiento, no a Supabase.
// · Encapsulación (diap. 20–24): esta pantalla solo pide; quién puede aprobar, rechazar o configurar lo decide la API
//   (solo administración).
import { useEffect, useState } from 'react'
import { useApp, useCarga } from '../../lib/app'
import { ErrorApi } from '../../lib/backend'
import { almacenamiento, REGLAS, subirArchivo, useUrlArchivo } from '../../lib/almacenamiento'
import { imagenVisible, useImagenElegida } from '../../lib/imagenElegida'
import { AVISO_NO_VIGENTE, configParaPantalla, esDireccion, type FilaPorVerificar } from '../../lib/pagoManual'
import type { MediosPago } from '../../lib/tipos'
import { fechaHora } from '../../lib/formato'
import { BandejaPagos, FormConfigPagos, FormRechazo, type ConfigPagos } from '../../components/PagoReal'
import { Boton, CargandoLista, Dialogo, Panel, Pestanas } from '../../components/ui'
import { useNotas } from '../../components/notificaciones'

export function PagosAdmin() {
  const [vista, setVista] = useState<'bandeja' | 'configuracion'>('bandeja')
  return (
    <div className="space-y-5">
      <Pestanas etiqueta="Pagos" valor={vista} onCambio={setVista} opciones={[
        { valor: 'bandeja', texto: 'Por verificar' },
        { valor: 'configuracion', texto: 'Configuración' },
      ]} />
      {vista === 'bandeja' ? <Bandeja /> : <Configuracion />}
    </div>
  )
}

/** Direcciones de las capturas (privadas en Supabase desde CAP-92; en modo local, del almacenamiento del navegador). */
function useUrlsComprobantes(filas: FilaPorVerificar[] | null): Record<string, string | null> {
  const [urls, setUrls] = useState<Record<string, string | null>>({})
  useEffect(() => {
    let vigente = true
    if (!filas?.length) return
    almacenamiento().then(async (alm) => {
      const pares = await Promise.all(filas.map(async (f) => [f.id, f.comprobante ? await alm.url('comprobantes', f.comprobante) : null] as const))
      if (vigente) setUrls(Object.fromEntries(pares))
    }).catch(() => {})
    return () => { vigente = false }
  }, [filas])
  return urls
}

function Bandeja() {
  const { api, latir } = useApp()
  const notas = useNotas()
  const { datos, cargando, recargar } = useCarga<FilaPorVerificar[]>('pagos_por_verificar')
  const urls = useUrlsComprobantes(datos)
  const [procesando, setProcesando] = useState<string | null>(null)
  const [rechazar, setRechazar] = useState<FilaPorVerificar | null>(null)
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null)

  async function aprobar(id: string) {
    setProcesando(id)
    try {
      const r = await api<{ ok: boolean; mensaje?: string }>('aprobar_pago', { pago_id: id })
      if (r.ok) notas.exito('Pago aprobado: la inscripción quedó confirmada.')
      else notas.error(r.mensaje ?? 'No se pudo aprobar el pago.')
      latir()
      recargar()
    } catch (e) {
      notas.error(e)
    } finally {
      setProcesando(null)
    }
  }

  async function confirmarRechazo() {
    if (!rechazar) return
    setProcesando(rechazar.id)
    try {
      await api('rechazar_pago', { pago_id: rechazar.id, motivo })
      notas.exito('Pago rechazado. La persona recibió el motivo por correo.')
      setRechazar(null)
      latir()
      recargar()
    } catch (e) {
      if (e instanceof ErrorApi && e.campos.includes('motivo')) setErrorMotivo(e.message)
      else notas.error(e)
    } finally {
      setProcesando(null)
    }
  }

  if (cargando && !datos) return <CargandoLista filas={3} />
  return (
    <>
      <BandejaPagos procesando={procesando} onAprobar={aprobar}
        onRechazar={(id) => { setRechazar(datos?.find((f) => f.id === id) ?? null); setMotivo(''); setErrorMotivo(null) }}
        // D-02 (CAP-91): un pago de una inscripción cancelada se ve marcado en la misma tarjeta, junto al evento.
        pagos={(datos ?? []).map((f) => ({
          ...f, enviado: fechaHora(f.enviado), comprobante: urls[f.id] ?? null,
          evento: f.inscripcion_vigente === false ? `${f.evento} · ${AVISO_NO_VIGENTE}` : f.evento,
        }))} />
      <Dialogo abierto={!!rechazar} onCerrar={() => setRechazar(null)} titulo="Rechazar pago"
        descripcion={rechazar ? `${rechazar.persona} · ${rechazar.evento}` : undefined}
        pie={(
          <>
            <Boton onClick={() => setRechazar(null)}>Cancelar</Boton>
            <Boton variante="peligro" cargando={procesando === rechazar?.id} onClick={confirmarRechazo}>Rechazar pago</Boton>
          </>
        )}>
        <FormRechazo motivo={motivo} onMotivo={(v) => { setMotivo(v); setErrorMotivo(null) }} error={errorMotivo} />
      </Dialogo>
    </>
  )
}

/** El QR va al bucket público «fotos», en la carpeta de la cuenta de administración (decisión para revisar en CAP-92). */
const REGLAS_QR = { ...REGLAS.fotos, nombre: 'El QR' }

function Configuracion() {
  const { api, usuario } = useApp()
  const notas = useNotas()
  const { datos, cargando, setDatos } = useCarga<MediosPago>('medios_pago')
  const guardado = datos?.config.yape_qr ?? null
  const urlGuardada = useUrlArchivo('fotos', guardado && !esDireccion(guardado) ? guardado : null)
  const qr = useImagenElegida(REGLAS_QR)
  const [config, setConfig] = useState<ConfigPagos | null>(null)
  const [errores, setErrores] = useState<Partial<Record<keyof ConfigPagos, string>>>({})
  const [guardando, setGuardando] = useState(false)
  useEffect(() => { if (datos && !config) setConfig(configParaPantalla(datos, null)) }, [datos, config])

  async function guardar() {
    if (!config || !usuario) return
    setGuardando(true)
    setErrores({})
    try {
      const yape_qr = qr.estado.archivo ? await subirArchivo(await almacenamiento(), 'fotos', usuario.id, qr.estado.archivo)
        : qr.estado.quitar ? null : guardado
      const r = await api<MediosPago>('guardar_config_pagos', { ...config, yape_qr })
      setDatos(r)
      // Se muestra lo que quedó guardado: la API deja solo los dígitos de la cuenta, el CCI y el WhatsApp (CAP-89).
      setConfig(configParaPantalla(r, null))
      qr.guardada()
      notas.exito(r.disponibles.length ? `Guardado. Medios disponibles: ${r.disponibles.length} de 3.` : 'Guardado. Todavía no hay medios disponibles.')
    } catch (e) {
      if (e instanceof ErrorApi && e.campos.length) setErrores(Object.fromEntries(e.campos.map((c) => [c, e.message])))
      notas.error(e)
    } finally {
      setGuardando(false)
    }
  }

  if ((cargando && !datos) || !config) return <CargandoLista filas={2} />
  const vistaQr = imagenVisible(qr.estado, guardado && esDireccion(guardado) ? guardado : urlGuardada)
  return (
    <Panel className="space-y-5 p-5 sm:p-6">
      <FormConfigPagos config={{ ...config, yape_qr: vistaQr }} onCambio={(c) => setConfig({ ...c, yape_qr: config.yape_qr })}
        onElegirQr={qr.elegir} errores={{ ...errores, ...(qr.estado.error ? { yape_qr: qr.estado.error } : {}) }} />
      <div className="flex justify-end">
        <Boton variante="primario" cargando={guardando} onClick={guardar}>Guardar configuración</Boton>
      </div>
    </Panel>
  )
}
