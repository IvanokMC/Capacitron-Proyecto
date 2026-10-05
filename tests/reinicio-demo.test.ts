import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { nuevaBd } from './bd'
it('reiniciar_demo.sql deja la demo como recién sembrada', async () => {
  const bd = await nuevaBd({ demo: true })
  await bd.rpc('registrar_usuario', { nombres: 'X', apellidos: 'Y', correo: 'x@y.pe', password: 'Clave2026x', acepta_privacidad: true })
  await bd.db.exec(readFileSync(new URL('../supabase/reiniciar_demo.sql', import.meta.url), 'utf8'))
  const [{ n }] = await bd.sql(`select count(*)::int n from capa.usuarios`)
  expect(n).toBe(21)
  const [{ r }] = await bd.sql(`select count(*)::int r from capa.certificados where estado = 'revocado'`)
  expect(r).toBe(1)
})
