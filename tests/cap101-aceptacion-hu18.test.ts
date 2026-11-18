// CAP-101 · Pruebas de aceptación de la HU-18 «Celular del asistente» (CA-01 a CA-05).
// Rol: QA (Andree). Plan, matriz y hallazgos en docs/pruebas/HU-18/PLAN_DE_PRUEBAS.md.
//
// Recorren la historia con dos organizadoras, dos eventos y tres asistentes. Las asistentes se registran y
// cambian su perfil con las mismas funciones que la pantalla (validarCelular, limpiarCelular, CAP-100). La
// organizadora ve la lista con la API real (CAP-99) dibujada con la tabla de inscritos.
// Teoría: refactorizar con pruebas (diap. 140) y encapsulación (diap. 20–24): el celular solo sale por la
// función del organizador del evento y con consentimiento.
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enlaceWhatsapp, limpiarCelular, MENSAJE_CELULAR, validarCelular, validarCelularPerfil } from '../src/lib/celular'
import { nuevaBd, type Bd } from './bd'
import { TablaInscritos } from '../src/pages/organizador/GestionEvento'

vi.mock('../src/lib/app', () => ({ useApp: () => ({ usuario: null, api: async () => ({}) }), useCarga: () => ({ datos: null }) }))
vi.mock('../src/components/notificaciones', () => ({ useNotas: () => ({ exito: () => {}, error: () => {} }) }))

const ROSA = '984111222'
const LUIS = '984333444'
let bd: Bd
let carmen: string
let jorge: string
let taller: any
let curso: any
let rosa: string
let luis: string

/** Registro como lo hace la pantalla: primero la regla del celular, luego la API con el número limpio. */
async function registrarse(nombres: string, correo: string, celular: string, comparte: boolean) {
  expect(validarCelular(celular, true)).toBeNull()
  await bd.rpc('registrar_usuario', {
    nombres, apellidos: 'Prueba', correo, password: 'Clave2026x', acepta_privacidad: true,
    celular: limpiarCelular(celular), comparte_celular: comparte,
  })
  const [{ token }] = await bd.sql<{ token: string }>(
    `select t.token from capa.tokens_confirmacion t join capa.usuarios u on u.id = t.usuario_id where u.correo = $1`, [correo])
  await bd.rpc('confirmar_cuenta', { token })
  return (await bd.rpc<any>('iniciar_sesion', { correo, password: 'Clave2026x' })).token as string
}
/** «Guardar cambios» de Mi perfil: valida como la pantalla y guarda. */
async function perfil(token: string, celular: string, comparte: boolean) {
  const actual = (await bd.rpc<any>('sesion_actual', { token })).usuario
  expect(validarCelularPerfil(celular, actual.celular, comparte)).toBeNull()
  return (await bd.rpc<any>('actualizar_perfil', {
    token, nombres: actual.nombres, apellidos: actual.apellidos, celular: limpiarCelular(celular), comparte_celular: comparte,
  })).usuario
}
const inscritos = async (token: string, id: string) => (await bd.rpc<any>('evento_gestion', { token, id })).inscritos as any[]
const celularDe = async (token: string, id: string, nombre: string) =>
  (await inscritos(token, id)).find((i) => i.nombre.startsWith(nombre))?.celular

beforeEach(async () => {
  bd = await nuevaBd()
  carmen = (await bd.organizador('carmen@unsaac.test')).token
  jorge = (await bd.organizador('jorge@iac.test')).token
  taller = await bd.evento(carmen, { nombre: 'Taller de Python' })
  curso = await bd.evento(jorge, { nombre: 'Curso de React' })
  rosa = await registrarse('Rosa', 'rosa@correo.test', '984 111 222', true)
  luis = await registrarse('Luis', 'luis@correo.test', '+51 984-333-444', false)
  await bd.rpc('inscribirse', { token: rosa, evento_id: taller.id })
  await bd.rpc('inscribirse', { token: rosa, evento_id: curso.id })
  await bd.rpc('inscribirse', { token: luis, evento_id: taller.id })
})

