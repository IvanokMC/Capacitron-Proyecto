import { useEffect, useState, type FormEvent } from 'react'
import { useApp } from '../lib/app'
import { ErrorApi } from '../lib/backend'
import { ROL } from '../lib/formato'
import { Boton, Campo, EncabezadoPagina, Entrada, Interruptor, Panel } from '../components/ui'
import { useNotas } from '../components/notificaciones'

export default function Perfil() {
  const { usuario, api, refrescarUsuario } = useApp()
  const notas = useNotas()
  const [nombres, setNombres] = useState(usuario?.nombres ?? '')
  const [apellidos, setApellidos] = useState(usuario?.apellidos ?? '')
  const [recordatorios, setRecordatorios] = useState(usuario?.recordatorios_activos ?? true)
  const [errores, setErrores] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!usuario) return
    setNombres(usuario.nombres)
    setApellidos(usuario.apellidos)
    setRecordatorios(usuario.recordatorios_activos)
  }, [usuario])

  if (!usuario) return null

  async function guardar(e: FormEvent) {
    e.preventDefault()
    setGuardando(true)
    try {
      await api('actualizar_perfil', { nombres, apellidos, recordatorios_activos: recordatorios })
      await refrescarUsuario()
      setErrores([])
      notas.exito('Perfil actualizado')
    } catch (err) {
      if (err instanceof ErrorApi) setErrores(err.campos)
      notas.error(err)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <EncabezadoPagina titulo="Mi perfil" descripcion={`${ROL[usuario.rol]}${usuario.institucion ? ` · ${usuario.institucion.nombre}` : ''}`} />
      <form onSubmit={guardar}>
        <Panel className="space-y-5 p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombres" htmlFor="n" error={errores.includes('nombres') && 'Escribe tus nombres.'}>
              <Entrada id="n" value={nombres} onChange={(e) => setNombres(e.target.value)} invalido={errores.includes('nombres')} />
            </Campo>
            <Campo etiqueta="Apellidos" htmlFor="a" error={errores.includes('apellidos') && 'Escribe tus apellidos.'}>
              <Entrada id="a" value={apellidos} onChange={(e) => setApellidos(e.target.value)} invalido={errores.includes('apellidos')} />
            </Campo>
          </div>
          <Campo etiqueta="Correo" htmlFor="c" ayuda="El correo identifica tu cuenta y no se puede cambiar.">
            <Entrada id="c" value={usuario.correo} disabled />
          </Campo>
          <div className="border-t border-linea pt-5">
            <Interruptor activo={recordatorios} onChange={setRecordatorios} etiqueta="Recordatorios de eventos"
              descripcion="Te escribimos 24 horas y 1 hora antes de cada evento confirmado, con la hora y el lugar o el enlace de la sala." />
          </div>
        </Panel>
        <div className="mt-4 flex justify-end">
          <Boton type="submit" variante="primario" cargando={guardando}>Guardar cambios</Boton>
        </div>
      </form>
    </div>
  )
}
