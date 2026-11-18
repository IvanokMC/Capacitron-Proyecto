// CAP-108 · Diseño del flyer y de la imagen del lugar (HU-20, CA-01 a CA-03). Rol: Diseño UI/UX (Medaly).
// Diseño completo en docs/diseno/CAP-108-flyer/DISENO.md.
//
// Teoría de Diseño de Software:
// · Cohesión (diap. 26–28): un mismo componente de imagen (`ImagenEvento`) para la tarjeta del catálogo, la
//   página del evento y la imagen del lugar; solo cambia la variante (proporción y recorte).
// · SRP (diap. 39–49): aquí solo se muestra. Validar el archivo y subirlo es del módulo de almacenamiento
//   (CAP-97) a través de CAP-109 y CAP-110; estos componentes reciben la dirección, el error y lo elegido.
// · Evitar sobreingeniería (diap. 135–139): sin editor de imágenes ni recorte; el flyer se muestra entero.
import { useId } from 'react'
import { ArrowsOut, ImageSquare, Trash, UploadSimple, WarningCircle } from '@phosphor-icons/react'
import { Boton, cx, Entrada, Panel } from './ui'
import { BloqueFecha } from './tejido'
import type { FaseEvento } from '../lib/tipos'

export const TEXTOS_IMAGEN = {
  formatos: 'JPG, PNG o WEBP de hasta 3 MB.',
  flyer: 'Flyer del evento',
  lugar: 'Imagen del lugar',
  ayudaFlyer: 'Se muestra en el catálogo y en la página del evento. Se ve entero, sin recortes.',
  ayudaLugar: 'Una foto del auditorio o de la entrada ayuda a llegar. Se muestra junto al mapa.',
  alt: 'Descripción para quien no puede ver la imagen',
  altEjemploFlyer: 'Por ejemplo: Afiche del taller con el título, la fecha y los ponentes',
  altEjemploLugar: 'Por ejemplo: Entrada del auditorio de Ingeniería, junto al estacionamiento',
  verCompleto: 'Ver flyer completo',
  vistaPrevia: 'Vista previa: se guarda al guardar el evento.',
} as const

type Variante = 'tarjeta' | 'cabecera' | 'lugar'
const PROPORCION: Record<Variante, string> = {
  tarjeta: 'aspect-[4/5] w-14', // mismo ancho que el bloque de fecha: los títulos de las filas quedan alineados
  cabecera: 'aspect-[4/5] w-full',
  lugar: 'aspect-[16/9] w-full',
}

/**
 * La imagen en sí. El flyer tiene texto, así que en «tarjeta» y «cabecera» se ve entero (contain) sobre un
 * fondo neutro; la foto del lugar sí se recorta (cover) porque es una escena.
 */
export function ImagenEvento({ src, alt, variante, className }: { src: string; alt: string; variante: Variante; className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-lg bg-hundido', PROPORCION[variante], className)}>
      <img src={src} alt={alt} loading="lazy" decoding="async"
        className={cx('absolute inset-0 size-full', variante === 'lugar' ? 'object-cover' : 'object-contain')} />
    </div>
  )
}

/**
 * Portada de la fila del catálogo (CA-01). Con flyer: la miniatura con el día encima, para no perder la fecha.
 * Sin flyer: el bloque de fecha de siempre. No se inventa una imagen genérica.
 */
export function PortadaTarjeta({ flyer, alt, fecha, fase }: { flyer?: string | null; alt?: string | null; fecha: string; fase?: FaseEvento }) {
  if (!flyer) return <BloqueFecha fecha={fecha} fase={fase} />
  const dia = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).format(new Date(fecha)).replace('.', '')
  return (
    <div className="relative shrink-0">
      <ImagenEvento src={flyer} alt={alt ?? ''} variante="tarjeta" className="ring-1 ring-linea" />
      <span className={cx('num absolute inset-x-1 bottom-1 rounded-md px-1 py-0.5 text-center text-[11px] font-semibold',
        fase === 'en_curso' ? 'bg-chilca text-white' : 'bg-superficie/95 text-tinta')}>{dia}</span>
    </div>
  )
}

/**
 * Flyer en la página del evento, arriba del panel de inscripción (CA-03: el visitante lo ve antes del botón).
 * Sin flyer no se muestra nada.
 */