describe('HU-18 CA-01: 9 dígitos que empiezan con 9, o no se guarda', () => {
  it.each(['812345678', '98411122', '9841112223', '98411122a', '1 984 111 222'])(
    'dado «%s», cuando me registro, entonces la pantalla y la API lo rechazan con el mismo motivo y no se crea la cuenta', async (celular) => {
      expect(validarCelular(celular, true)).toBe(MENSAJE_CELULAR)
      await expect(bd.rpc('registrar_usuario', {
        nombres: 'X', apellidos: 'Y', correo: 'x@correo.test', password: 'Clave2026x', acepta_privacidad: true, celular,
      })).rejects.toMatchObject({ codigo: 'CAMPOS', message: MENSAJE_CELULAR, detalle: { campos: ['celular'] } })
      expect(await bd.sql(`select 1 from capa.usuarios where correo = 'x@correo.test'`)).toEqual([])
    })

  it('dado un celular escrito con espacios, guiones o +51, cuando me registro, entonces se guarda limpio', async () => {
    const [r, l] = await bd.sql<{ celular: string }>(`select celular from capa.usuarios where correo in ('rosa@correo.test', 'luis@correo.test') order by correo desc`)
    expect([r.celular, l.celular]).toEqual([ROSA, LUIS])
  })

  it('dado que intento cambiarlo en mi perfil por uno inválido, entonces se rechaza y queda el anterior', async () => {
    expect(validarCelularPerfil('12345', ROSA, true)).toBe(MENSAJE_CELULAR)
    await expect(bd.rpc('actualizar_perfil', { token: rosa, nombres: 'Rosa', apellidos: 'Prueba', celular: '12345' }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['celular'] } })
    expect(await celularDe(carmen, taller.id, 'Rosa')).toBe(ROSA)
  })
})

describe('HU-18 CA-02: con consentimiento el organizador lo ve; sin consentimiento, no', () => {
  it('dado que Rosa aceptó y Luis no, cuando Carmen abre sus inscritos, entonces ve el celular de Rosa y no el de Luis', async () => {
    expect(await celularDe(carmen, taller.id, 'Rosa')).toBe(ROSA)
    expect(await celularDe(carmen, taller.id, 'Luis')).toBeNull()
    expect(JSON.stringify(await inscritos(carmen, taller.id))).not.toContain(LUIS)
  })

  it('dada la lista en pantalla, entonces Rosa tiene número y WhatsApp, y Luis «No compartido»', async () => {
    const html = renderToStaticMarkup(h(TablaInscritos, { filas: await inscritos(carmen, taller.id), evento: 'Taller de Python' }))
    expect(html).toContain('984 111 222')
    expect(html).toContain('href="https://wa.me/51984111222?text=')
    expect(html).toContain('No compartido')
    expect(html).not.toContain('984 333 444')
  })
})

describe('HU-18 CA-03: cambiar el celular y dar o retirar el consentimiento desde el perfil', () => {
  it('dado que Rosa retira el consentimiento, entonces deja de verse de inmediato en los dos eventos donde está inscrita', async () => {
    await perfil(rosa, ROSA, false)
    expect(await celularDe(carmen, taller.id, 'Rosa')).toBeNull()
    expect(await celularDe(jorge, curso.id, 'Rosa')).toBeNull()
  })

  it('dado que Luis da el consentimiento después, entonces Carmen ya lo ve', async () => {
    await perfil(luis, LUIS, true)
    expect(await celularDe(carmen, taller.id, 'Luis')).toBe(LUIS)
  })

  it('dado que Rosa cambia su número, entonces el organizador ve el nuevo', async () => {
    await perfil(rosa, '956 789 012', true)
    expect(await celularDe(carmen, taller.id, 'Rosa')).toBe('956789012')
  })

  it('dado que Rosa quiere borrar su número, entonces la pantalla y la API se lo impiden y le dicen cómo ocultarlo', async () => {
    expect(validarCelularPerfil('', ROSA, false)).toMatch(/desmarca «Compartir mi celular»/)
    await expect(bd.rpc('actualizar_perfil', { token: rosa, nombres: 'Rosa', apellidos: 'Prueba', celular: '' }))
      .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['celular'] } })
  })

  it('dada una cuenta antigua sin celular, cuando entra a su perfil, entonces puede seguir sin él y completarlo cuando quiera', async () => {
    const ana = await bd.cuenta('ana@correo.test')
    await bd.sql(`update capa.usuarios set celular = null where correo = 'ana@correo.test'`)
    expect(validarCelularPerfil('', null, false)).toBeNull()
    expect((await perfil(ana, '912 345 678', true))).toMatchObject({ celular: '912345678', comparte_celular: true })
  })
})

