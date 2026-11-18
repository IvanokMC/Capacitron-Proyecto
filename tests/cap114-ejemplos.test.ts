// CAP-114 · Ejemplos del Sprint 2 para mostrar el sistema (capa.sembrar_ejemplos).
// Rol: DevOps (George). Comprueba que cada historia nueva tenga su ejemplo visible con las funciones reales de la API,
// que los ejemplos respeten las mismas reglas que los datos reales y que la siembra se pueda repetir sin duplicar nada.
// Teoría: refactorizar con pruebas (diap. 140) y mantenibilidad (diap. 137): todo se prueba con PGlite, sin internet.
import { beforeAll, describe, expect, it } from 'vitest'
import { rutaEjemplo } from '../src/lib/almacenamiento/local'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let admin: string
let ana: string

const NOMBRES = ['Congreso de Ingeniería de Software 2026', 'Taller de Diseño de Interfaces con Figma',
  'Seminario de Ciencia de Datos para la Investigación', 'Curso de Python para Docentes']

beforeAll(async () => {
  bd = await nuevaBd({ demo: true })
  expect(await bd.sql(`select capa.sembrar_ejemplos() as r`)).toEqual([{ r: expect.objectContaining({ ok: true }) }])
  admin = (await bd.rpc('iniciar_sesion', { correo: 'admin@capacitron.demo', password: 'Capacitron2026' })).token
  ana = (await bd.rpc('iniciar_sesion', { correo: 'estudiante@capacitron.demo', password: 'Capacitron2026' })).token
}, 120_000)

describe('CAP-114 ejemplos del Sprint 2', () => {
  it('el catálogo muestra los 4 eventos de ejemplo, próximos y con tipo, organizador y contacto (HU-02 y HU-15)', async () => {
    const catalogo = await bd.rpc('catalogo_eventos', {})
    const ejemplos = catalogo.filter((e: any) => NOMBRES.includes(e.nombre))
    expect(ejemplos).toHaveLength(4)
    for (const e of ejemplos) {
      expect(e).toMatchObject({ estado: 'publicado', fase: 'proximo', contacto_publico: true })
      expect(e.tipo).toBeTruthy()
      expect(e.organizador_nombre).toBeTruthy()
    }
    expect(await bd.rpc('catalogo_eventos', { tipo: 'congreso' })).toEqual([expect.objectContaining({ nombre: NOMBRES[0] })])
  })

  it('los presenciales y el mixto tienen punto en el mapa, flyer e imagen del lugar; el virtual no tiene mapa (HU-19 y HU-20)', async () => {
    const catalogo = await bd.rpc('catalogo_eventos', {})
    const por = Object.fromEntries(catalogo.map((e: any) => [e.nombre, e]))
    for (const n of NOMBRES.slice(0, 3)) {
      expect(por[n].latitud).not.toBeNull()
      expect(por[n].flyer_url).toMatch(new RegExp(`^${por[n].id}/ejemplo-flyer-[a-z]+\\.png$`))
      expect(por[n].imagen_lugar_url).toMatch(/\/ejemplo-lugar-[a-z]+\.png$/)
    }
    expect(por[NOMBRES[3]]).toMatchObject({ modalidad: 'virtual', latitud: null, imagen_lugar_url: null })
    expect(por[NOMBRES[3]].flyer_url).toMatch(/ejemplo-flyer-python\.png$/)
  })

  it('las imágenes de ejemplo se sirven desde public/ejemplos en modo local; otras rutas no', () => {
    expect(rutaEjemplo('6f1c2a3b-0000-4000-8000-000000000001/ejemplo-flyer-congreso.png')).toBe('/ejemplos/ejemplo-flyer-congreso.png')
    expect(rutaEjemplo('6f1c2a3b-0000-4000-8000-000000000001/foto-real.png')).toBeNull()
  })

  it('hay fotos de perfil y celulares de ejemplo; el organizador solo ve el celular de quien lo comparte (HU-17 y HU-18)', async () => {
    const [{ fotos }] = await bd.sql<{ fotos: number }>(`select count(*)::int as fotos from capa.usuarios where foto_url like '%/ejemplo-foto-%'`)
    expect(fotos).toBe(5)
    const carmen = (await bd.rpc('iniciar_sesion', { correo: 'coordinacion@capacitron.demo', password: 'Capacitron2026' })).token
    const [{ id }] = await bd.sql<{ id: string }>(`select id from capa.eventos where nombre = $1`, [NOMBRES[2]])
    const g = await bd.rpc('evento_gestion', { token: carmen, id })
    const por = Object.fromEntries(g.inscritos.map((i: any) => [i.correo, i]))
    expect(por['estudiante@capacitron.demo'].celular).toBe('900000101')
    expect(por['valeria.condori@capacitron.demo'].celular).toBeNull() // tiene celular, pero no dio permiso
    expect(por['sofia.chavez@capacitron.demo'].celular).toBeNull() // no tiene celular
  })

  it('la organización tiene los tres medios de pago y la bandeja muestra dos pagos de ejemplo por verificar (HU-16)', async () => {
    expect((await bd.rpc('medios_pago')).disponibles).toEqual(['yape', 'transferencia', 'whatsapp'])
    const bandeja = await bd.rpc('pagos_por_verificar', { token: admin })
    expect(bandeja.map((f: any) => f.operacion).sort()).toEqual(['EJEMPLO-1001', 'EJEMPLO-1002'])
    for (const f of bandeja) expect(f.comprobante).toMatch(new RegExp(`^${f.inscripcion_id}/ejemplo-comprobante-\\d\\.png$`))
    const [{ aprobados }] = await bd.sql<{ aprobados: number }>(
      `select count(*)::int as aprobados from capa.pagos where numero_operacion = 'EJEMPLO-1003' and estado = 'confirmado' and numero_comprobante like 'CP-%'`)
    expect(aprobados).toBe(1)
  })

  it('el pago de ejemplo de Ana se puede aprobar como uno real', async () => {
    const bandeja = await bd.rpc('pagos_por_verificar', { token: admin })
    const deAna = bandeja.find((f: any) => f.correo === 'estudiante@capacitron.demo')
    expect((await bd.rpc('aprobar_pago', { token: admin, pago_id: deAna.id })).pago.estado).toBe('confirmado')
    expect(await bd.sql(`select estado from capa.inscripciones where id = $1`, [deAna.inscripcion_id])).toEqual([{ estado: 'confirmada' }])
    expect(ana).toBeTruthy() // Ana puede iniciar sesión con la contraseña de la demo
  })

  it('volver a sembrar no duplica eventos, inscripciones ni pagos', async () => {
    const contar = async () => (await bd.sql<{ e: number; i: number; p: number }>(
      `select (select count(*)::int from capa.eventos) e, (select count(*)::int from capa.inscripciones) i, (select count(*)::int from capa.pagos) p`))[0]
    const antes = await contar()
    await bd.sql(`select capa.sembrar_ejemplos()`)
    expect(await contar()).toEqual(antes)
  })
})
