// Mi perfil (HU-17 · CAP-95, José): foto, datos de la cuenta y recordatorios.
// Teoría: SRP (diap. 39–49): la lógica de la foto vive en lib/fotoPerfil.ts y la subida en el módulo
// de almacenamiento (CAP-97); esta pantalla solo arma el formulario. DIP (92–106): no importa Supabase.
import { useEffect, useState, type FormEvent } from 'react'
import { useApp } from '../lib/app'
import { ErrorApi } from '../lib/backend'
import { almacenamiento, ErrorAlmacenamiento, useUrlArchivo } from '../lib/almacenamiento'
import { fotoVisible, guardarFoto, useFotoPerfil } from '../lib/fotoPerfil'
import { ROL } from '../lib/formato'
import { Boton, Campo, EncabezadoPagina, Entrada, Interruptor, Panel, SelectorFoto } from '../components/ui'
import { useNotas } from '../components/notificaciones'

const FALLO_SUBIDA = 'No se pudo subir la foto. Revisa tu conexión e inténtalo otra vez.'

export default function Perfil() {
  const { usuario, api, refrescarUsuario } = useApp()
  const notas = useNotas()
  const [nombres, setNombres] = useState(usuario?.nombres ?? '')
  const [apellidos, setApellidos] = useState(usuario?.apellidos ?? '')
  const [recordatorios, setRecordatorios] = useState(usuario?.recordatorios_activos ?? true)
  const [errores, setErrores] = useState<string[]>([])
  const [guardando, setGuardando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const foto = useFotoPerfil()
  const urlGuardada = useUrlArchivo('fotos', usuario?.foto_url)

  useEffect(() => {
    if (!usuario) return
    setNombres(usuario.nombres)
    setApellidos(usuario.apellidos)
    setRecordatorios(usuario.recordatorios_activos)
  }, [usuario])

  if (!usuario) return null

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (!usuario) return
    setGuardando(true)
    try {
      // 1) Sube la foto nueva, si hay. Si falla, no se guarda nada y se mantiene la foto anterior.
      let cambioFoto: { foto_url?: string | null } = {}
      if (foto.estado.archivo) setSubiendo(true)
      try {
        cambioFoto = await guardarFoto(await almacenamiento(), usuario.id, foto.estado)
      } catch (err) {
        foto.fallo(err instanceof ErrorAlmacenamiento && err.codigo === 'ARCHIVO' ? err.message : FALLO_SUBIDA)
        return
      } finally {
        setSubiendo(false)
      }
      // 2) Guarda los datos y la ruta de la foto juntos (CAP-94).
      await api('actualizar_perfil', { nombres, apellidos, recordatorios_activos: recordatorios, ...cambioFoto })
      await refrescarUsuario()
      foto.guardada()
      setErrores([])
      notas.exito('Perfil actualizado')
    } catch (err) {
      if (err instanceof ErrorApi) {
        setErrores(err.campos)
        if (err.campos.includes('foto_url')) foto.fallo(err.message)
      }
      notas.error(err instanceof ErrorApi ? err : String(err))
    } finally {
      setGuardando(false)
    }
  }

  const visible = fotoVisible(foto.estado, urlGuardada)

  return (
    <div className="mx-auto max-w-[640px]">
      <EncabezadoPagina titulo="Mi perfil" descripcion={`${ROL[usuario.rol]}${usuario.institucion ? ` · ${usuario.institucion.nombre}` : ''}`} />
      <form onSubmit={guardar}>
        <Panel className="space-y-5 p-5 sm:p-6">
          {/* CAP-95: foto de perfil con el selector diseñado en CAP-93 (CA-01 a CA-03) */}
          <SelectorFoto
            nombre={usuario.nombre_completo}
            foto={visible}
            vistaPrevia={!!foto.estado.previa}
            cargando={subiendo}
            error={foto.estado.error}
            onElegir={foto.elegir}
            onQuitar={visible ? foto.quitar : undefined}
          />
          {foto.estado.quitar && (
            <p className="-mt-2 text-[13px] text-qolle-tinta">Al guardar se quitará tu foto y se verán tus iniciales.</p>
          )}
          <div className="grid gap-4 border-t border-linea pt-5 sm:grid-cols-2">
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
          {/* CA-04: rol e institución, de solo lectura */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Rol" htmlFor="rol">
              <Entrada id="rol" value={ROL[usuario.rol]} disabled />
            </Campo>
            <Campo etiqueta="Institución" htmlFor="inst">
              <Entrada id="inst" value={usuario.institucion?.nombre ?? 'Sin institución'} disabled />
            </Campo>
          </div>
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
