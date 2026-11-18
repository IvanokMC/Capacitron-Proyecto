// CAP-99 · Celular y consentimiento del usuario en la base de datos (HU-18, CA-01 a CA-04).
// Rol: Backend y base de datos (Carlos). Teoría: refactorizar con pruebas (diap. 140) y encapsulación
// (diap. 20–24): estas pruebas fijan quién puede ver el celular y que ninguna función pública lo entrega.
import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let org: string
beforeEach(async () => {
  bd = await nuevaBd()
  org = (await bd.organizador('org@test.pe')).token
})

const registro = (extra: Record<string, unknown> = {}) => bd.rpc('registrar_usuario', {
  nombres: 'Rosa', apellidos: 'Quispe', correo: 'rosa@test.pe', password: 'Clave2026x', acepta_privacidad: true,
  celular: '984123456', ...extra,
})
const fila = async (correo: string) =>
  (await bd.sql<any>(`select celular, comparte_celular, celular_consentido_en from capa.usuarios where correo = $1`, [correo]))[0]
const perfil = (token: string, extra: Record<string, unknown>) =>
  bd.rpc<any>('actualizar_perfil', { token, nombres: 'Ana', apellidos: 'Prueba', ...extra })
/** Asistente con su propio celular y consentimiento, inscrita en el evento. */
async function inscrita(correo: string, celular: string, comparte: boolean, eventoId: string) {
  const token = await bd.cuenta(correo)
  await perfil(token, { nombres: correo.split('@')[0], celular, comparte_celular: comparte })
  const r = await bd.rpc<any>('inscribirse', { token, evento_id: eventoId })
  return { token, inscripcion: r.inscripcion }
}
const inscritos = async (token: string, id: string) =>
  (await bd.rpc<any>('evento_gestion', { token, id })).inscritos as any[]

describe('CAP-99 CA-01: celular obligatorio y con formato al registrarse', () => {
  it('sin celular no se registra y se nombra «celular» junto a los demás campos que faltan', async () => {
    await expect(registro({ celular: '', nombres: '' })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['nombres', 'celular'] } })
    expect(await bd.sql(`select 1 from capa.usuarios where correo = 'rosa@test.pe'`)).toEqual([])
  })

  it.each(['812345678', '98412345', '9841234567', '98412345a', '+1 984123456'])(
    '«%s» no es un celular válido: se resalta el campo y no se crea la cuenta', async (celular) => {
      await expect(registro({ celular })).rejects.toMatchObject({
        codigo: 'CAMPOS', message: 'El celular debe tener 9 dígitos y empezar con 9.', detalle: { campos: ['celular'] },
      })
      expect(await bd.sql(`select 1 from capa.usuarios where correo = 'rosa@test.pe'`)).toEqual([])
    })

  it.each(['984 123 456', '984-123-456', '+51 984 123 456', '51984123456'])(
    '«%s» se guarda como 984123456 (espacios, guiones y +51 se quitan)', async (celular) => {
      await registro({ celular })
      expect((await fila('rosa@test.pe')).celular).toBe('984123456')
    })

  it('la base de datos también lo impide si alguien escribe directo en la tabla', async () => {
    await registro()
    await expect(bd.sql(`update capa.usuarios set celular = '123' where correo = 'rosa@test.pe'`)).rejects.toThrow()
    await expect(bd.sql(`update capa.usuarios set celular = null, comparte_celular = true where correo = 'rosa@test.pe'`)).rejects.toThrow()
  })
})

describe('CAP-99 CA-02: consentimiento explícito al registrarse', () => {
  it('si no marca la casilla, queda sin consentimiento (privado por defecto)', async () => {
    await registro()
    expect(await fila('rosa@test.pe')).toMatchObject({ celular: '984123456', comparte_celular: false, celular_consentido_en: null })
  })

  it('si acepta, se guarda el consentimiento con su fecha', async () => {
    await registro({ comparte_celular: true })
    const f = await fila('rosa@test.pe')
    expect(f.comparte_celular).toBe(true)
    expect(f.celular_consentido_en).not.toBeNull()
  })

  it('el organizador ve el celular de quien lo comparte y null de quien no', async () => {
    const e = await bd.evento(org)
    await inscrita('ana@test.pe', '984111222', true, e.id)
    await inscrita('beto@test.pe', '984333444', false, e.id)
    const lista = await inscritos(org, e.id)
    expect(lista.find((i) => i.nombre.startsWith('ana'))!.celular).toBe('984111222')
    expect(lista.find((i) => i.nombre.startsWith('beto'))!.celular).toBeNull()
    expect(JSON.stringify(lista)).not.toContain('984333444')
  })
})

