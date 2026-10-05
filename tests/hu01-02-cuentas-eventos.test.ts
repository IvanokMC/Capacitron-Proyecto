import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
beforeEach(async () => { bd = await nuevaBd() })

const registro = (extra: Record<string, unknown> = {}) => ({
  nombres: 'Ana', apellidos: 'Huamán', correo: 'ana@test.pe', password: 'Clave2026x', rol: 'asistente',
  acepta_privacidad: true, ...extra,
})

describe('HU-01 Registro de usuarios', () => {
  it('CA-01 crea la cuenta en estado «pendiente de confirmación» y guarda la contraseña cifrada', async () => {
    const r = await bd.rpc('registrar_usuario', registro())
    expect(r.ok).toBe(true)
    const [u] = await bd.sql(`select estado, password_hash from capa.usuarios where correo = 'ana@test.pe'`)
    expect(u.estado).toBe('pendiente')
    expect(u.password_hash).toMatch(/^\$2[ab]\$10\$/)
    expect(u.password_hash).not.toContain('Clave2026x')
  })

  it('CA-02 rechaza un correo ya registrado (sin distinguir mayúsculas) y no crea otra cuenta', async () => {
    await bd.rpc('registrar_usuario', registro())
    await expect(bd.rpc('registrar_usuario', registro({ correo: 'ANA@test.pe' })))
      .rejects.toMatchObject({ codigo: 'CORREO_EXISTE' })
    const [{ n }] = await bd.sql(`select count(*)::int n from capa.usuarios`)
    expect(n).toBe(1)
  })

  it('CA-03 envía un correo con enlace de confirmación válido por 24 horas', async () => {
    await bd.rpc('registrar_usuario', registro())
    const [c] = await bd.correos('ana@test.pe')
    expect(c.tipo).toBe('confirmacion')
    expect(c.accion_url).toMatch(/^\/confirmar\/[0-9a-f]{48}$/)
    const [{ horas }] = await bd.sql(`select round(extract(epoch from expira_en - capa.ahora()) / 3600) horas from capa.tokens_confirmacion`)
    expect(Number(horas)).toBe(24)
  })

  it('CA-04 rechaza contraseñas de menos de 8 caracteres o sin letras y números', async () => {
    for (const password of ['Cl4ve', 'solamenteletras', '1234567890']) {
      await expect(bd.rpc('registrar_usuario', registro({ password })))
        .rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['password'] } })
    }
  })

  it('CA-05 el enlace vigente activa la cuenta y permite iniciar sesión; uno vencido no', async () => {
    await bd.rpc('registrar_usuario', registro())
    const antes = await bd.rpc('iniciar_sesion', { correo: 'ana@test.pe', password: 'Clave2026x' })
    expect(antes).toMatchObject({ ok: false, motivo: 'pendiente' })

    const token = (await bd.correos('ana@test.pe'))[0].accion_url!.split('/').pop()
    expect(await bd.rpc('confirmar_cuenta', { token })).toMatchObject({ ok: true })
    const r = await bd.rpc('iniciar_sesion', { correo: 'ana@test.pe', password: 'Clave2026x' })
    expect(r.ok).toBe(true)
    expect(r.token).toHaveLength(64)

    await bd.rpc('registrar_usuario', registro({ correo: 'tarde@test.pe' }))
    const t2 = (await bd.correos('tarde@test.pe'))[0].accion_url!.split('/').pop()
    await bd.adelantar(24 * 60 + 1)
    expect(await bd.rpc('confirmar_cuenta', { token: t2 })).toMatchObject({ ok: false, motivo: 'vencido' })
  })

  it('regla: exige aceptar la política de privacidad', async () => {
    await expect(bd.rpc('registrar_usuario', registro({ acepta_privacidad: false })))
      .rejects.toMatchObject({ detalle: { campos: ['acepta_privacidad'] } })
  })

  it('regla: tras 5 intentos fallidos la cuenta se bloquea 15 minutos', async () => {
    await bd.cuenta('ana@test.pe')
    for (let i = 1; i <= 4; i++) {
      const r = await bd.rpc('iniciar_sesion', { correo: 'ana@test.pe', password: 'mala' })
      expect(r).toMatchObject({ ok: false, intentos_restantes: 5 - i })
    }
    expect(await bd.rpc('iniciar_sesion', { correo: 'ana@test.pe', password: 'mala' })).toMatchObject({ motivo: 'bloqueada' })
    // Ni la contraseña correcta funciona mientras dure el bloqueo.
    expect(await bd.rpc('iniciar_sesion', { correo: 'ana@test.pe', password: 'Clave2026x' })).toMatchObject({ motivo: 'bloqueada' })
    await bd.adelantar(15)
    expect(await bd.rpc('iniciar_sesion', { correo: 'ana@test.pe', password: 'Clave2026x' })).toMatchObject({ ok: true })
  })

  it('un organizador debe elegir una institución activa', async () => {
    await expect(bd.rpc('registrar_usuario', registro({ rol: 'organizador' })))
      .rejects.toMatchObject({ detalle: { campos: ['institucion_id'] } })
  })
})

