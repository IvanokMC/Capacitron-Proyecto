import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let id: string
beforeEach(async () => {
  bd = await nuevaBd()
  const { token } = await bd.organizador('org@test.pe')
  id = (await bd.evento(token)).id
})

const actualizar = (campo: string, valor: unknown) =>
  bd.sql(`update capa.eventos set ${campo} = $1 where id = $2`, [valor, id])

describe('CAP-76 Campos tipo, organizador, contacto y consentimiento', () => {
  it('un evento sin los campos nuevos se sigue guardando y no tiene consentimiento', async () => {
    const [e] = await bd.sql(`select tipo, organizador_nombre, contacto, contacto_consentimiento from capa.eventos where id = $1`, [id])
    expect(e).toEqual({ tipo: null, organizador_nombre: null, contacto: null, contacto_consentimiento: false })
  })

  it('tipo acepta seminario, congreso, taller y curso, y rechaza otros valores', async () => {
    for (const tipo of ['seminario', 'congreso', 'taller', 'curso']) await actualizar('tipo', tipo)
    await expect(actualizar('tipo', 'charla')).rejects.toThrow()
  })

  it('organizador y contacto no aceptan texto vacío', async () => {
    await expect(actualizar('organizador_nombre', '   ')).rejects.toThrow()
    await expect(actualizar('contacto', '')).rejects.toThrow()
  })

  it('el contacto no aparece en el catálogo ni en el detalle público', async () => {
    await actualizar('contacto', 'privado@test.pe')
    const publico = JSON.stringify([await bd.rpc('catalogo_eventos'), await bd.rpc('detalle_evento', { id })])
    expect(publico).toContain(id)
    expect(publico).not.toContain('privado@test.pe')
  })
})
