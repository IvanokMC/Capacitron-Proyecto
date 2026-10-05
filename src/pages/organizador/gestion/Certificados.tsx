import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Certificate } from '@phosphor-icons/react'
import { useApp, useCarga } from '../../../lib/app'
import { fechaCorta, fechaHora } from '../../../lib/formato'
import { AreaTexto, Aviso, Boton, Campo, Dialogo, Insignia, Panel, Vacio } from '../../../components/ui'
import { useNotas } from '../../../components/notificaciones'
import type { Gestion } from '../GestionEvento'

interface Participante {
  inscripcion_id: string
  nombre: string
  correo: string
  porcentaje: number
  certificado: { id: string; codigo: string; estado: 'valido' | 'revocado'; emitido_en: string; revocado_en: string | null; motivo_revocacion: string | null } | null
}

export function Certificados({ e }: { e: Gestion }) {
  const { api } = useApp()
  const notas = useNotas()
  const { datos, recargar } = useCarga<{ emitidos_en: string | null; participantes: Participante[] }>('certificados_evento', { evento_id: e.id })
  const [revocar, setRevocar] = useState<Participante | null>(null)
  const [motivo, setMotivo] = useState('')
  const [errMotivo, setErrMotivo] = useState(false)
  const [enviando, setEnviando] = useState(false)

  if (!datos) return null
  const emitidos = datos.participantes.filter((p) => p.certificado)
  const validos = emitidos.filter((p) => p.certificado!.estado === 'valido').length

  return (
    <div className="space-y-5">
      {!datos.emitidos_en ? (
        <Aviso tipo="info" titulo="Los certificados se emiten al terminar el evento">
          Al cierre ({fechaHora(e.fecha_fin)}), cada persona que haya asistido al menos al {e.porcentaje_minimo} % de las jornadas recibirá su certificado en PDF con un código y un QR de verificación.
        </Aviso>
      ) : (
        <p className="text-sm text-tinta-2">
          Emitidos el {fechaCorta(datos.emitidos_en)}: <b className="num">{validos}</b> válidos{emitidos.length - validos > 0 && <>, <b className="num">{emitidos.length - validos}</b> revocados</>}.
          Asistencia mínima exigida: {e.porcentaje_minimo} %.
        </p>
      )}

      {datos.participantes.length === 0 ? (
        <Panel><Vacio icono={<Certificate className="size-6" />} titulo="No hay inscritos confirmados" /></Panel>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-linea bg-superficie">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b border-linea bg-fondo/60 text-left text-[13px] text-tinta-3">
              <tr>
                <th className="px-4 py-2.5 font-medium">Participante</th>
                <th className="px-4 py-2.5 text-right font-medium">Asistencia</th>
                <th className="px-4 py-2.5 font-medium">Certificado</th>
                <th className="px-4 py-2.5"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-linea">
              {datos.participantes.map((p) => (
                <tr key={p.inscripcion_id}>
                  <td className="px-4 py-3"><p className="font-medium">{p.nombre}</p><p className="text-[13px] text-tinta-3">{p.correo}</p></td>
                  <td className="num px-4 py-3 text-right">{Number(p.porcentaje).toLocaleString('es-PE')} %</td>
                  <td className="px-4 py-3">
                    {p.certificado ? (
                      <div className="space-y-1">
                        <Insignia tinte={p.certificado.estado === 'valido' ? 'chilca' : 'error'}>{p.certificado.estado === 'valido' ? 'Válido' : 'Revocado'}</Insignia>
                        <p><Link to={`/verificar/${p.certificado.codigo}`} className="font-mono text-[13px] text-anil">{p.certificado.codigo}</Link></p>
                        {p.certificado.motivo_revocacion && <p className="text-[13px] text-tinta-3">Motivo: {p.certificado.motivo_revocacion}</p>}
                      </div>
                    ) : datos.emitidos_en ? (
                      <span className="text-[13px] text-tinta-3">No elegible (menos de {e.porcentaje_minimo} %)</span>
                    ) : <span className="text-[13px] text-tinta-3">Pendiente</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {p.certificado?.estado === 'valido' && (
                      <Boton tamano="sm" variante="peligro" onClick={() => { setRevocar(p); setMotivo(''); setErrMotivo(false) }}>Revocar</Boton>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialogo abierto={!!revocar} onCerrar={() => setRevocar(null)} titulo="Revocar certificado"
        descripcion={revocar ? `${revocar.nombre} · ${revocar.certificado?.codigo}` : undefined}
        pie={<>
          <Boton onClick={() => setRevocar(null)}>Volver</Boton>
          <Boton variante="peligro" cargando={enviando} onClick={async () => {
            if (!motivo.trim()) { setErrMotivo(true); return }
            setEnviando(true)
            try {
              await api('revocar_certificado', { certificado_id: revocar!.certificado!.id, motivo })
              notas.exito('Certificado revocado')
              setRevocar(null)
              recargar()
            } catch (err) { notas.error(err) } finally { setEnviando(false) }
          }}>Revocar certificado</Boton>
        </>}>
        <p className="mb-4 text-sm text-tinta-2">La verificación pública lo mostrará como inválido desde ahora. El motivo queda registrado en el historial y se envía al titular.</p>
        <Campo etiqueta="Motivo" htmlFor="mrev" error={errMotivo && 'Escribe el motivo de la revocación.'}>
          <AreaTexto id="mrev" rows={3} value={motivo} onChange={(ev) => { setMotivo(ev.target.value); setErrMotivo(false) }} invalido={errMotivo} />
        </Campo>
      </Dialogo>
    </div>
  )
}
