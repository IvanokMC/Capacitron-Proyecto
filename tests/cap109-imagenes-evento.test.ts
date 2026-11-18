// CAP-109 · Flyer e imagen del lugar del evento en la base de datos (HU-20, CA-01 a CA-03 y CA-05).
// Rol: Backend (Carlos). Teoría: refactorizar con pruebas (diap. 140), encapsulación (diap. 20–24) y SRP
// (diap. 39–49): las imágenes se guardan con su propia función y solo las cambia el dueño del evento.
import { beforeEach, describe, expect, it } from 'vitest'
import { nuevaBd, type Bd } from './bd'

let bd: Bd
let token: string
let ev: any
beforeEach(async () => {
  bd = await nuevaBd()
  token = (await bd.organizador('carmen@unsaac.test')).token
  ev = await bd.evento(token)
})
const ruta = (archivo: string, eventoId = ev.id) => `${eventoId}/${archivo}`
const guardar = (extra: Record<string, unknown>, t = token, id = ev.id) => bd.rpc<any>('guardar_imagenes_evento', { token: t, id, ...extra })
const detalle = (id = ev.id) => bd.rpc<any>('detalle_evento', { id })
const fila = async (id = ev.id) => (await bd.rpc<any[]>('catalogo_eventos', {})).find((e) => e.id === id)

describe('CAP-109 CA-01 y CA-02: guardar el flyer y la imagen del lugar', () => {
  it('guarda las rutas y las descripciones, y las devuelve el evento', async () => {
    const r = await guardar({ flyer_url: ruta('flyer.webp'), flyer_alt: 'Afiche del taller', imagen_lugar_url: ruta('lugar.jpg'), imagen_lugar_alt: 'Entrada del auditorio' })
    expect(r.evento).toMatchObject({ flyer_url: ruta('flyer.webp'), flyer_alt: 'Afiche del taller', imagen_lugar_url: ruta('lugar.jpg'), imagen_lugar_alt: 'Entrada del auditorio' })
  })

  it('un evento nuevo no tiene imágenes', async () => {
    expect(await detalle()).toMatchObject({ flyer_url: null, flyer_alt: null, imagen_lugar_url: null, imagen_lugar_alt: null })
  })

  it('cambiar el flyer no toca la imagen del lugar (una clave ausente no se toca)', async () => {
    await guardar({ flyer_url: ruta('flyer-1.png'), imagen_lugar_url: ruta('lugar.jpg') })
    await guardar({ flyer_url: ruta('flyer-2.png') })
    expect(await detalle()).toMatchObject({ flyer_url: ruta('flyer-2.png'), imagen_lugar_url: ruta('lugar.jpg') })
  })

  it('quitar una imagen la deja en null y borra su descripción', async () => {
    await guardar({ flyer_url: ruta('flyer.png'), flyer_alt: 'Afiche' })
    const r = await guardar({ flyer_url: '' })
    expect(r.evento).toMatchObject({ flyer_url: null, flyer_alt: null })
  })

  it('cambiar solo la descripción conserva la imagen', async () => {
    await guardar({ imagen_lugar_url: ruta('lugar.jpg'), imagen_lugar_alt: 'Entrada' })
    await guardar({ imagen_lugar_alt: 'Entrada principal, junto al estacionamiento' })
    expect(await detalle()).toMatchObject({ imagen_lugar_url: ruta('lugar.jpg'), imagen_lugar_alt: 'Entrada principal, junto al estacionamiento' })
  })

  it('una descripción sin imagen no se guarda suelta', async () => {
    const r = await guardar({ flyer_alt: 'Afiche sin archivo' })
    expect(r.evento.flyer_alt).toBeNull()
  })

  it('guardar las imágenes no obliga a reenviar los demás datos del evento (SRP)', async () => {
    const antes = await detalle()
    await guardar({ flyer_url: ruta('flyer.webp') })
    const despues = await detalle()
    expect({ ...despues, flyer_url: null }).toMatchObject({ nombre: antes.nombre, lugar: antes.lugar, latitud: antes.latitud, cupo_maximo: antes.cupo_maximo })
  })
})

describe('CAP-109 CA-03: las imágenes se ven sin iniciar sesión', () => {
  it('el catálogo y la página del evento las devuelven a un visitante', async () => {
    await guardar({ flyer_url: ruta('flyer.webp'), flyer_alt: 'Afiche', imagen_lugar_url: ruta('lugar.jpg') })
    expect(await fila()).toMatchObject({ flyer_url: ruta('flyer.webp'), flyer_alt: 'Afiche', imagen_lugar_url: ruta('lugar.jpg') })
    expect(await detalle()).toMatchObject({ flyer_url: ruta('flyer.webp'), imagen_lugar_url: ruta('lugar.jpg') })
  })
})

describe('CAP-109 CA-05: solo el organizador del evento cambia sus imágenes', () => {
  it('otro organizador no puede', async () => {
    const otro = (await bd.organizador('jorge@iac.test')).token
    await expect(guardar({ flyer_url: ruta('flyer.png') }, otro)).rejects.toMatchObject({ codigo: 'PROHIBIDO' })
    expect((await detalle()).flyer_url).toBeNull()
  })

  it('un asistente no puede', async () => {
    const ana = await bd.cuenta('ana@test.pe')
    await expect(guardar({ flyer_url: ruta('flyer.png') }, ana)).rejects.toBeTruthy()
  })

  it('sin sesión no se puede', async () => {
    await expect(bd.rpc('guardar_imagenes_evento', { id: ev.id, flyer_url: ruta('flyer.png') })).rejects.toMatchObject({ codigo: 'NO_AUTH' })
  })

  it('no se puede usar un archivo de la carpeta de otro evento, aunque sea suyo', async () => {
    const otroEvento = await bd.evento(token, { nombre: 'Otro evento' })
    await expect(guardar({ flyer_url: ruta('flyer.png', otroEvento.id) })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['flyer_url'] } })
  })

  it('un evento cancelado ya no se edita', async () => {
    await bd.rpc('cancelar_evento', { token, id: ev.id, motivo: 'Falta de ponente' })
    await expect(guardar({ flyer_url: ruta('flyer.png') })).rejects.toThrow('cancelado')
  })
})

describe('CAP-109 formato de la ruta y de la descripción', () => {
  it.each([['flyer.gif'], ['flyer.pdf'], ['carpeta/otra/flyer.png'], ['FLYER CON ESPACIOS.png']])('«%s» no es una ruta válida', async (archivo) => {
    await expect(guardar({ imagen_lugar_url: ruta(archivo) })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['imagen_lugar_url'] } })
  })

  it('una URL completa no se acepta: se guarda la ruta, no la dirección del proveedor', async () => {
    await expect(guardar({ flyer_url: `https://x.supabase.co/storage/v1/object/public/eventos/${ev.id}/flyer.png` }))
      .rejects.toMatchObject({ codigo: 'CAMPOS' })
  })

  it('una descripción de más de 200 caracteres se rechaza', async () => {
    await expect(guardar({ flyer_url: ruta('flyer.png'), flyer_alt: 'a'.repeat(201) })).rejects.toMatchObject({ codigo: 'CAMPOS', detalle: { campos: ['flyer_alt'] } })
  })

  it('la tabla también lo impide si alguien escribe directo', async () => {
    await expect(bd.sql(`update capa.eventos set flyer_url = 'cualquier-cosa' where id = $1`, [ev.id])).rejects.toThrow()
  })
})
