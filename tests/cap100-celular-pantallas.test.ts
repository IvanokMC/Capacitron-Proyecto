// CAP-100 · Celular en el registro, Mi perfil y la lista de inscritos (HU-18, CA-01 a CA-03 y CA-05).
// Rol: Frontend (José). Teoría: refactorizar con pruebas (diap. 140) y duplicación (diap. 33): una sola
// regla del celular para el registro y el perfil, igual a la de la API (CAP-99).
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  enlaceWhatsapp, FALTA_CELULAR, limpiarCelular, MENSAJE_CELULAR, validarCelular, validarCelularPerfil,
} from '../src/lib/celular'
import { nuevaBd, type Bd } from './bd'
// Pantallas importadas al inicio (no dentro de cada prueba): con toda la suite en paralelo, un import dinámico
// de estas páginas puede pasar el tiempo límite de una prueba. Los vi.mock de abajo se aplican igual (vitest los eleva).
import { Registro } from '../src/pages/Cuenta'
import Perfil from '../src/pages/Perfil'
import { TablaInscritos } from '../src/pages/organizador/GestionEvento'

// Las pantallas se dibujan con una sesión de prueba.
const sesion = vi.hoisted(() => ({ usuario: null as any }))
vi.mock('../src/lib/app', () => ({
  useApp: () => ({ usuario: sesion.usuario, api: async () => ({}), refrescarUsuario: async () => {}, sistema: null }),
  useCarga: () => ({ datos: [], cargando: false, error: null }),
}))
vi.mock('../src/components/notificaciones', () => ({ useNotas: () => ({ exito: () => {}, error: () => {} }) }))

describe('CAP-100 regla del celular (una sola para registro y perfil)', () => {
  it('CA-01: 9 dígitos que empiezan con 9; espacios, guiones y +51 se limpian', () => {
    for (const v of ['984123456', '984 123 456', '984-123-456', '+51 984 123 456']) expect(validarCelular(v, true)).toBeNull()
    expect(limpiarCelular('+51 984 123 456')).toBe('984123456')
  })

  it('CA-01: otro formato se rechaza con el mismo texto que da la API', async () => {
    for (const v of ['812345678', '98412345', '9841234567']) expect(validarCelular(v, true)).toBe(MENSAJE_CELULAR)
    const bd = await nuevaBd()
    const [{ m }] = await bd.sql<{ m: string }>(`select capa.mensaje_celular() as m`)
    expect(MENSAJE_CELULAR).toBe(m)
  })

  it('en el registro es obligatorio', () => {
    expect(validarCelular('', true)).toBe(FALTA_CELULAR.registro)
  })

  it('CA-03 en el perfil: una cuenta antigua puede seguir sin celular, salvo que quiera compartirlo', () => {
    expect(validarCelularPerfil('', null, false)).toBeNull()
    expect(validarCelularPerfil('', null, true)).toBe(FALTA_CELULAR.compartirSinCelular)
  })

  it('CA-03 en el perfil: quien ya tiene celular lo puede cambiar pero no borrar', () => {
    expect(validarCelularPerfil('912345678', '984123456', false)).toBeNull()
    expect(validarCelularPerfil('', '984123456', false)).toBe(FALTA_CELULAR.noSeQuita)
    expect(validarCelularPerfil('12', '984123456', true)).toBe(MENSAJE_CELULAR)
  })
})

describe('CAP-100 enlace de WhatsApp (CA-05)', () => {
  it('va a wa.me con el +51 y un saludo con el primer nombre y el evento', () => {
    const url = enlaceWhatsapp('984 123 456', 'Rosa Quispe Mamani', 'Taller de Python')
    expect(url.startsWith('https://wa.me/51984123456?text=')).toBe(true)
    expect(decodeURIComponent(url.split('text=')[1])).toBe('Hola Rosa, te escribo por el evento «Taller de Python» de CAPACITRON.')
  })
})

