// Pasarela simulada (HU-04 del Sprint 1): Yape, Plin y PayPal de mentira, SOLO para el modo demostración.
// CAP-90 (José, Frontend · HU-16): se sacó de MisInscripciones.tsx sin cambiar lo que hace. El pago real (QR de Yape,
// transferencia o WhatsApp con verificación de la administración) está en pages/PagarInscripcion.tsx.
//
// Teoría de Diseño de Software:
// · SRP (diap. 39–49): el pago deja de vivir dentro de la lista de inscripciones; la demostración queda aparte.
// · Adapter (diap. 126–132): si más adelante se integra una pasarela externa, este es el punto que se reemplaza
//   (la API respuesta_pasarela ya responde solo en modo demostración).
import { useEffect, useState } from 'react'
import { CheckCircle, DeviceMobile, DownloadSimple, Hourglass, PaypalLogo, XCircle } from '@phosphor-icons/react'
import { useApp } from '../lib/app'
import type { MetodoPago, MiInscripcion, Pago } from '../lib/tipos'
import { hora, METODO, relativo, soles } from '../lib/formato'
import { pdfComprobante } from '../lib/pdf'
import { Boton, Campo, cx, Dialogo, Entrada } from './ui'
import { useNotas } from './notificaciones'

type Resultado = 'aprobado' | 'rechazado' | 'sin_respuesta'