describe('CAP-99 CA-03: cambiar el celular y dar o retirar el consentimiento desde el perfil', () => {
  it('cambia el celular y lo devuelve en la propia sesión', async () => {
    const t = await bd.cuenta('ana@test.pe')
    const r = await perfil(t, { celular: '912 345 678' })
    expect(r.usuario).toMatchObject({ celular: '912345678', comparte_celular: false })
    expect((await bd.rpc<any>('sesion_actual', { token: t })).usuario.celular).toBe('912345678')
  })

  it('un celular inválido en el perfil se rechaza y no cambia el guardado', async () => {
    const t = await bd.cuenta('ana@test.pe')
    await expect(perfil(t, { celular: '12345' })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['celular'] } })
    expect((await fila('ana@test.pe')).celular).toBe('987654321')
  })

  it('al retirar el consentimiento el organizador deja de verlo, y al darlo otra vez vuelve a verlo', async () => {
    const e = await bd.evento(org)
    const { token } = await inscrita('ana@test.pe', '984111222', true, e.id)
    await perfil(token, { comparte_celular: false })
    expect((await inscritos(org, e.id))[0].celular).toBeNull()
    expect((await fila('ana@test.pe')).celular_consentido_en).toBeNull()
    await perfil(token, { comparte_celular: true })
    expect((await inscritos(org, e.id))[0].celular).toBe('984111222')
    expect((await fila('ana@test.pe')).celular_consentido_en).not.toBeNull()
  })

  it('volver a guardar el perfil sin tocar el consentimiento no cambia su fecha', async () => {
    const t = await bd.cuenta('ana@test.pe')
    await perfil(t, { comparte_celular: true })
    const antes = (await fila('ana@test.pe')).celular_consentido_en
    await bd.adelantar(60)
    await perfil(t, { comparte_celular: true, nombres: 'Ana María' })
    expect((await fila('ana@test.pe')).celular_consentido_en).toEqual(antes)
  })

  it('si la llamada no trae celular ni consentimiento, no se tocan', async () => {
    const t = await bd.cuenta('ana@test.pe')
    await perfil(t, { comparte_celular: true })
    await perfil(t, { nombres: 'Ana María' })
    expect(await fila('ana@test.pe')).toMatchObject({ celular: '987654321', comparte_celular: true })
  })

  it('quien ya tiene celular no lo puede borrar: para ocultarlo retira el consentimiento', async () => {
    const t = await bd.cuenta('ana@test.pe')
    await expect(perfil(t, { celular: '' })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['celular'] } })
  })

  it('una cuenta antigua sin celular sigue funcionando, no puede compartir sin escribirlo y lo completa en el perfil', async () => {
    const t = await bd.cuenta('ana@test.pe')
    await bd.sql(`update capa.usuarios set celular = null, comparte_celular = false where correo = 'ana@test.pe'`)
    expect((await perfil(t, { celular: '' })).usuario.celular).toBeNull()
    await expect(perfil(t, { comparte_celular: true })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['celular'] } })
    expect((await perfil(t, { celular: '956789012', comparte_celular: true })).usuario)
      .toMatchObject({ celular: '956789012', comparte_celular: true })
  })

  // CAP-102 (George) agregó celulares DE EJEMPLO a 5 cuentas de la demo. La garantía de CAP-99 sigue: la migración no
  // inventa celulares; las demás cuentas, creadas como antes de la HU-18, quedan sin celular.
  it('las cuentas de la demostración quedan sin celular, salvo las 5 de ejemplo de CAP-102', async () => {
    const demo = await nuevaBd({ demo: true })
    const filas = await demo.sql<{ correo: string }>(`select correo from capa.usuarios where celular is not null order by correo`)
    expect(filas.map((f) => f.correo)).toEqual(['diego.mamani@capacitron.demo', 'estudiante@capacitron.demo',
      'luis.ccahuana@capacitron.demo', 'ponente@capacitron.demo', 'valeria.condori@capacitron.demo'])
  })
})

describe('CAP-99 CA-04: solo el organizador del evento y solo de sus inscritos activos', () => {
  it('otro organizador no puede abrir la lista de inscritos del evento', async () => {
    const e = await bd.evento(org)
    await inscrita('ana@test.pe', '984111222', true, e.id)
    const otro = (await bd.organizador('otro@test.pe')).token
    await expect(bd.rpc('evento_gestion', { token: otro, id: e.id })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
  })

  it('un asistente no puede abrir la lista de inscritos', async () => {
    const e = await bd.evento(org)
    const { token } = await inscrita('ana@test.pe', '984111222', true, e.id)
    await expect(bd.rpc('evento_gestion', { token, id: e.id })).rejects.toBeTruthy()
  })

  it('si la inscripción se cancela, el organizador deja de ver el celular aunque haya consentimiento', async () => {
    const e = await bd.evento(org, { inicioH: 72 })
    const { token, inscripcion } = await inscrita('ana@test.pe', '984111222', true, e.id)
    await bd.rpc('cancelar_inscripcion', { token, id: inscripcion.id })
    expect((await inscritos(org, e.id))[0]).toMatchObject({ estado: 'cancelada', celular: null })
  })

  it('la lista de espera no trae el celular', async () => {
    const e = await bd.evento(org, { cupo_maximo: 1 })
    await inscrita('ana@test.pe', '984111222', true, e.id)
    const beto = await bd.cuenta('beto@test.pe')
    await perfil(beto, { celular: '984333444', comparte_celular: true })
    await bd.rpc('unirse_lista_espera', { token: beto, evento_id: e.id })
    const g = await bd.rpc<any>('evento_gestion', { token: org, id: e.id })
    expect(g.lista_espera).toHaveLength(1)
    expect(JSON.stringify(g.lista_espera)).not.toContain('984333444')
  })
})

describe('CAP-99 regla: el celular nunca sale por funciones públicas ni de otros roles', () => {
  it('ni el catálogo, ni el detalle, ni «Mis inscripciones», ni la lista del administrador lo traen', async () => {
    const e = await bd.evento(org)
    const { token } = await inscrita('ana@test.pe', '984111222', true, e.id)
    const admin = await bd.cuenta('admin@test.pe', 'asistente')
    await bd.sql(`update capa.usuarios set rol = 'admin' where correo = 'admin@test.pe'`)
    const respuestas = JSON.stringify([
      await bd.rpc('catalogo_eventos', {}),
      await bd.rpc('detalle_evento', { id: e.id }),
      await bd.rpc('mis_inscripciones', { token }),
      await bd.rpc('admin_usuarios', { token: admin }),
    ])
    expect(respuestas).toContain(e.id)
    expect(respuestas).not.toContain('984111222')
  })
})
