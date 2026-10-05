-- CAPACITRON · Esquema de datos
-- Portable: corre igual en Supabase (Postgres 15+) y en PGlite (modo local del navegador).
-- Las tablas viven en el esquema privado "capa", que no se expone por la API REST.
-- El frontend solo llama funciones RPC del esquema "public" (ver 20261005000002_funciones.sql).

create extension if not exists pgcrypto with schema extensions;

create schema if not exists capa;

-- ---------------------------------------------------------------------------
-- Configuración y reloj de demostración
-- ---------------------------------------------------------------------------

create table capa.config (
  id               int primary key default 1 check (id = 1),
  modo_demo        boolean not null default true,
  reloj_offset     interval not null default interval '0',
  actualizado_en   timestamptz not null default now()
);
insert into capa.config (id) values (1);

-- Hora "de negocio" del sistema. En modo demo se puede adelantar para mostrar
-- recordatorios, vencimientos de pago, cierre de encuestas, etc.
create function capa.ahora() returns timestamptz
language sql stable as $$
  select now() + coalesce((select reloj_offset from capa.config where id = 1), interval '0')
$$;

-- Fecha legible en español, hora de Perú (UTC-5).
create function capa.fmt_fecha(ts timestamptz, con_hora boolean default true) returns text
language plpgsql immutable as $$
declare
  l timestamp := ts at time zone 'America/Lima';
  dias text[] := array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                        'septiembre','octubre','noviembre','diciembre'];
  r text;
begin
  if ts is null then return null; end if;
  r := dias[extract(dow from l)::int + 1] || ' ' || extract(day from l)::int || ' de '
       || meses[extract(month from l)::int] || ' de ' || extract(year from l)::int;
  if con_hora then
    r := r || ', ' || to_char(l, 'HH24:MI') || ' h';
  end if;
  return r;
end $$;

create function capa.fmt_monto(m numeric) returns text
language sql immutable as $$
  select 'S/ ' || to_char(coalesce(m, 0), 'FM999G990D00')
$$;

-- ---------------------------------------------------------------------------
-- Planes, instituciones y usuarios (HU-01, HU-13)
-- ---------------------------------------------------------------------------

create table capa.planes (
  codigo               text primary key check (codigo in ('basico', 'pro', 'enterprise')),
  nombre               text not null,
  orden                int not null,
  precio_mensual       numeric(10, 2) not null check (precio_mensual >= 0),
  max_eventos_activos  int check (max_eventos_activos is null or max_eventos_activos > 0),
  max_cupo_evento      int check (max_cupo_evento is null or max_cupo_evento > 0),
  permite_pagos        boolean not null default false,
  permite_virtual      boolean not null default false,
  permite_exportar     boolean not null default false,
  permite_encuestas    boolean not null default false,
  actualizado_en       timestamptz not null default now()
);

insert into capa.planes values
  ('basico',     'Básico',     1,   0, 3,    100,  false, false, false, false, now()),
  ('pro',        'Pro',        2, 149, 20,   500,  true,  true,  true,  true,  now()),
  ('enterprise', 'Enterprise', 3, 490, null, null, true,  true,  true,  true,  now());

create table capa.instituciones (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null check (length(trim(nombre)) > 1),
  siglas             text,
  plan_codigo        text not null default 'basico' references capa.planes (codigo),
  estado             text not null default 'activa' check (estado in ('activa', 'suspendida')),
  motivo_suspension  text,
  creado_en          timestamptz not null default now()
);
create unique index instituciones_nombre_uq on capa.instituciones (lower(nombre));

create table capa.usuarios (
  id                     uuid primary key default gen_random_uuid(),
  nombres                text not null check (length(trim(nombres)) > 0),
  apellidos              text not null check (length(trim(apellidos)) > 0),
  correo                 text not null,
  password_hash          text not null,
  rol                    text not null check (rol in ('asistente', 'organizador', 'ponente', 'admin')),
  institucion_id         uuid references capa.instituciones (id),
  estado                 text not null default 'pendiente' check (estado in ('pendiente', 'activa', 'suspendida')),
  motivo_suspension      text,
  intentos_fallidos      int not null default 0,
  bloqueado_hasta        timestamptz,
  recordatorios_activos  boolean not null default true,
  acepto_privacidad_en   timestamptz not null,
  confirmado_en          timestamptz,
  creado_en              timestamptz not null default now()
);
create unique index usuarios_correo_uq on capa.usuarios (lower(correo));

