// CAP-102 · Revisión de datos personales de la HU-18: el celular no sale en ninguna función que no deba.
// Rol: DevOps (George). Teoría: encapsulación (diap. 20–24) e ISP (diap. 80–91): cada función entrega solo lo
// necesario. El único lugar donde aparece el celular de otra persona es evento_gestion, para el organizador de un
// evento en el que esa persona está inscrita y solo si dio su permiso (CAP-99).
// Usa los datos de demostración (cuentas y números de ejemplo).
import { beforeAll, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

const CLAVE = 'Capacitron2026' // contraseña de las cuentas de demostración (datos ficticios)
let bd: Bd
const t: Record<string, string> = {}
let numeros: string[]
let codigoCertificado: string
let eventoDeAna: string
let eventoDeOtro: string

const entra = async (correo: string) => (await bd.rpc('iniciar_sesion', { correo, password: CLAVE })).token as string
const filtra = (x: unknown) => numeros.filter((n) => JSON.stringify(x).includes(n))

beforeAll(async () => {
  bd = await nuevaBd({ demo: true })
  for (const [k, c] of Object.entries({ ana: 'estudiante@capacitron.demo', carmen: 'coordinacion@capacitron.demo',
    jorge: 'capacitacion.iac@capacitron.demo', raul: 'ponente@capacitron.demo', admin: 'admin@capacitron.demo', diego: 'diego.mamani@capacitron.demo' })) {
    t[k] = await entra(c)
  }
  // La persona con un certificado válido también tiene celular y permiso: así se revisa la verificación pública.
  // Se elige siempre la misma (order by) y nunca sofia.chavez, que la primera prueba exige sin celular. Antes, con
  // «limit 1» sin orden, Postgres podía devolverla a ella y la prueba fallaba a veces (diap. 140: pruebas repetibles).
  const [cert] = await bd.sql<{ codigo: string; usuario_id: string }>(`select c.codigo, c.usuario_id from capa.certificados c
    join capa.usuarios u on u.id = c.usuario_id
    where c.estado = 'valido' and u.correo <> 'sofia.chavez@capacitron.demo' order by c.codigo limit 1`)
  codigoCertificado = cert.codigo
  await bd.sql(`update capa.usuarios set celular = '900000199', comparte_celular = true, celular_consentido_en = now() where id = $1 and celular is null`, [cert.usuario_id])
  numeros = (await bd.sql<{ celular: string }>(`select celular from capa.usuarios where celular is not null`)).map((r) => r.celular)
  const [e] = await bd.sql<{ id: string }>(`select i.evento_id as id from capa.inscripciones i join capa.usuarios u on u.id = i.usuario_id
    where u.correo = 'estudiante@capacitron.demo' and i.estado = 'confirmada' limit 1`)
  eventoDeAna = e.id
  const [o] = await bd.sql<{ id: string }>(`select e.id from capa.eventos e join capa.usuarios u on u.id = e.organizador_id
    where u.correo = 'capacitacion.iac@capacitron.demo' limit 1`)
  eventoDeOtro = o.id
})

describe('CAP-102 datos de demostración de la HU-18', () => {
  it('hay cuentas de ejemplo con celular, con y sin permiso, y otras sin celular', async () => {
    const filas = await bd.sql<{ correo: string; celular: string | null; comparte_celular: boolean }>(
      `select correo, celular, comparte_celular from capa.usuarios where correo in ('estudiante@capacitron.demo', 'valeria.condori@capacitron.demo', 'sofia.chavez@capacitron.demo')`)
    const por = Object.fromEntries(filas.map((f) => [f.correo, f]))
    expect(por['estudiante@capacitron.demo']).toMatchObject({ celular: '900000101', comparte_celular: true })
    expect(por['valeria.condori@capacitron.demo']).toMatchObject({ celular: '900000103', comparte_celular: false })
    expect(por['sofia.chavez@capacitron.demo'].celular).toBeNull()
    expect(numeros.every((n) => n.startsWith('900000'))).toBe(true) // números de ejemplo, no reales
  })

  it('reiniciar la demo sobre una base con datos no duplica ni cambia nada', async () => {
    expect(await bd.sql(`select capa.sembrar_demo() as r`)).toEqual([{ r: expect.objectContaining({ ok: false }) }])
  })
})

describe('CAP-102 el celular no sale en funciones públicas (visitante)', () => {
  it('catálogo, detalle de cada evento, verificación de certificados, instituciones, sistema y medios de pago', async () => {
    const eventos = await bd.sql<{ id: string }>(`select id from capa.eventos where estado <> 'borrador'`)
    const respuestas: unknown[] = [
      await bd.rpc('catalogo_eventos', {}), await bd.rpc('catalogo_eventos', { pasados: true }),
      await bd.rpc('verificar_certificado', { codigo: codigoCertificado }),
      await bd.rpc('instituciones_publicas', {}), await bd.rpc('estado_sistema', {}), await bd.rpc('medios_pago', {}),
    ]
    for (const e of eventos) respuestas.push(await bd.rpc('detalle_evento', { id: e.id }))
    expect(filtra(respuestas)).toEqual([])
  })
})

describe('CAP-102 el celular no sale para otras personas con sesión', () => {
  it('otro asistente: su panel, el catálogo y los detalles con su sesión', async () => {
    const r = [await bd.rpc('mis_inscripciones', { token: t.diego }), await bd.rpc('detalle_evento', { token: t.diego, id: eventoDeAna }),
      await bd.rpc('sesion_actual', { token: t.diego })]
    expect(filtra(r).filter((n) => n !== '900000102')).toEqual([]) // solo su propio número, en su propia sesión
  })

  it('el ponente ve sus eventos sin los celulares de los asistentes', async () => {
    expect(filtra(await bd.rpc('eventos_ponente', { token: t.raul })).filter((n) => n !== '900000110')).toEqual([])
  })

  it('un organizador de otra institución no ve celulares de quienes no están en sus eventos', async () => {
    const r = [await bd.rpc('eventos_organizador', { token: t.jorge }), await bd.rpc('reporte_participacion', { token: t.jorge }),
      await bd.rpc('evento_gestion', { token: t.jorge, id: eventoDeOtro })]
    const ajenos = filtra(r)
    const suyos = (await bd.sql<{ celular: string }>(`select u.celular from capa.inscripciones i join capa.usuarios u on u.id = i.usuario_id
      where i.evento_id in (select id from capa.eventos where organizador_id = (select id from capa.usuarios where correo = 'capacitacion.iac@capacitron.demo'))
      and u.celular is not null`)).map((x) => x.celular)
    expect(ajenos.filter((n) => !suyos.includes(n))).toEqual([])
  })

  it('la administración ve usuarios, resumen e historial sin celulares (ISP: no los necesita)', async () => {
    const r = [await bd.rpc('admin_usuarios', { token: t.admin }), await bd.rpc('admin_resumen', { token: t.admin }),
      await bd.rpc('admin_historial', { token: t.admin })]
    expect(filtra(r)).toEqual([])
  })
})

describe('CAP-102 el organizador del evento: solo en la gestión y solo con permiso', () => {
  it('asistencia, certificados y reporte no traen celulares', async () => {
    const r = [await bd.rpc('asistencia_evento', { token: t.carmen, evento_id: eventoDeAna }),
      await bd.rpc('certificados_evento', { token: t.carmen, evento_id: eventoDeAna }), await bd.rpc('reporte_participacion', { token: t.carmen })]
    expect(filtra(r)).toEqual([])
  })

  it('en la gestión del evento ve el celular de quien dio permiso y no el de quien no lo dio', async () => {
    const g = await bd.rpc<any>('evento_gestion', { token: t.carmen, id: eventoDeAna })
    const conPermiso = (await bd.sql<{ celular: string }>(`select u.celular from capa.inscripciones i join capa.usuarios u on u.id = i.usuario_id
      where i.evento_id = $1 and i.estado in ('confirmada', 'pendiente_pago') and u.comparte_celular`, [eventoDeAna])).map((x) => x.celular)
    const sinPermiso = (await bd.sql<{ celular: string }>(`select celular from capa.usuarios where celular is not null and not comparte_celular`)).map((x) => x.celular)
    expect(conPermiso).toContain('900000101')
    for (const n of conPermiso) expect(JSON.stringify(g)).toContain(n)
    for (const n of sinPermiso) expect(JSON.stringify(g)).not.toContain(n)
  })
})