describe('CAP-100 registro', () => {
  it('pide el celular después del correo y antes de la contraseña, con la casilla de permiso sin marcar', async () => {
    sesion.usuario = null
    const html = renderToStaticMarkup(h(MemoryRouter, null, h(Registro)))
    const iCorreo = html.indexOf('>Correo<')
    const iCelular = html.indexOf('>Celular')
    const iClave = html.indexOf('>Contraseña<')
    expect(iCorreo).toBeGreaterThan(-1)
    expect(iCelular).toBeGreaterThan(iCorreo)
    expect(iClave).toBeGreaterThan(iCelular)
    expect(html).toContain('+51')
    // La casilla de permiso (la que tiene la explicación) empieza sin marcar: consentimiento explícito.
    expect(html).toMatch(/<input type="checkbox" aria-describedby="[^"]*-explica"(?![^>]*checked)[^>]*\/>/)
  })

  it('la política de privacidad menciona el celular y cómo retirar el permiso', async () => {
    const fuente = (await import('node:fs')).readFileSync(new URL('../src/pages/Cuenta.tsx', import.meta.url), 'utf8')
    expect(fuente).toContain('correo, celular, inscripciones')
    expect(fuente).toContain('puedes retirar el permiso desde tu perfil')
  })
})

describe('CAP-100 Mi perfil', () => {
  const base = {
    id: '00000000-0000-4000-8000-000000000001', nombres: 'Ana', apellidos: 'Huamán', nombre_completo: 'Ana Huamán',
    correo: 'ana@test.pe', rol: 'asistente', estado: 'activa', recordatorios_activos: true, foto_url: null, institucion: null,
  }

  it('HU-17 CA-04 y HU-18 CA-03: muestra el celular guardado y si lo comparte', async () => {
    sesion.usuario = { ...base, celular: '984123456', comparte_celular: true }
    const html = renderToStaticMarkup(h(Perfil))
    expect(html).toContain('value="984123456"')
    expect(html).toMatch(/<input type="checkbox" aria-describedby="[^"]*-explica"[^>]*checked=""/)
    expect(html).not.toContain('(opcional)')
  })

  it('una cuenta antigua sin celular lo ve como opcional', async () => {
    sesion.usuario = { ...base, celular: null, comparte_celular: false }
    expect(renderToStaticMarkup(h(Perfil))).toContain('(opcional)')
  })
})

describe('CAP-100 lista de inscritos (CA-02 y CA-05) con la API real (CAP-99)', () => {
  let bd: Bd
  beforeEach(async () => { bd = await nuevaBd() })

  it('con permiso: número y botón de WhatsApp; sin permiso: «No compartido» y sin número', async () => {
    const org = (await bd.organizador('org@test.pe')).token
    const e = await bd.evento(org, { nombre: 'Taller de Python' })
    // Se registran como lo hace la pantalla: celular limpio y la casilla.
    for (const [correo, celular, comparte] of [['rosa@test.pe', '984 111 222', true], ['luis@test.pe', '984 333 444', false]] as const) {
      await bd.rpc('registrar_usuario', {
        nombres: correo.split('@')[0], apellidos: 'Prueba', correo, password: 'Clave2026x', acepta_privacidad: true,
        celular: limpiarCelular(celular), comparte_celular: comparte,
      })
      const [{ token }] = await bd.sql<{ token: string }>(
        `select t.token from capa.tokens_confirmacion t join capa.usuarios u on u.id = t.usuario_id where u.correo = $1`, [correo])
      await bd.rpc('confirmar_cuenta', { token })
      const ses = await bd.rpc<any>('iniciar_sesion', { correo, password: 'Clave2026x' })
      await bd.rpc('inscribirse', { token: ses.token, evento_id: e.id })
    }
    const g = await bd.rpc<any>('evento_gestion', { token: org, id: e.id })
    const html = renderToStaticMarkup(h(TablaInscritos, { filas: g.inscritos, evento: g.nombre }))
    expect(html).toContain('>Celular<')
    expect(html).toContain('984 111 222')
    expect(html).toContain('href="https://wa.me/51984111222?text=')
    expect(html).toContain('aria-label="Escribir por WhatsApp a rosa Prueba"')
    expect(html).toContain('No compartido')
    expect(html).not.toContain('984333444')
    expect(html).not.toContain('984 333 444')
  })
})
