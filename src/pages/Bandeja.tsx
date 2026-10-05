import { useApp, useCarga } from '../lib/app'
import type { Correo } from '../lib/tipos'
import { Buzon } from '../components/Buzon'
import { Boton, CargandoLista, EncabezadoPagina } from '../components/ui'

export default function Bandeja() {
  const { api, refrescarBandeja, modo } = useApp()
  const { datos, cargando, setDatos } = useCarga<{ no_leidos: number; correos: Correo[] }>('mis_correos')

  async function marcar(id?: string) {
    await api('marcar_correo_leido', id ? { id } : { todos: true })
    setDatos((d) => d && { no_leidos: id ? Math.max(d.no_leidos - 1, 0) : 0,
      correos: d.correos.map((c) => (!id || c.id === id ? { ...c, leido: true } : c)) })
    refrescarBandeja()
  }

  return (
    <div>
      <EncabezadoPagina titulo="Bandeja de correo"
        descripcion={modo === 'local'
          ? 'Correos que CAPACITRON te envió: confirmaciones, pagos, recordatorios, certificados y encuestas. En esta versión los correos son simulados.'
          : 'Correos que CAPACITRON te envió: confirmaciones, pagos, recordatorios, certificados y encuestas.'}
        acciones={datos && datos.no_leidos > 0 ? <Boton onClick={() => marcar()}>Marcar todo como leído</Boton> : undefined} />
      {cargando && !datos ? <CargandoLista /> : <Buzon correos={datos?.correos ?? []} onAbrir={(c) => marcar(c.id)} />}
    </div>
  )
}