create table capa.tokens_confirmacion (
  token       text primary key,
  usuario_id  uuid not null references capa.usuarios (id) on delete cascade,
  expira_en   timestamptz not null,
  usado_en    timestamptz
);

create table capa.sesiones (
  token_hash  text primary key,
  usuario_id  uuid not null references capa.usuarios (id) on delete cascade,
  creado_en   timestamptz not null default now(),
  expira_en   timestamptz not null,
  revocada    boolean not null default false
);
create index sesiones_usuario_idx on capa.sesiones (usuario_id);

-- ---------------------------------------------------------------------------
-- Eventos, ponentes y programa (HU-02, HU-11, HU-12)
-- ---------------------------------------------------------------------------

create table capa.eventos (
  id                        uuid primary key default gen_random_uuid(),
  organizador_id            uuid not null references capa.usuarios (id),
  institucion_id            uuid references capa.instituciones (id),
  nombre                    text not null,
  descripcion               text not null,
  fecha_inicio              timestamptz not null,
  fecha_fin                 timestamptz not null,
  modalidad                 text not null check (modalidad in ('presencial', 'virtual', 'mixta')),
  lugar                     text,
  enlace_virtual            text,
  enlace_plataforma         text check (enlace_plataforma in ('zoom', 'meet', 'teams')),
  cupo_maximo               int not null check (cupo_maximo > 0),
  costo                     numeric(10, 2) not null default 0 check (costo >= 0),
  porcentaje_minimo         int not null default 80 check (porcentaje_minimo between 1 and 100),
  horas_academicas          int not null check (horas_academicas > 0),
  firmante_nombre           text,
  firmante_cargo            text,
  estado                    text not null default 'borrador' check (estado in ('borrador', 'publicado', 'cancelado')),
  motivo_cancelacion        text,
  publicado_en              timestamptz,
  cancelado_en              timestamptz,
  certificados_emitidos_en  timestamptz,
  creado_en                 timestamptz not null default now(),
  actualizado_en            timestamptz not null default now(),
  check (fecha_fin > fecha_inicio)
);
create index eventos_organizador_idx on capa.eventos (organizador_id);
create index eventos_estado_fecha_idx on capa.eventos (estado, fecha_inicio);

create table capa.ponentes (
  id              uuid primary key default gen_random_uuid(),
  evento_id       uuid not null references capa.eventos (id) on delete cascade,
  nombre          text not null check (length(trim(nombre)) > 0),
  correo          text,
  foto            text,
  biografia       text not null default '',
  consentimiento  boolean not null check (consentimiento),
  usuario_id      uuid references capa.usuarios (id),
  orden           int not null default 0,
  creado_en       timestamptz not null default now()
);
create index ponentes_evento_idx on capa.ponentes (evento_id);

create table capa.sesiones_programa (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references capa.eventos (id) on delete cascade,
  titulo       text not null check (length(trim(titulo)) > 0),
  descripcion  text not null default '',
  inicio       timestamptz not null,
  fin          timestamptz not null,
  check (fin > inicio)
);
create index sesiones_programa_evento_idx on capa.sesiones_programa (evento_id, inicio);

create table capa.sesion_ponentes (
  sesion_id   uuid not null references capa.sesiones_programa (id) on delete cascade,
  ponente_id  uuid not null references capa.ponentes (id) on delete cascade,
  primary key (sesion_id, ponente_id)
);

-- ---------------------------------------------------------------------------
-- Inscripciones, lista de espera y pagos (HU-03, HU-04, HU-05)
-- ---------------------------------------------------------------------------

