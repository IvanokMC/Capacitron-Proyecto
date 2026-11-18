// Validación de los campos que exige publicar un evento (CAP-77, HU-02 CA-07).
//
// Rol: Frontend (José) · Tarea: CAP-77.
// Teoría de Diseño de Software:
// · SRP y cohesión (diap. 26–28 y 39–49): este módulo solo decide qué falta para publicar;
//   la pantalla solo muestra los errores. Así la regla se prueba sin dibujar el formulario.
// · Code smells / duplicación (diap. 33): la misma regla está en SQL
//   (capa.campos_faltantes_publicacion); aquí se repite solo para avisar antes de enviar,
//   y la API es la que manda si alguien se salta el formulario.

export type TipoEvento = 'seminario' | 'congreso' | 'taller' | 'curso'

export const TIPOS_EVENTO: { valor: TipoEvento; etiqueta: string }[] = [
  { valor: 'seminario', etiqueta: 'Seminario' },
  { valor: 'congreso', etiqueta: 'Congreso' },
  { valor: 'taller', etiqueta: 'Taller' },
  { valor: 'curso', etiqueta: 'Curso' },
]

export interface CamposPublicacion {
  modalidad: string
  tipo: string
  lugar: string
  organizador_nombre: string
  contacto: string
}

export const MENSAJES_PUBLICACION: Record<keyof Omit<CamposPublicacion, 'modalidad'>, string> = {
  tipo: 'Elige el tipo de evento.',
  lugar: 'Indica el lugar del evento presencial o mixto.',
  organizador_nombre: 'Escribe quién organiza el evento.',
  contacto: 'Indica un correo o teléfono de contacto.',
}

/** Campos vacíos que impiden publicar, con su mensaje. Un evento virtual no necesita lugar. */
export function faltantesParaPublicar(f: CamposPublicacion): Record<string, string> {
  const faltan: Record<string, string> = {}
  if (!f.tipo.trim()) faltan.tipo = MENSAJES_PUBLICACION.tipo
  if (f.modalidad !== 'virtual' && !f.lugar.trim()) faltan.lugar = MENSAJES_PUBLICACION.lugar
  if (!f.organizador_nombre.trim()) faltan.organizador_nombre = MENSAJES_PUBLICACION.organizador_nombre
  if (!f.contacto.trim()) faltan.contacto = MENSAJES_PUBLICACION.contacto
  return faltan
}
