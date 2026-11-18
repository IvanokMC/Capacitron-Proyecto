// Contacto del organizador en la página del evento (CAP-78 · José, Frontend · HU-02 CA-06 y CA-08).
//
// Teoría de Diseño de Software:
// · Encapsulación (diap. 20–24): la pantalla no decide si el contacto es público; muestra lo que
//   entrega la API. Sin consentimiento, el correo o teléfono ni siquiera llega al navegador.
// · SRP (diap. 39–49): este componente solo se ocupa del contacto; la página del evento lo incluye
//   sin conocer el formulario ni sus validaciones.
// · Bajo acoplamiento (diap. 29–35): habla con la API por `api('contactar_organizador')`, sin saber
//   si detrás está Supabase o la base local.
import { useState } from 'react'
import { ChatCircleText, EnvelopeSimple, Phone } from '@phosphor-icons/react'
import { useApp } from '../lib/app'
import { ErrorApi } from '../lib/backend'
import type { Evento } from '../lib/tipos'
import { AreaTexto, Boton, Campo, Dialogo, Entrada, Panel } from './ui'
import { useNotas } from './notificaciones'

const esCorreo = (c: string) => c.includes('@')
const CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

export function ContactoOrganizador({ e }: { e: Pick<Evento, 'id' | 'organizador' | 'organizador_nombre' | 'contacto_publico' | 'contacto'> }) {
  const [abierto, setAbierto] = useState(false)
  const quien = e.organizador_nombre ?? e.organizador

  return (
    <Panel className="p-5">
      <h2 className="text-[13px] font-medium text-tinta-3">Contacto del organizador</h2>
      <p className="mt-1 text-[15px] font-medium">{quien}</p>
      {e.contacto_publico && e.contacto ? (
        // CA-06: el organizador autorizó mostrar su contacto.
        <a href={esCorreo(e.contacto) ? `mailto:${e.contacto}` : `tel:${e.contacto.replace(/\s+/g, '')}`}
          className="mt-1.5 inline-flex items-center gap-2 break-all text-[14px] font-medium text-anil underline">
          {esCorreo(e.contacto) ? <EnvelopeSimple className="size-4 shrink-0" /> : <Phone className="size-4 shrink-0" />}
          {e.contacto}
        </a>
      ) : (
        // CA-08: sin consentimiento, solo un formulario que le llega por correo.
        <>
          <p className="mt-1 text-[13px] text-tinta-3">El organizador prefirió no publicar su correo ni su teléfono. Puedes escribirle desde aquí.</p>
          <Boton className="mt-3 w-full" icono={<ChatCircleText className="size-4" />} onClick={() => setAbierto(true)}>
            Escribir al organizador
          </Boton>
          <DialogoContacto eventoId={e.id} quien={quien} abierto={abierto} onCerrar={() => setAbierto(false)} />
        </>
      )}
    </Panel>
  )
}

function DialogoContacto({ eventoId, quien, abierto, onCerrar }: { eventoId: string; quien: string; abierto: boolean; onCerrar: () => void }) {
  const { api, usuario } = useApp()
  const notas = useNotas()
  const [f, setF] = useState({ nombre: usuario?.nombre_completo ?? '', correo: usuario?.correo ?? '', mensaje: '' })
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)

  // Misma regla que la API (capa en SQL); aquí solo se avisa antes de enviar.
  function validar() {
    const err: Record<string, string> = {}
    if (!f.nombre.trim()) err.nombre = 'Escribe tu nombre.'
    if (!CORREO.test(f.correo.trim())) err.correo = 'Escribe un correo válido para que te puedan responder.'
    if (f.mensaje.trim().length < 10) err.mensaje = 'Escribe tu consulta (al menos 10 caracteres).'
    return err
  }

  async function enviar() {
    const err = validar()
    setErrores(err)
    if (Object.keys(err).length) return
    setEnviando(true)
    try {
      await api('contactar_organizador', { evento_id: eventoId, nombre: f.nombre.trim(), correo: f.correo.trim(), mensaje: f.mensaje.trim() })
      notas.exito('Mensaje enviado al organizador')
      setF({ ...f, mensaje: '' })
      onCerrar()
    } catch (x) {
      if (x instanceof ErrorApi && x.codigo === 'CAMPOS' && x.campos.length) {
        setErrores(Object.fromEntries(x.campos.map((c) => [c, x.message])))
      } else {
        notas.error(x instanceof ErrorApi ? x : String(x))
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Dialogo abierto={abierto} onCerrar={onCerrar} titulo={`Escribir a ${quien}`}
      descripcion="Tu mensaje le llega por correo. Te responderá al correo que indiques."
      pie={<>
        <Boton onClick={onCerrar}>Cancelar</Boton>
        <Boton variante="primario" cargando={enviando} onClick={enviar}>Enviar mensaje</Boton>
      </>}>
      <div className="space-y-4">
        <Campo etiqueta="Tu nombre" htmlFor="contacto-nombre" error={errores.nombre}>
          <Entrada id="contacto-nombre" value={f.nombre} maxLength={120} invalido={!!errores.nombre}
            onChange={(ev) => setF({ ...f, nombre: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Tu correo" htmlFor="contacto-correo" error={errores.correo}>
          <Entrada id="contacto-correo" type="email" value={f.correo} invalido={!!errores.correo}
            onChange={(ev) => setF({ ...f, correo: ev.target.value })} />
        </Campo>
        <Campo etiqueta="Mensaje" htmlFor="contacto-mensaje" error={errores.mensaje} ayuda="Máximo 1000 caracteres.">
          <AreaTexto id="contacto-mensaje" rows={4} maxLength={1000} value={f.mensaje} invalido={!!errores.mensaje}
            onChange={(ev) => setF({ ...f, mensaje: ev.target.value })} />
        </Campo>
      </div>
    </Dialogo>
  )
}
