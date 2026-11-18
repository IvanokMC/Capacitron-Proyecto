// CAP-92 · Comprobantes privados y revisión de diseño de la HU-16. Rol: DevOps (George).
// Teoría: encapsulación (diap. 20–24): quién ve una captura lo decide la base de datos; LSP (diap. 64–79): las dos
// implementaciones del almacenamiento cumplen el contrato también con un bucket privado; code smells (diap. 33):
// los medios de pago están definidos igual en la base, el diseño y la pantalla.
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { REGLAS } from '../src/lib/almacenamiento/contrato'
import { almacenamientoLocal } from '../src/lib/almacenamiento/local'
import { almacenamientoSupabase, type ClienteStorage } from '../src/lib/almacenamiento/supabase'
import { MEDIOS_PAGO } from '../src/components/PagoReal'
import { PANELES } from '../src/pages/PagarInscripcion'
import { nuevaBd, type Bd } from './bd'

vi.mock('../src/components/MapaLeaflet', () => ({ default: () => null }))

const leer = (r: string) => readFileSync(new URL(r, import.meta.url), 'utf8')
const MIGRACION = leer('../supabase/migrations/20261122000002_bucket_comprobantes.sql')
const FUNCION = leer('../supabase/functions/url-comprobante/index.ts')

describe('CAP-92 quién puede ver una captura (ruta_comprobante_autorizada)', () => {
  let bd: Bd
  let admin: string
  let ana: string
  let org: string
  let ruta: string
  beforeEach(async () => {
    bd = await nuevaBd()
    await bd.cuenta('admin@test.pe')
    await bd.sql(`update capa.usuarios set rol = 'admin' where correo = 'admin@test.pe'`)
    admin = (await bd.rpc('iniciar_sesion', { correo: 'admin@test.pe', password: 'Clave2026x' })).token
    org = (await bd.organizador('org@test.pe')).token
    ana = await bd.cuenta('ana@test.pe')
    await bd.rpc('guardar_config_pagos', { token: admin, yape_qr: 'q.png', yape_titular: 'Organización de prueba' })
    const e = await bd.evento(org, { costo: 80 })
    const ins = (await bd.rpc('inscribirse', { token: ana, evento_id: e.id })).inscripcion
    ruta = `${ins.id}/captura.webp`
    await bd.rpc('registrar_pago_manual', { token: ana, inscripcion_id: ins.id, metodo: 'yape', numero_operacion: '12345678', comprobante: ruta })
  })

  it('la dueña y la administración pueden verla', async () => {
    expect(await bd.rpc('ruta_comprobante_autorizada', { token: ana, ruta })).toEqual({ bucket: 'comprobantes', ruta })
    expect(await bd.rpc('ruta_comprobante_autorizada', { token: admin, ruta })).toEqual({ bucket: 'comprobantes', ruta })
  })

  it('el organizador del evento, otra asistente y un visitante sin sesión no pueden', async () => {
    await expect(bd.rpc('ruta_comprobante_autorizada', { token: org, ruta })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    const luis = await bd.cuenta('luis@test.pe')
    await expect(bd.rpc('ruta_comprobante_autorizada', { token: luis, ruta })).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    await expect(bd.rpc('ruta_comprobante_autorizada', { ruta })).rejects.toThrow()
  })

  it('una ruta que no es de ningún pago no se autoriza', async () => {
    await expect(bd.rpc('ruta_comprobante_autorizada', { token: admin, ruta: 'otra/cosa.png' })).rejects.toMatchObject({ codigo: 'NO_ENCONTRADO' })
  })
})

describe('CAP-92 el bucket privado en Supabase coincide con el módulo', () => {
  it('privado, 3 MB y los mismos tipos que REGLAS.comprobantes', () => {
    expect(MIGRACION).toContain("values ('comprobantes', 'comprobantes', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])")
    expect(REGLAS.comprobantes).toMatchObject({ maxBytes: 3145728, privado: true })
    expect(Object.keys(REGLAS.comprobantes.tipos)).toEqual(['image/jpeg', 'image/png', 'image/webp'])
  })

  it('solo se puede subir a una carpeta con forma de id de inscripción; nadie lee, cambia ni borra con la clave pública', () => {
    expect(MIGRACION).toContain('"comprobantes: subir archivo nuevo"')
    expect(MIGRACION).not.toMatch(/for (select|update|delete)/i)
    expect(MIGRACION).toContain("to_regclass('storage.buckets') is null")
  })

  it('los otros buckets siguen siendo públicos', () => {
    expect(REGLAS.fotos.privado).toBeFalsy()
    expect(REGLAS.eventos.privado).toBeFalsy()
  })
})

describe('CAP-92 lectura con enlace firmado (LSP con las dos implementaciones)', () => {
  const cliente = (): ClienteStorage & { publica: ReturnType<typeof vi.fn> } => {
    const publica = vi.fn((ruta: string) => ({ data: { publicUrl: `https://x.supabase.co/storage/v1/object/public/${ruta}` } }))
    return { publica, storage: { from: () => ({ upload: async () => ({ data: {}, error: null }), getPublicUrl: publica }) } }
  }

  it('en Supabase, un comprobante se pide firmado y nunca con la dirección pública', async () => {
    const c = cliente()
    const firmar = vi.fn(async () => 'https://x.supabase.co/storage/v1/object/sign/comprobantes/a.webp?token=abc')
    expect(await almacenamientoSupabase(c, firmar).url('comprobantes', 'i/a.webp')).toContain('/object/sign/')
    expect(firmar).toHaveBeenCalledWith('comprobantes', 'i/a.webp')
    expect(c.publica).not.toHaveBeenCalled()
  })

  it('sin quien firme, o si la sesión no puede verlo, no hay dirección', async () => {
    expect(await almacenamientoSupabase(cliente()).url('comprobantes', 'i/a.webp')).toBeNull()
    expect(await almacenamientoSupabase(cliente(), async () => { throw new Error('403') }).url('comprobantes', 'i/a.webp')).toBeNull()
  })

  it('las fotos y los flyers siguen con su dirección pública', async () => {
    expect(await almacenamientoSupabase(cliente(), async () => 'firmada').url('eventos', 'e/f.webp')).toContain('/object/public/')
  })

  it('en modo local, el comprobante se sube y se ve igual que los demás archivos', async () => {
    const alm = almacenamientoLocal({ persistir: false })
    const ruta = await alm.subir('comprobantes', 'i/a.png', new Blob([new Uint8Array(10)], { type: 'image/png' }))
    expect(await alm.url('comprobantes', ruta)).toEqual(expect.any(String))
  })
})

describe('CAP-92 la Edge Function «url-comprobante»', () => {
  it('pregunta a la base de datos con la sesión y solo después firma, por 60 segundos', () => {
    const pregunta = FUNCION.indexOf("rpc('ruta_comprobante_autorizada'")
    const firma = FUNCION.indexOf('createSignedUrl(data.ruta, SEGUNDOS)')
    expect(pregunta).toBeGreaterThan(-1)
    expect(firma).toBeGreaterThan(pregunta)
    expect(FUNCION).toContain('const SEGUNDOS = 60')
    expect(FUNCION).toContain("return json({ error: 'No tienes acceso a este comprobante.' }, 403)")
  })

  it('la clave de servicio solo se lee en el servidor, nunca en el código del navegador', () => {
    expect(FUNCION).toContain("Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')")
    for (const f of ['../src/lib/almacenamiento/index.ts', '../src/lib/almacenamiento/supabase.ts', '../src/lib/backend/index.ts']) {
      expect(leer(f)).not.toContain('SERVICE_ROLE')
    }
  })
})

describe('CAP-92 revisión de diseño de la HU-16', () => {
  it('code smells (diap. 33): los medios de pago son los mismos en la base, el diseño y la pantalla', () => {
    const sql = leer('../supabase/migrations/20261122000001_pagos_manuales.sql')
    const manuales = ['yape', 'transferencia', 'whatsapp']
    expect(MEDIOS_PAGO.map((m) => m.medio)).toEqual(manuales)
    expect(Object.keys(PANELES).sort()).toEqual([...manuales].sort())
    for (const m of manuales) expect(sql).toContain(`then '${m}' end`)
  })

  it('la pasarela simulada responde solo en modo demostración (Sprint 1) y la pantalla solo la ofrece ahí', () => {
    expect(leer('../supabase/migrations/20261005000006_endurecimiento.sql')).toContain("'PASARELA_DESACTIVADA'")
    expect(leer('../src/pages/PagarInscripcion.tsx')).toContain('{sistema?.modo_demo && (')
  })

  it('Adapter (diap. 126–132): la pasarela simulada vive en un solo componente, el punto que se reemplaza por una externa', () => {
    expect(leer('../src/pages/MisInscripciones.tsx')).not.toContain('respuesta_pasarela')
    expect(leer('../src/components/PasarelaSimulada.tsx')).toContain("api<{ ok: boolean; mensaje?: string; pago?: Pago }>('respuesta_pasarela'")
  })
})