describe('HU-18 CA-04: un organizador solo ve el celular de los inscritos de sus propios eventos', () => {
  it('dado que Rosa está en los dos eventos, cuando Jorge abre el suyo, entonces ve a Rosa pero no a Luis, que no está inscrito', async () => {
    const lista = await inscritos(jorge, curso.id)
    expect(lista.map((i) => i.nombre)).toEqual(['Rosa Prueba'])
    expect(JSON.stringify(lista)).not.toContain(LUIS)
  })

  it('dado el evento de Carmen, cuando Jorge intenta abrir su lista, entonces se le niega', async () => {
    await expect(bd.rpc('evento_gestion', { token: jorge, id: taller.id })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
  })

  it('dado que Rosa cancela su inscripción, entonces Carmen deja de ver su celular aunque haya consentimiento', async () => {
    const [{ id }] = await bd.sql<{ id: string }>(
      `select i.id from capa.inscripciones i join capa.usuarios u on u.id = i.usuario_id where u.correo = 'rosa@correo.test' and i.evento_id = $1`, [taller.id])
    await bd.rpc('cancelar_inscripcion', { token: rosa, id })
    expect(await celularDe(carmen, taller.id, 'Rosa')).toBeNull()
    expect(await celularDe(jorge, curso.id, 'Rosa')).toBe(ROSA)
  })
})

describe('HU-18 CA-05: WhatsApp con un clic cuando hay consentimiento', () => {
  it('el enlace lleva el +51 y un saludo con el nombre de la persona y del evento', () => {
    const url = enlaceWhatsapp(ROSA, 'Rosa Prueba', 'Taller de Python')
    expect(url).toBe(`https://wa.me/51${ROSA}?text=${encodeURIComponent('Hola Rosa, te escribo por el evento «Taller de Python» de CAPACITRON.')}`)
  })
})

describe('HU-18 regla: el celular nunca aparece en funciones públicas ni en otras vistas', () => {
  it('ni el catálogo, la página del evento, «Mis inscripciones», asistencia, certificados, reportes ni la lista del administrador', async () => {
    await bd.cuenta('admin@correo.test')
    await bd.sql(`update capa.usuarios set rol = 'admin' where correo = 'admin@correo.test'`)
    const admin = (await bd.rpc<any>('iniciar_sesion', { correo: 'admin@correo.test', password: 'Clave2026x' })).token
    const respuestas = JSON.stringify([
      await bd.rpc('catalogo_eventos', {}),
      await bd.rpc('detalle_evento', { id: taller.id }),
      await bd.rpc('detalle_evento', { id: taller.id, token: carmen }),
      await bd.rpc('mis_inscripciones', { token: rosa }),
      await bd.rpc('asistencia_evento', { token: carmen, evento_id: taller.id }),
      await bd.rpc('certificados_evento', { token: carmen, evento_id: taller.id }),
      await bd.rpc('reporte_participacion', { token: carmen }),
      await bd.rpc('eventos_organizador', { token: carmen }),
      await bd.rpc('admin_usuarios', { token: admin }),
    ])
    expect(respuestas).toContain('Rosa')
    expect(respuestas).not.toContain(ROSA)
    expect(respuestas).not.toContain(LUIS)
  })
})