export function FlyerEvento({ src, alt }: { src?: string | null; alt?: string | null }) {
  if (!src) return null
  return (
    <Panel className="overflow-hidden p-2">
      <ImagenEvento src={src} alt={alt ?? TEXTOS_IMAGEN.flyer} variante="cabecera" />
      <a href={src} target="_blank" rel="noreferrer"
        className="mt-2 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] font-medium text-tinta-2 no-underline hover:bg-hundido">
        <ArrowsOut className="size-4" aria-hidden />{TEXTOS_IMAGEN.verCompleto}
      </a>
    </Panel>
  )
}

/** Imagen del lugar para el hueco `imagen` del bloque de ubicación (CA-02). */
export function ImagenLugar({ src, alt }: { src?: string | null; alt?: string | null }) {
  if (!src) return null
  return <ImagenEvento src={src} alt={alt ?? TEXTOS_IMAGEN.lugar} variante="lugar" className="rounded-none" />
}

/**
 * Carga de una imagen en el formulario del evento: vacío, vista previa, cambiar, quitar, error y texto
 * alternativo. No lee ni valida el archivo: entrega el File con `onElegir` y muestra el `error` que le pasen.
 */
export function CampoImagen({
  etiqueta, ayuda, vista, vistaPrevia = false, onElegir, onQuitar, error, cargando = false,
  alt = '', onAlt, altEjemplo = '', proporcion = 'cabecera', conDescripcion = true,
}: {
  etiqueta: string; ayuda: string; vista?: string | null; vistaPrevia?: boolean
  onElegir: (archivo: File) => void; onQuitar?: () => void; error?: string | null; cargando?: boolean
  alt?: string; onAlt?: (v: string) => void; altEjemplo?: string; proporcion?: 'cabecera' | 'lugar'
  /** CAP-88: una imagen privada (el comprobante de pago) no necesita descripción pública. */
  conDescripcion?: boolean
}) {
  const id = useId()
  return (
    <fieldset className="min-w-0 space-y-3" aria-busy={cargando || undefined}>
      <legend className="text-[13px] font-medium text-tinta-2">{etiqueta}</legend>
      <div className={cx('flex flex-col gap-3 sm:flex-row sm:items-start', error && 'rounded-lg ring-2 ring-error/20')}>
        <div className={cx('relative shrink-0', proporcion === 'lugar' ? 'w-full sm:w-56' : 'w-32')}>
          {vista ? (
            <ImagenEvento src={vista} alt="" variante={proporcion} className={cx('ring-1', error ? 'ring-error' : 'ring-linea')} />
          ) : (
            <div className={cx('grid place-items-center rounded-lg border-2 border-dashed text-tinta-3',
              proporcion === 'lugar' ? 'aspect-[16/9]' : 'aspect-[4/5]', error ? 'border-error/60' : 'border-linea-fuerte')}>
              <ImageSquare className="size-8" aria-hidden />
            </div>
          )}
          {cargando && (
            <span className="absolute inset-0 grid place-items-center rounded-lg bg-tinta/45 text-[12px] font-medium text-white">Subiendo…</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap gap-2">
            <label className={cx('pulsable inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-linea-fuerte bg-superficie px-3 text-[13px] font-medium hover:bg-fondo',
              cargando && 'pointer-events-none opacity-55')}>
              <UploadSimple className="size-4" aria-hidden />{vista ? 'Cambiar' : 'Subir imagen'}
              <input id={id} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={cargando}
                aria-describedby={`${id}-ayuda`}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onElegir(f); e.target.value = '' }} />
            </label>
            {vista && onQuitar && (
              <Boton tamano="sm" variante="peligro" className="h-9" icono={<Trash className="size-4" />} onClick={onQuitar} disabled={cargando}>Quitar</Boton>
            )}
          </div>
          <p id={`${id}-ayuda`} role={error ? 'alert' : undefined}
            className={cx('flex items-start gap-1.5 text-[13px]', error ? 'text-error' : 'text-tinta-3')}>
            {error && <WarningCircle className="mt-px size-4 shrink-0" weight="fill" />}
            {error ?? `${ayuda} ${TEXTOS_IMAGEN.formatos}`}
          </p>
          {vistaPrevia && !error && <p className="text-[13px] font-medium text-qolle-tinta">{TEXTOS_IMAGEN.vistaPrevia}</p>}
          {vista && conDescripcion && (
            <div className="space-y-1">
              <label htmlFor={`${id}-alt`} className="text-[13px] font-medium text-tinta-2">{TEXTOS_IMAGEN.alt}</label>
              <Entrada id={`${id}-alt`} value={alt} onChange={(e) => onAlt?.(e.target.value)} placeholder={altEjemplo} maxLength={200} />
            </div>
          )}
        </div>
      </div>
    </fieldset>
  )
}