describe('HU-02 Crear evento', () => {
  it('CA-01 si faltan campos obligatorios indica cuáles y no guarda', async () => {
    const { token } = await bd.organizador('org@test.pe')
    await expect(bd.rpc('guardar_evento', { token, nombre: 'Sin datos', modalidad: 'presencial' }))
      .rejects.toMatchObject({
        codigo: 'CAMPOS',
        detalle: { campos: ['descripcion', 'fecha_inicio', 'fecha_fin', 'cupo_maximo', 'costo', 'horas_academicas', 'lugar'] },
      })
    const [{ n }] = await bd.sql(`select count(*)::int n from capa.eventos`)
    expect(n).toBe(0)
  })

  it('CA-02 un borrador se guarda pero no aparece en el catálogo', async () => {
    const { token } = await bd.organizador('org@test.pe')
    const e = await bd.evento(token, {}, 'borrador')
    expect(e.estado).toBe('borrador')
    expect(await bd.rpc('catalogo_eventos')).toHaveLength(0)
    await expect(bd.rpc('detalle_evento', { id: e.id })).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' })
  })

  it('CA-03 al publicarlo aparece en el catálogo con fecha, modalidad, cupos y costo', async () => {
    const { token } = await bd.organizador('org@test.pe')
    const e = await bd.evento(token, { costo: 25, cupo_maximo: 40, modalidad: 'mixta' }, 'borrador')
    await bd.rpc('publicar_evento', { token, id: e.id })
    const [c] = await bd.rpc('catalogo_eventos')
    expect(c).toMatchObject({ id: e.id, modalidad: 'mixta', cupo_maximo: 40, cupos_disponibles: 40, costo: 25 })
    expect(c.fecha_inicio).toBeTruthy()
  })

  it('CA-04 impide publicar si la fecha de inicio ya pasó', async () => {
    const { token } = await bd.organizador('org@test.pe')
    const e = await bd.evento(token, { inicioH: -2 }, 'borrador')
    await expect(bd.rpc('publicar_evento', { token, id: e.id }))
      .rejects.toMatchObject({ detalle: { campos: ['fecha_inicio'] }, message: expect.stringMatching(/ya pasó/) })
  })

  it('CA-05 sin inscritos, la edición se guarda y se refleja en el catálogo', async () => {
    const { token } = await bd.organizador('org@test.pe')
    const e = await bd.evento(token)
    await bd.rpc('guardar_evento', { ...e, token, id: e.id, nombre: 'Nombre corregido', cupo_maximo: 15, costo: 5 })
    const [c] = await bd.rpc('catalogo_eventos')
    expect(c).toMatchObject({ nombre: 'Nombre corregido', cupo_maximo: 15, costo: 5 })
  })

  it('regla: con inscritos no se cambia el costo y el evento no se elimina, solo se cancela', async () => {
    const { token } = await bd.organizador('org@test.pe')
    const e = await bd.evento(token)
    const ana = await bd.cuenta('ana@test.pe')
    await bd.rpc('inscribirse', { token: ana, evento_id: e.id })
    await expect(bd.rpc('guardar_evento', { ...e, token, id: e.id, costo: 10 })).rejects.toMatchObject({ detalle: { campos: ['costo'] } })
    await expect(bd.rpc('eliminar_evento', { token, id: e.id })).rejects.toMatchObject({ codigo: 'CON_INSCRITOS' })
    const r = await bd.rpc('cancelar_evento', { token, id: e.id, motivo: 'Fuerza mayor' })
    expect(r.inscripciones_canceladas).toBe(1)
    expect((await bd.correos('ana@test.pe')).at(-1)!.asunto).toMatch(/Se canceló/)
  })

  it('regla: el costo puede ser cero (evento gratuito)', async () => {
    const { token } = await bd.organizador('org@test.pe')
    expect((await bd.evento(token, { costo: 0 })).costo).toBe(0)
  })

  it('un organizador no edita eventos de otro', async () => {
    const a = await bd.organizador('a@test.pe')
    const b = await bd.organizador('b@test.pe')
    const e = await bd.evento(a.token)
    await expect(bd.rpc('guardar_evento', { ...e, token: b.token, id: e.id })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
  })
})