create table capa.inscripciones (
  id                  uuid primary key default gen_random_uuid(),
  evento_id           uuid not null references capa.eventos (id),
  usuario_id          uuid not null references capa.usuarios (id),
  estado              text not null check (estado in ('pendiente_pago', 'confirmada', 'cancelada', 'expirada')),
  -- El QR solo lleva este identificador aleatorio: ningún dato personal (HU-07).
  codigo_qr           text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  monto               numeric(10, 2) not null default 0,
  reserva_expira_en   timestamptz,
  motivo_cancelacion  text,
  creado_en           timestamptz not null default now(),
  confirmado_en       timestamptz,
  cancelado_en        timestamptz
);
-- Una persona no puede tener dos inscripciones vigentes en el mismo evento (HU-03 CA-02).
create unique index inscripciones_vigente_uq on capa.inscripciones (evento_id, usuario_id)
  where estado in ('pendiente_pago', 'confirmada');
create index inscripciones_usuario_idx on capa.inscripciones (usuario_id);

create table capa.lista_espera (
  id                uuid primary key default gen_random_uuid(),
  evento_id         uuid not null references capa.eventos (id),
  usuario_id        uuid not null references capa.usuarios (id),
  estado            text not null default 'esperando'
                    check (estado in ('esperando', 'ofrecido', 'aceptado', 'expirado', 'retirado')),
  solicitado_en     timestamptz not null,
  ofrecido_en       timestamptz,
  oferta_expira_en  timestamptz,
  resuelto_en       timestamptz
);
create unique index lista_espera_vigente_uq on capa.lista_espera (evento_id, usuario_id)
  where estado in ('esperando', 'ofrecido');
create index lista_espera_orden_idx on capa.lista_espera (evento_id, solicitado_en);

create sequence capa.comprobante_seq start 1001;

create table capa.pagos (
  id                   uuid primary key default gen_random_uuid(),
  inscripcion_id       uuid not null references capa.inscripciones (id),
  evento_id            uuid not null references capa.eventos (id),
  usuario_id           uuid not null references capa.usuarios (id),
  metodo               text not null check (metodo in ('yape', 'plin', 'paypal')),
  monto                numeric(10, 2) not null check (monto > 0),
  estado               text not null default 'procesando'
                       check (estado in ('procesando', 'confirmado', 'rechazado', 'sin_respuesta', 'reembolsado')),
  referencia_externa   text,
  numero_comprobante   text unique,
  mensaje              text,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now()
);
create index pagos_evento_idx on capa.pagos (evento_id);

-- ---------------------------------------------------------------------------
-- Asistencia, certificados y verificación (HU-07, HU-08, HU-09)
-- ---------------------------------------------------------------------------

create table capa.asistencias (
  id              uuid primary key default gen_random_uuid(),
  inscripcion_id  uuid not null references capa.inscripciones (id),
  evento_id       uuid not null references capa.eventos (id),
  jornada         date not null,
  registrado_en   timestamptz not null,
  registrado_por  uuid not null references capa.usuarios (id),
  unique (inscripcion_id, jornada)
);
create index asistencias_evento_idx on capa.asistencias (evento_id);

create table capa.certificados (
  id                     uuid primary key default gen_random_uuid(),
  codigo                 text not null unique,
  inscripcion_id         uuid not null unique references capa.inscripciones (id),
  evento_id              uuid not null references capa.eventos (id),
  usuario_id             uuid not null references capa.usuarios (id),
  titular_nombre         text not null,
  porcentaje_asistencia  numeric(5, 2) not null,
  emitido_en             timestamptz not null,
  estado                 text not null default 'valido' check (estado in ('valido', 'revocado')),
  revocado_en            timestamptz,
  motivo_revocacion      text,
  revocado_por           uuid references capa.usuarios (id)
);

create table capa.verificaciones (
  id                 bigint generated always as identity primary key,
  codigo_consultado  text not null,
  solicitante        text not null,
  resultado          text not null check (resultado in ('valido', 'revocado', 'no_encontrado', 'bloqueado')),
  creado_en          timestamptz not null
);
create index verificaciones_solicitante_idx on capa.verificaciones (solicitante, creado_en);

