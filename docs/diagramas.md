# Diagramas de CAPACITRON

GitHub dibuja estos diagramas (Mermaid) directamente al abrir el archivo. Para adjuntarlos como PNG, ábrelos en <https://mermaid.live>, pega el bloque y descarga la imagen.

## 1. Modelo entidad-relación (esquema `capa`)

Fuente: [supabase/migrations/20261005000001_esquema.sql](../supabase/migrations/20261005000001_esquema.sql).

```mermaid
erDiagram
  PLANES ||--o{ INSTITUCIONES : "define límites de"
  INSTITUCIONES ||--o{ USUARIOS : "agrupa organizadores"
  INSTITUCIONES ||--o{ EVENTOS : "publica"
  USUARIOS ||--o{ EVENTOS : "organiza"
  USUARIOS ||--o{ SESIONES : "inicia"
  USUARIOS ||--o{ TOKENS_CONFIRMACION : "confirma con"
  EVENTOS ||--o{ PONENTES : "presenta"
  EVENTOS ||--o{ SESIONES_PROGRAMA : "tiene"
  SESIONES_PROGRAMA ||--o{ SESION_PONENTES : "asigna"
  PONENTES ||--o{ SESION_PONENTES : "dicta"
  EVENTOS ||--o{ INSCRIPCIONES : "recibe"
  USUARIOS ||--o{ INSCRIPCIONES : "se inscribe"
  EVENTOS ||--o{ LISTA_ESPERA : "ordena"
  USUARIOS ||--o{ LISTA_ESPERA : "espera"
  INSCRIPCIONES ||--o{ PAGOS : "se paga con"
  INSCRIPCIONES ||--o{ ASISTENCIAS : "registra por jornada"
  INSCRIPCIONES ||--o| CERTIFICADOS : "emite"
  INSCRIPCIONES ||--o{ RECORDATORIOS_ENVIADOS : "recuerda"
  EVENTOS ||--o| ENCUESTAS : "evalúa"
  ENCUESTAS ||--o{ ENCUESTA_RESPUESTAS : "recibe"
  USUARIOS ||--o{ CORREOS : "recibe"

  PLANES {
    text codigo PK "basico, pro, enterprise"
    numeric precio_mensual
    int max_eventos_activos
    int max_cupo_evento
    bool permite_pagos
    bool permite_virtual
    bool permite_exportar
    bool permite_encuestas
  }
  INSTITUCIONES {
    uuid id PK
    text nombre UK
    text plan_codigo FK
    text estado "activa, suspendida"
  }
  USUARIOS {
    uuid id PK
    text correo UK
    text password_hash "bcrypt"
    text rol "asistente, organizador, ponente, admin"
    uuid institucion_id FK
    text estado "pendiente, activa, suspendida"
    int intentos_fallidos
    timestamptz bloqueado_hasta
    bool recordatorios_activos
  }
  EVENTOS {
    uuid id PK
    uuid organizador_id FK
    uuid institucion_id FK
    text nombre
    timestamptz fecha_inicio
    timestamptz fecha_fin "mayor que inicio"
    text modalidad "presencial, virtual, mixta"
    text enlace_virtual
    int cupo_maximo "mayor que 0"
    numeric costo "0 = gratis"
    int porcentaje_minimo "1 a 100"
    int horas_academicas
    text estado "borrador, publicado, cancelado"
  }
  INSCRIPCIONES {
    uuid id PK
    uuid evento_id FK
    uuid usuario_id FK
    text estado "pendiente_pago, confirmada, cancelada, expirada"
    text codigo_qr UK "sin datos personales"
    timestamptz reserva_expira_en "30 min"
  }
  LISTA_ESPERA {
    uuid id PK
    uuid evento_id FK
    uuid usuario_id FK
    text estado "esperando, ofrecido, aceptado, expirado, retirado"
    timestamptz solicitado_en "orden de la lista"
    timestamptz oferta_expira_en "24 h"
  }
  PAGOS {
    uuid id PK
    uuid inscripcion_id FK
    text metodo "yape, plin, paypal"
    numeric monto
    text estado "procesando, confirmado, rechazado, sin_respuesta, reembolsado"
    text numero_comprobante UK
  }
  ASISTENCIAS {
    uuid id PK
    uuid inscripcion_id FK
    date jornada "UK con inscripcion"
    timestamptz registrado_en
  }
  CERTIFICADOS {
    uuid id PK
    text codigo UK "CAP-XXXX-XXXX-XXXX"
    uuid inscripcion_id FK
    text estado "valido, revocado"
    text motivo_revocacion
  }
  PONENTES {
    uuid id PK
    uuid evento_id FK
    text nombre
    text foto "máx. 1 MB"
    bool consentimiento
  }
  SESIONES_PROGRAMA {
    uuid id PK
    uuid evento_id FK
    text titulo
    timestamptz inicio
    timestamptz fin
  }
  SESION_PONENTES {
    uuid sesion_id PK
    uuid ponente_id PK
  }
  ENCUESTAS {
    uuid evento_id PK
    bool anonima
    jsonb preguntas "1 a 10"
    timestamptz cierra_en "7 días"
  }
  ENCUESTA_RESPUESTAS {
    uuid id PK
    uuid evento_id FK
    uuid usuario_id "UK con evento"
    jsonb puntajes "1 a 5"
  }
  SESIONES { text token_hash PK }
  TOKENS_CONFIRMACION { text token PK }
  RECORDATORIOS_ENVIADOS { uuid inscripcion_id PK }
  CORREOS { uuid id PK }
```

Tablas de apoyo sin relación con las anteriores: `config` (reloj de demostración), `verificaciones` y `bloqueos_verificacion` (HU-09), `auditoria` (historial inmutable, HU-13) y `public.actividad_eventos` (señal de tiempo real, HU-10).

## 2. Secuencia del pago en línea (HU-04)

Fuente: funciones `public.iniciar_pago` y `public.respuesta_pasarela` en [20261005000002_funciones_base.sql](../supabase/migrations/20261005000002_funciones_base.sql) y [20261005000006_endurecimiento.sql](../supabase/migrations/20261005000006_endurecimiento.sql).

```mermaid
sequenceDiagram
  actor A as Asistente
  participant W as App web
  participant DB as Supabase (funciones SQL)
  participant P as Pasarela (Yape, Plin, PayPal)

  A->>W: Inscribirme en evento con costo
  W->>DB: inscribirse
  DB-->>W: inscripción «pendiente_pago», cupo reservado 30 min
  A->>W: Elige medio de pago y paga
  W->>DB: iniciar_pago(método)
  DB-->>W: pago «procesando»
  W->>P: cobro
  alt Cobro aprobado
    P-->>DB: respuesta_pasarela(aprobado)
    DB-->>W: pago «confirmado», inscripción «confirmada», comprobante CP-AAAA-NNNNNN
    DB-)A: correo con el comprobante
  else Rechazado o sin respuesta
    P-->>DB: respuesta_pasarela(rechazado / sin_respuesta)
    DB-->>W: inscripción sigue «pendiente_pago», mensaje y opción de reintentar
  end
  Note over DB: Tarea programada: a los 30 min sin pago, la inscripción vence y el cupo se libera
```

En esta versión la pasarela es un simulador dentro de la app y solo funciona con el modo demostración activo.
