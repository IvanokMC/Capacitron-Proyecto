export type Rol = 'asistente' | 'organizador' | 'ponente' | 'admin'
export type Modalidad = 'presencial' | 'virtual' | 'mixta'
export type FaseEvento = 'borrador' | 'cancelado' | 'proximo' | 'en_curso' | 'finalizado'
export type EstadoInscripcion = 'pendiente_pago' | 'confirmada' | 'cancelada' | 'expirada'
export type MetodoPago = 'yape' | 'plin' | 'paypal'

export interface Plan {
  codigo: 'basico' | 'pro' | 'enterprise'
  nombre: string
  orden: number
  precio_mensual: number
  max_eventos_activos: number | null
  max_cupo_evento: number | null
  permite_pagos: boolean
  permite_virtual: boolean
  permite_exportar: boolean
  permite_encuestas: boolean
}

export interface Usuario {
  id: string
  nombres: string
  apellidos: string
  nombre_completo: string
  correo: string
  rol: Rol
  estado: string
  recordatorios_activos: boolean
  institucion: { id: string; nombre: string; siglas: string | null; estado: string; plan: Plan } | null
}

export interface Evento {
  id: string
  nombre: string
  descripcion: string
  fecha_inicio: string
  fecha_fin: string
  modalidad: Modalidad
  lugar: string | null
  cupo_maximo: number
  cupos_ocupados: number
  cupos_disponibles: number
  en_espera: number
  costo: number
  porcentaje_minimo: number
  horas_academicas: number
  firmante_nombre: string | null
  firmante_cargo: string | null
  estado: 'borrador' | 'publicado' | 'cancelado'
  fase: FaseEvento
  motivo_cancelacion: string | null
  total_jornadas: number
  tiene_enlace: boolean
  enlace_plataforma: 'zoom' | 'meet' | 'teams' | null
  enlace_virtual?: string | null
  organizador_id: string
  organizador: string
  institucion: { id: string; nombre: string; siglas: string | null } | null
  ponentes_resumen: string[]
}

export interface Inscripcion {
  id: string
  evento_id: string
  estado: EstadoInscripcion
  codigo_qr: string | null
  monto: number
  reserva_expira_en: string | null
  creado_en: string
  confirmado_en: string | null
  cancelado_en: string | null
  motivo_cancelacion: string | null
}

export interface Pago {
  id: string
  inscripcion_id: string
  metodo: MetodoPago
  monto: number
  estado: 'procesando' | 'confirmado' | 'rechazado' | 'sin_respuesta' | 'reembolsado'
  referencia_externa: string | null
  numero_comprobante: string | null
  mensaje: string | null
  creado_en: string
}

export interface Ponente {
  id: string
  nombre: string
  foto: string | null
  biografia: string
}

export interface SesionPrograma {
  id: string
  titulo: string
  descripcion: string
  inicio: string
  fin: string
  ponentes: { id: string; nombre: string }[]
}

export interface EventoDetalle extends Evento {
  es_organizador: boolean
  es_ponente: boolean
  ponentes: Ponente[]
  sesiones: SesionPrograma[]
  mi_inscripcion: Inscripcion | null
  mi_lista_espera: { id: string; estado: 'esperando' | 'ofrecido'; oferta_expira_en: string | null; posicion: number } | null
}

export interface MiInscripcion extends Inscripcion {
  evento: Evento
  pagos: Pago[]
  jornadas_asistidas: number
  porcentaje_asistencia: number
  certificado: { id: string; codigo: string; estado: 'valido' | 'revocado'; emitido_en: string; revocado_en: string | null } | null
  encuesta: { enviada: boolean; cierra_en: string | null; cerrada: boolean; respondida: boolean; invitado: boolean } | null
  puede_cancelar: boolean
  recordatorios: { tipo: '24h' | '1h'; programado_para: string; enviado: boolean }[]
}

export interface MiEspera {
  id: string
  estado: 'esperando' | 'ofrecido'
  solicitado_en: string
  oferta_expira_en: string | null
  posicion: number
  evento: Evento
}

export interface Correo {
  id: string
  para: string
  asunto: string
  cuerpo: string
  tipo: string
  evento_id: string | null
  accion_texto: string | null
  accion_url: string | null
  enviado_en: string
  leido: boolean
}

export interface CertificadoDatos {
  id: string
  codigo: string
  titular: string
  estado: 'valido' | 'revocado'
  emitido_en: string
  revocado_en: string | null
  motivo_revocacion: string | null
  porcentaje_asistencia: number
  evento: string
  fecha_inicio: string
  fecha_fin: string
  horas_academicas: number
  modalidad: Modalidad
  firmante_nombre: string | null
  firmante_cargo: string | null
  institucion: string | null
}

export interface EventoOrganizador extends Evento {
  inscritos: number
  pendientes_pago: number
  asistentes: number
  ingresos: number
  tiene_inscripciones: boolean
}
