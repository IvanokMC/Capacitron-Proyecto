import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tray } from '@phosphor-icons/react'
import { useCarga } from '../lib/app'
import type { Correo } from '../lib/tipos'
import { Buzon } from '../components/Buzon'
import { Aviso, Boton, CargandoLista, EncabezadoPagina, Entrada } from '../components/ui'

/**
 * Buzón público de demostración: reemplaza al servidor de correo para poder
 * abrir el enlace de confirmación de una cuenta nueva. Solo existe en modo demo.
 */
export default function CorreoDemo() {
  const [params, setParams] = useSearchParams()
  const para = params.get('para') ?? ''
  const [texto, setTexto] = useState(para)
  const { datos, error, cargando } = useCarga<Correo[]>(para ? 'correo_demo' : null, { para })

  function enviar(e: FormEvent) {
    e.preventDefault()
    setParams(texto.trim() ? { para: texto.trim().toLowerCase() } : {})
  }

  return (
    <div>
      <EncabezadoPagina titulo="Buzón de demostración"
        descripcion="Esta versión no envía correos reales. Escribe una dirección para ver los mensajes que CAPACITRON le envió, como el enlace para confirmar una cuenta." />
      <form onSubmit={enviar} className="mb-6 flex max-w-xl gap-2">
        <label htmlFor="para" className="sr-only">Correo</label>
        <Entrada id="para" type="email" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="nombre@correo.com" />
        <Boton type="submit" variante="primario" icono={<Tray className="size-4" />}>Abrir</Boton>
      </form>
      {error && <Aviso tipo="error">{error.message}</Aviso>}
      {para && (cargando && !datos ? <CargandoLista /> : datos && <Buzon correos={datos} />)}
    </div>
  )
}