create table capa.bloqueos_verificacion (
  solicitante     text primary key,
  bloqueado_hasta timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Correos simulados y recordatorios (HU-01, HU-03, HU-06)
-- ---------------------------------------------------------------------------

create table capa.correos (
  id            uuid primary key default gen_random_uuid(),
  orden         bigint generated always as identity,
  usuario_id    uuid references capa.usuarios (id) on delete set null,
  para          text not null,
  asunto        text not null,
  cuerpo        text not null,
  tipo          text not null,
  evento_id     uuid references capa.eventos (id) on delete set null,
  accion_texto  text,
  accion_url    text,
  enviado_en    timestamptz not null,
  leido         boolean not null default false
);
create index correos_para_idx on capa.correos (lower(para), enviado_en desc);
create index correos_usuario_idx on capa.correos (usuario_id, enviado_en desc);

-- La clave incluye la fecha del evento: si el organizador la cambia, los
-- recordatorios se vuelven a programar con la fecha nueva (HU-06 CA-05).
create table capa.recordatorios_enviados (
  inscripcion_id    uuid not null references capa.inscripciones (id),
  tipo              text not null check (tipo in ('24h', '1h')),
  fecha_evento_ref  timestamptz not null,
  enviado_en        timestamptz not null,
  primary key (inscripcion_id, tipo, fecha_evento_ref)
);

-- ---------------------------------------------------------------------------
-- Encuestas (HU-14)
-- ---------------------------------------------------------------------------

create table capa.encuestas (
  evento_id    uuid primary key references capa.eventos (id) on delete cascade,
  anonima      boolean not null default true,
  preguntas    jsonb not null check (jsonb_typeof(preguntas) = 'array'
                                     and jsonb_array_length(preguntas) between 1 and 10),
  enviada_en   timestamptz,
  cierra_en    timestamptz,
  creado_en    timestamptz not null default now()
);

create table capa.encuesta_respuestas (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references capa.encuestas (evento_id) on delete cascade,
  usuario_id  uuid not null references capa.usuarios (id),
  puntajes    jsonb not null,
  comentario  text,
  creado_en   timestamptz not null,
  unique (evento_id, usuario_id)
);

-- ---------------------------------------------------------------------------
-- Historial administrativo inmutable (HU-13 CA-05)
-- ---------------------------------------------------------------------------

create table capa.auditoria (
  id           bigint generated always as identity primary key,
  actor_id     uuid,
  actor_nombre text not null,
  accion       text not null,
  entidad      text not null,
  entidad_id   text,
  detalle      text not null,
  creado_en    timestamptz not null
);

create function capa.auditoria_inmutable() returns trigger
language plpgsql as $$
begin
  raise exception 'El historial administrativo no se puede modificar ni borrar.';
end $$;

create trigger auditoria_sin_cambios
  before update or delete on capa.auditoria
  for each row execute function capa.auditoria_inmutable();

-- ---------------------------------------------------------------------------
-- Señal de actividad para el panel en tiempo real (HU-10 CA-02)
-- Tabla pública sin datos personales: solo un contador por evento.
-- Supabase Realtime la escucha; en modo local, la consulta "live" de PGlite.
-- ---------------------------------------------------------------------------

create table public.actividad_eventos (
  evento_id       uuid primary key,
  version         bigint not null default 1,
  actualizado_en  timestamptz not null default now()
);

create function capa.marcar_actividad() returns trigger
language plpgsql security definer set search_path = capa, public as $$
declare
  ev uuid;
begin
  ev := coalesce(
    case when tg_op = 'DELETE' then (to_jsonb(old) ->> 'evento_id') else (to_jsonb(new) ->> 'evento_id') end,
    null)::uuid;
  if ev is not null then
    insert into public.actividad_eventos as a (evento_id) values (ev)
    on conflict (evento_id) do update set version = a.version + 1, actualizado_en = now();
  end if;
  return null;
end $$;

create trigger actividad_inscripciones after insert or update on capa.inscripciones
  for each row execute function capa.marcar_actividad();
create trigger actividad_pagos after insert or update on capa.pagos
  for each row execute function capa.marcar_actividad();
create trigger actividad_asistencias after insert on capa.asistencias
  for each row execute function capa.marcar_actividad();
create trigger actividad_espera after insert or update on capa.lista_espera
  for each row execute function capa.marcar_actividad();
create trigger actividad_respuestas after insert on capa.encuesta_respuestas
  for each row execute function capa.marcar_actividad();
create trigger actividad_certificados after insert or update on capa.certificados
  for each row execute function capa.marcar_actividad();