export function PasarelaSimulada({ i, onCerrar }: { i: MiInscripcion; onCerrar: () => void }) {
  const { api, ahora, latir } = useApp()
  const notas = useNotas()
  const [metodo, setMetodo] = useState<MetodoPago>('yape')
  const [celular, setCelular] = useState('')
  const [codigo, setCodigo] = useState('')
  const [cuenta, setCuenta] = useState('')
  const [simular, setSimular] = useState<Resultado>('aprobado')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [procesando, setProcesando] = useState(false)
  const [final, setFinal] = useState<{ ok: boolean; mensaje?: string; pago?: Pago } | null>(null)
  const [, setTic] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => setTic((n) => n + 1), 15_000)
    return () => window.clearInterval(id)
  }, [])

  function validar() {
    const e: Record<string, string> = {}
    if (metodo === 'paypal') {
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cuenta)) e.cuenta = 'Escribe el correo de tu cuenta PayPal.'
    } else {
      if (!/^9\d{8}$/.test(celular)) e.celular = 'El celular debe tener 9 dígitos y empezar con 9.'
      if (!/^\d{6}$/.test(codigo)) e.codigo = `Escribe el código de aprobación de 6 dígitos que muestra ${METODO[metodo]}.`
    }
    return e
  }

  async function pagar() {
    const e = validar()
    setErrores(e)
    if (Object.keys(e).length) return
    setProcesando(true)
    try {
      const { pago } = await api<{ pago: Pago }>('iniciar_pago', { inscripcion_id: i.id, metodo })
      // La plataforma tarda un momento en responder.
      await new Promise((r) => setTimeout(r, simular === 'sin_respuesta' ? 1600 : 900))
      const r = await api<{ ok: boolean; mensaje?: string; pago?: Pago }>('respuesta_pasarela', { pago_id: pago.id, resultado: simular })
      setFinal(r)
      if (r.ok) { notas.exito('Pago confirmado'); latir() }
    } catch (err) {
      notas.error(err)
    } finally {
      setProcesando(false)
    }
  }

  const vence = i.reserva_expira_en

  return (
    <Dialogo abierto onCerrar={onCerrar} titulo="Pagar inscripción" descripcion={i.evento.nombre} ancho="max-w-md"
      pie={final?.ok ? (
        <>
          <Boton icono={<DownloadSimple className="size-4" />} onClick={async () => pdfComprobante(await api('comprobante_pago', { pago_id: final.pago!.id }))}>
            Descargar comprobante
          </Boton>
          <Boton variante="primario" onClick={onCerrar}>Listo</Boton>
        </>
      ) : final ? (
        <>
          <Boton onClick={onCerrar}>Pagar después</Boton>
          <Boton variante="primario" onClick={() => setFinal(null)}>Reintentar</Boton>
        </>
      ) : (
        <>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton variante="primario" cargando={procesando} onClick={pagar}>Pagar {soles(i.monto)}</Boton>
        </>
      )}>
      {final ? (
        final.ok ? (
          <div className="estampa flex flex-col items-center py-4 text-center">
            <CheckCircle weight="fill" className="size-14 text-chilca" />
            <p className="mt-3 text-lg font-semibold">Pago confirmado</p>
            <p className="mt-1 text-sm text-tinta-3">Comprobante <span className="font-mono text-tinta">{final.pago?.numero_comprobante}</span>. También te lo enviamos por correo.</p>
          </div>
        ) : (
          <div className="estampa flex flex-col items-center py-4 text-center">
            <XCircle weight="fill" className="size-14 text-error" />
            <p className="mt-3 text-lg font-semibold">El pago no se completó</p>
            <p className="mt-1 text-sm text-tinta-2">{final.mensaje}</p>
          </div>
        )
      ) : (
        <div className="space-y-5">
          <div className="flex items-baseline justify-between rounded-lg bg-fondo px-4 py-3">
            <span className="text-sm text-tinta-3">Total</span>
            <span className="num text-2xl font-semibold">{soles(i.monto)}</span>
          </div>
          {vence && (
            <p className="flex items-center gap-2 text-[13px] text-qolle-tinta">
              <Hourglass weight="bold" className="size-4" />Tu cupo está reservado hasta las {hora(vence)} h ({relativo(vence, ahora())}).
            </p>
          )}
          <fieldset>
            <legend className="mb-2 text-[13px] font-medium text-tinta-2">Medio de pago</legend>
            <div className="grid grid-cols-3 gap-2">
              {(['yape', 'plin', 'paypal'] as MetodoPago[]).map((m) => (
                <label key={m} className={cx('flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border px-2 py-3 text-sm font-medium transition-colors',
                  metodo === m ? 'border-grana bg-grana-clara/50 text-tinta' : 'border-linea-fuerte text-tinta-2 hover:border-tinta-3')}>
                  <input type="radio" className="sr-only" name="metodo" checked={metodo === m} onChange={() => { setMetodo(m); setErrores({}) }} />
                  {m === 'paypal' ? <PaypalLogo className="size-6" /> : <DeviceMobile className="size-6" />}
                  {METODO[m]}
                </label>
              ))}
            </div>
          </fieldset>
          {metodo === 'paypal' ? (
            <Campo etiqueta="Cuenta PayPal" htmlFor="cuenta" error={errores.cuenta}>
              <Entrada id="cuenta" type="email" value={cuenta} onChange={(e) => setCuenta(e.target.value)} invalido={!!errores.cuenta} placeholder="tu@correo.com" />
            </Campo>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta={`Celular ${METODO[metodo]}`} htmlFor="cel" error={errores.celular}>
                <Entrada id="cel" inputMode="numeric" maxLength={9} value={celular} onChange={(e) => setCelular(e.target.value.replace(/\D/g, ''))} invalido={!!errores.celular} placeholder="9XXXXXXXX" />
              </Campo>
              <Campo etiqueta="Código de aprobación" htmlFor="cod" error={errores.codigo}>
                <Entrada id="cod" inputMode="numeric" maxLength={6} value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))} invalido={!!errores.codigo} className="font-mono tracking-[0.3em]" />
              </Campo>
            </div>
          )}
          <div className="rounded-lg border border-dashed border-linea-fuerte p-3">
            <p className="text-[13px] font-medium text-tinta-2">Simulador de pasarela (demo)</p>
            <p className="mt-0.5 text-xs text-tinta-3">Elige qué responderá la plataforma de pago. No se guarda ningún dato del medio de pago.</p>
            <div role="radiogroup" className="mt-2 flex flex-wrap gap-1.5">
              {([['aprobado', 'Aprobar'], ['rechazado', 'Rechazar'], ['sin_respuesta', 'No responder']] as [Resultado, string][]).map(([v, t]) => (
                <button key={v} type="button" role="radio" aria-checked={simular === v} onClick={() => setSimular(v)}
                  className={cx('h-8 rounded-md px-3 text-[13px] font-medium transition-colors',
                    simular === v ? 'bg-tinta text-white' : 'bg-hundido text-tinta-2 hover:text-tinta')}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Dialogo>
  )
}
