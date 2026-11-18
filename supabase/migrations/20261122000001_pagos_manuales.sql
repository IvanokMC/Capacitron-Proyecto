-- CAPACITRON · Pagos manuales con verificación de la administración (CAP-89, HU-16 Pago real con verificación manual)
-- Portable (Supabase y PGlite). Requiere las migraciones del Sprint 1 y la de CAP-99 (celular).
-- En Supabase se ejecuta en el SQL Editor después de 20261121000001_imagenes_evento.sql.
--
-- Qué cambia:
-- · capa.config_pagos: QR de Yape, banco, cuenta, CCI, titular y WhatsApp de la organización (una sola fila).
-- · capa.pagos: medios «transferencia» y «whatsapp», estado «por_verificar», número de operación, ruta de la captura
--   del comprobante, motivo del rechazo y quién verificó y cuándo.
-- · Funciones: medios_pago (público), registrar_pago_manual (asistente), pagos_por_verificar, aprobar_pago,
--   rechazar_pago y guardar_config_pagos (solo administración, CA-06).
-- · respuesta_pasarela (Sprint 1) no cambia: ya responde solo en modo demostración (20261005000006_endurecimiento.sql).
--
-- La reserva mientras se verifica (CA-02 y CA-05): al registrar el pago, la inscripción sigue «pendiente_pago» y su
-- reserva_expira_en queda en null. Así el vencimiento automático (procesar_tareas_internas, que solo mira reservas con
-- fecha) no libera un cupo cuyo pago está esperando a la administración, sin tener que cambiar esa tarea.
-- · Al aprobar: la inscripción pasa a confirmada.
-- · Al rechazar: vuelve a tener 30 minutos de reserva (los mismos que al inscribirse), para reenviar el comprobante
--   (CA-04). Si no lo hace, el cupo se libera como siempre (CA-05).
--
-- La captura del comprobante es un dato personal (Ley N.° 29733): su ruta solo sale en pagos_por_verificar (administración).
-- capa.pago_json, que también usa el comprobante del organizador, no la incluye. El bucket privado es de CAP-92 (George).
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación (diap. 20–24): el pago solo cambia por estas funciones, que validan el rol y el estado. No hay
--   otra forma de pasar un pago a «confirmado».
-- · OCP (diap. 50–63): los medios manuales y cuándo está disponible cada uno se definen en un solo lugar
--   (capa.medios_disponibles); sumar Plin sería una línea ahí y otra en el check de metodo.
-- · SRP (diap. 39–49): una función por operación (registrar, listar, aprobar, rechazar, configurar).
-- · Code smells / duplicación (diap. 33): el WhatsApp se valida con la regla del celular de CAP-99 y el número de
--   comprobante con la misma secuencia y formato que la pasarela del Sprint 1 (capa.nuevo_numero_comprobante).
--
-- Rol: Backend y base de datos (Carlos) · Tarea: CAP-89 · Historia: HU-16 (CAP-83), criterios CA-02 a CA-06.

-- ---------------------------------------------------------------------------
-- Configuración de pagos de la organización (CA-06)
-- ---------------------------------------------------------------------------
create table capa.config_pagos (
  id              int primary key default 1 check (id = 1),
  yape_qr         text check (char_length(yape_qr) <= 300),
  yape_titular    text check (char_length(yape_titular) <= 120),
  banco           text check (char_length(banco) <= 120),
  cuenta          text check (cuenta ~ '^[0-9]{8,20}$'),
  cci             text check (cci ~ '^[0-9]{20}$'),
  titular         text check (char_length(titular) <= 120),
  whatsapp        text check (whatsapp is null or capa.celular_valido(whatsapp)),
  actualizado_en  timestamptz not null default now(),
  actualizado_por uuid references capa.usuarios (id)
);
insert into capa.config_pagos (id) values (1);

comment on table capa.config_pagos is 'Datos de pago de la organización (HU-16 CA-06). Solo los cambia guardar_config_pagos (administración).';
comment on column capa.config_pagos.yape_qr is 'Ruta o dirección de la imagen del QR de Yape.';
comment on column capa.config_pagos.whatsapp is 'Celular de la organización para coordinar pagos: 9 dígitos que empiezan con 9 (regla de CAP-99).';

-- Medios manuales disponibles según la configuración. Un medio sin sus datos no se ofrece ni se acepta.
create or replace function capa.medios_disponibles(c capa.config_pagos) returns text[]
language sql stable as $$
  select array_remove(array[
    case when c.yape_qr is not null and c.yape_titular is not null then 'yape' end,
    case when c.banco is not null and c.titular is not null and (c.cuenta is not null or c.cci is not null) then 'transferencia' end,
    case when c.whatsapp is not null then 'whatsapp' end
  ], null)
$$;

-- ---------------------------------------------------------------------------
-- Pagos: medios manuales y verificación
-- ---------------------------------------------------------------------------
alter table capa.pagos drop constraint pagos_metodo_check;
alter table capa.pagos add constraint pagos_metodo_check
  check (metodo in ('yape', 'plin', 'paypal', 'transferencia', 'whatsapp'));
alter table capa.pagos drop constraint pagos_estado_check;
alter table capa.pagos add constraint pagos_estado_check
  check (estado in ('procesando', 'por_verificar', 'confirmado', 'rechazado', 'sin_respuesta', 'reembolsado'));

alter table capa.pagos
  add column numero_operacion text check (numero_operacion ~ '^[A-Za-z0-9-]{4,30}$'),
  add column comprobante_ruta text,
  add column motivo_rechazo text check (char_length(motivo_rechazo) <= 300),
  add column verificado_por uuid references capa.usuarios (id),
  add column verificado_en timestamptz;

comment on column capa.pagos.numero_operacion is 'Número de operación de Yape o del banco que registra el asistente (HU-16 CA-02).';
comment on column capa.pagos.comprobante_ruta is 'Ruta de la captura del comprobante en el bucket privado (CAP-92). Dato personal: solo asistente y administración.';

-- Un solo pago por verificar a la vez por inscripción.
create unique index pagos_por_verificar_uq on capa.pagos (inscripcion_id) where estado = 'por_verificar';
-- Un mismo número de operación no sirve para dos pagos vigentes del mismo medio.
create unique index pagos_operacion_uq on capa.pagos (metodo, upper(numero_operacion))
  where numero_operacion is not null and estado in ('por_verificar', 'confirmado');
-- Bandeja de la administración: los más antiguos primero.
create index pagos_bandeja_idx on capa.pagos (creado_en) where estado = 'por_verificar';

-- Forma de la ruta de la captura: <id de la inscripción>/<archivo>.<jpg|jpeg|png|webp>
create or replace function capa.ruta_comprobante_valida(ruta text, inscripcion uuid) returns boolean
language sql immutable as $$
  select ruta ~* ('^' || inscripcion::text || '/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$')
$$;

-- Número de comprobante con la secuencia y el formato de la pasarela del Sprint 1 (CP-2026-001001).
create or replace function capa.nuevo_numero_comprobante() returns text
language sql volatile as $$
  select 'CP-' || to_char(capa.ahora() at time zone 'America/Lima', 'YYYY') || '-' || lpad(nextval('capa.comprobante_seq')::text, 6, '0')
$$;

-- Datos del pago para el asistente (mis_inscripciones) y para el comprobante. Sin la ruta de la captura.
create or replace function capa.pago_json(pg capa.pagos) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', pg.id, 'inscripcion_id', pg.inscripcion_id, 'metodo', pg.metodo, 'monto', pg.monto,
    'estado', pg.estado, 'referencia_externa', pg.referencia_externa, 'numero_comprobante', pg.numero_comprobante,
    'mensaje', pg.mensaje, 'creado_en', pg.creado_en, 'actualizado_en', pg.actualizado_en,
    -- CAP-89 (HU-16 CA-02 y CA-04): número de operación, motivo del rechazo y fecha de la verificación.
    'numero_operacion', pg.numero_operacion, 'motivo_rechazo', pg.motivo_rechazo, 'verificado_en', pg.verificado_en)
$$;

-- ---------------------------------------------------------------------------
-- Medios de pago públicos (CA-01: lo que se muestra al pagar)
-- ---------------------------------------------------------------------------
create or replace function public.medios_pago(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  c capa.config_pagos;
begin
  select * into c from capa.config_pagos where id = 1;
  return jsonb_build_object(
    'config', jsonb_build_object('yape_qr', c.yape_qr, 'yape_titular', c.yape_titular, 'banco', c.banco,
      'cuenta', c.cuenta, 'cci', c.cci, 'titular', c.titular, 'whatsapp', c.whatsapp),
    'disponibles', to_jsonb(capa.medios_disponibles(c)));
end $$;

-- ---------------------------------------------------------------------------
-- CA-02 · El asistente registra su pago: número de operación y captura
-- ---------------------------------------------------------------------------
create or replace function public.registrar_pago_manual(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  ins capa.inscripciones;
  pg capa.pagos;
  c capa.config_pagos;
  v_metodo text := capa.txt(p, 'metodo');
  v_operacion text := nullif(btrim(coalesce(capa.txt(p, 'numero_operacion'), '')), '');
  v_ruta text := capa.txt(p, 'comprobante');
  v_malos text[] := '{}';
begin
  select * into ins from capa.inscripciones where id = capa.txt(p, 'inscripcion_id')::uuid for update;
  if not found or ins.usuario_id <> u.id then
    perform capa.err('No encontramos esta inscripción.', 'NO_ENCONTRADO');
  end if;
  if ins.estado <> 'pendiente_pago' then
    perform capa.err('Esta inscripción no tiene un pago pendiente.');
  end if;
  if ins.reserva_expira_en is not null and ins.reserva_expira_en <= capa.ahora() then
    perform capa.err('Tu reserva venció y el cupo se liberó. Vuelve a inscribirte si aún hay cupos.', 'VENCIDA');
  end if;
  if exists (select 1 from capa.pagos where inscripcion_id = ins.id and estado = 'por_verificar') then
    perform capa.err('Ya enviaste un comprobante. Espera a que la administración lo revise.', 'POR_VERIFICAR');
  end if;

  select * into c from capa.config_pagos where id = 1;
  if v_metodo is null or not (v_metodo = any (capa.medios_disponibles(c))) then
    v_malos := array_append(v_malos, 'metodo');
  end if;
  if v_operacion is null or v_operacion !~ '^[A-Za-z0-9-]{4,30}$' then
    v_malos := array_append(v_malos, 'numero_operacion');
  end if;
  if v_ruta is null or not capa.ruta_comprobante_valida(v_ruta, ins.id) then
    v_malos := array_append(v_malos, 'comprobante');
  end if;
  if cardinality(v_malos) > 0 then
    perform capa.err(case
        when v_malos = array['metodo'] then 'Elige un medio de pago disponible: Yape, transferencia o WhatsApp.'
        when v_malos = array['numero_operacion'] then 'Escribe el número de operación de la constancia (de 4 a 30 letras o números).'
        when v_malos = array['comprobante'] then 'Adjunta la captura del comprobante (JPG, PNG o WEBP).'
        else 'Completa el medio de pago, el número de operación y la captura del comprobante.' end,
      'CAMPOS', jsonb_build_object('campos', v_malos));
  end if;
  -- D-02 (hallado en CAP-91): si la misma persona canceló una inscripción con este pago por verificar y se volvió
  -- a inscribir, el pago viejo se da por reenviado aquí; así su número de operación no queda bloqueado.
  update capa.pagos pv set estado = 'rechazado', motivo_rechazo = 'Se reenvió en una nueva inscripción.',
      mensaje = 'Se reenvió en una nueva inscripción.', actualizado_en = capa.ahora()
    from capa.inscripciones iv
    where iv.id = pv.inscripcion_id and pv.usuario_id = u.id and pv.estado = 'por_verificar' and iv.estado <> 'pendiente_pago'
      and pv.metodo = v_metodo and upper(pv.numero_operacion) = upper(v_operacion);
  if exists (select 1 from capa.pagos where metodo = v_metodo and upper(numero_operacion) = upper(v_operacion)
             and estado in ('por_verificar', 'confirmado')) then
    perform capa.err('Ese número de operación ya se registró en otro pago. Revisa tu constancia.', 'CAMPOS',
      '{"campos":["numero_operacion"]}');
  end if;

  -- Un intento abierto de la pasarela simulada (solo demostración) se da por abandonado.
  update capa.pagos set estado = 'sin_respuesta', mensaje = 'Intento abandonado', actualizado_en = capa.ahora()
    where inscripcion_id = ins.id and estado = 'procesando';
  insert into capa.pagos (inscripcion_id, evento_id, usuario_id, metodo, monto, estado, numero_operacion, comprobante_ruta,
                          mensaje, creado_en, actualizado_en)
  values (ins.id, ins.evento_id, u.id, v_metodo, ins.monto, 'por_verificar', v_operacion, v_ruta,
          'Por verificar', capa.ahora(), capa.ahora())
  returning * into pg;
  -- CA-02: el cupo sigue reservado mientras se verifica (ver el encabezado).
  update capa.inscripciones set reserva_expira_en = null where id = ins.id;
  return jsonb_build_object('ok', true, 'pago', capa.pago_json(pg));
end $$;

-- ---------------------------------------------------------------------------
-- CA-03, CA-04 y CA-06 · Bandeja de la administración
-- D-02 (hallado en CAP-91): también salen los pagos por verificar de inscripciones que se cancelaron (la persona o
-- el evento), marcados con inscripcion_vigente = false. Si no, quedaban colgados para siempre: nadie los veía y
-- nadie coordinaba la devolución. Al aprobarlos o rechazarlos quedan rechazados (capa.pago_sin_inscripcion_vigente).
-- ---------------------------------------------------------------------------
create or replace function public.pagos_por_verificar(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', pg.id, 'inscripcion_id', pg.inscripcion_id, 'evento_id', pg.evento_id,
      'persona', capa.nombre_completo(us), 'correo', us.correo, 'evento', e.nombre,
      'monto', pg.monto, 'medio', pg.metodo, 'operacion', pg.numero_operacion,
      'enviado', pg.creado_en, 'comprobante', pg.comprobante_ruta,
      'inscripcion_vigente', i.estado = 'pendiente_pago') order by pg.creado_en), '[]'::jsonb)
    from capa.pagos pg
    join capa.inscripciones i on i.id = pg.inscripcion_id
    join capa.usuarios us on us.id = pg.usuario_id
    join capa.eventos e on e.id = pg.evento_id
    where pg.estado = 'por_verificar');
end $$;

-- Si la inscripción dejó de estar vigente (la canceló el asistente o se canceló el evento), el pago ya no se puede
-- aprobar: queda rechazado con ese motivo y la función lo informa sin error, para que el cambio se guarde.
create or replace function capa.pago_sin_inscripcion_vigente(pg capa.pagos, u capa.usuarios) returns jsonb
language plpgsql as $$
begin
  update capa.pagos set estado = 'rechazado', motivo_rechazo = 'La inscripción ya no está vigente.',
    mensaje = 'La inscripción ya no está vigente.', verificado_por = u.id, verificado_en = capa.ahora(), actualizado_en = capa.ahora()
    where id = pg.id returning * into pg;
  return jsonb_build_object('ok', false, 'motivo', 'no_vigente', 'pago', capa.pago_json(pg),
    'mensaje', 'La inscripción ya no está vigente (se canceló). El pago quedó rechazado; si hubo un cobro, coordina la devolución.');
end $$;

create or replace function capa.pago_por_verificar(p jsonb) returns capa.pagos
language plpgsql as $$
declare
  pg capa.pagos;
begin
  select * into pg from capa.pagos where id = capa.txt(p, 'pago_id')::uuid for update;
  if not found then
    perform capa.err('No encontramos este pago.', 'NO_ENCONTRADO');
  end if;
  if pg.estado <> 'por_verificar' then
    perform capa.err('Este pago ya fue revisado.');
  end if;
  return pg;
end $$;

-- CA-03: aprobar confirma la inscripción, genera el comprobante y avisa por correo.
create or replace function public.aprobar_pago(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  pg capa.pagos := capa.pago_por_verificar(p);
  ins capa.inscripciones;
  e capa.eventos;
  titular capa.usuarios;
begin
  select * into ins from capa.inscripciones where id = pg.inscripcion_id for update;
  if ins.estado <> 'pendiente_pago' then
    return capa.pago_sin_inscripcion_vigente(pg, u);
  end if;
  select * into e from capa.eventos where id = ins.evento_id;
  select * into titular from capa.usuarios where id = pg.usuario_id;

  update capa.pagos set estado = 'confirmado', numero_comprobante = capa.nuevo_numero_comprobante(),
    referencia_externa = pg.numero_operacion, mensaje = 'Pago verificado por la administración',
    verificado_por = u.id, verificado_en = capa.ahora(), actualizado_en = capa.ahora()
    where id = pg.id returning * into pg;
  update capa.inscripciones set estado = 'confirmada', confirmado_en = capa.ahora(), reserva_expira_en = null
    where id = ins.id;
  perform capa.enviar_correo(titular.id, titular.correo, 'Pago confirmado · comprobante ' || pg.numero_comprobante,
    'Hola ' || titular.nombres || E',\n\nVerificamos tu pago de ' || capa.fmt_monto(pg.monto)
      || E'. Tu inscripción quedó confirmada.\n\nComprobante: ' || pg.numero_comprobante
      || E'\nNúmero de operación: ' || pg.numero_operacion || E'\n\n' || capa.datos_evento_texto(e)
      || E'\nTu código QR de ingreso está en "Mis inscripciones".',
    'pago', e.id, 'Descargar comprobante', '/mis-inscripciones?comprobante=' || pg.id);
  perform capa.auditar(u, 'Aprobó un pago', 'pago', pg.id::text,
    capa.nombre_completo(titular) || ' · ' || e.nombre || ' · ' || capa.fmt_monto(pg.monto) || ' · ' || pg.numero_comprobante);
  return jsonb_build_object('ok', true, 'pago', capa.pago_json(pg));
end $$;

-- CA-04: rechazar guarda el motivo, avisa por correo y vuelve a dar 30 minutos para reenviar el comprobante.
create or replace function public.rechazar_pago(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  pg capa.pagos := capa.pago_por_verificar(p);
  ins capa.inscripciones;
  e capa.eventos;
  titular capa.usuarios;
  v_motivo text := nullif(btrim(coalesce(capa.txt(p, 'motivo'), '')), '');
begin
  if v_motivo is null or char_length(v_motivo) < 5 or char_length(v_motivo) > 300 then
    perform capa.err('Escribe el motivo del rechazo (de 5 a 300 caracteres): la persona lo verá.', 'CAMPOS', '{"campos":["motivo"]}');
  end if;
  select * into ins from capa.inscripciones where id = pg.inscripcion_id for update;
  if ins.estado <> 'pendiente_pago' then
    return capa.pago_sin_inscripcion_vigente(pg, u);
  end if;
  select * into e from capa.eventos where id = ins.evento_id;
  select * into titular from capa.usuarios where id = pg.usuario_id;

  update capa.pagos set estado = 'rechazado', motivo_rechazo = v_motivo, mensaje = v_motivo,
    verificado_por = u.id, verificado_en = capa.ahora(), actualizado_en = capa.ahora()
    where id = pg.id returning * into pg;
  update capa.inscripciones set reserva_expira_en = capa.ahora() + interval '30 minutes' where id = ins.id
    returning * into ins;
  perform capa.enviar_correo(titular.id, titular.correo, 'Revisa tu pago en ' || e.nombre,
    'Hola ' || titular.nombres || E',\n\nNo pudimos verificar tu pago de ' || capa.fmt_monto(pg.monto) || E'.\n\nMotivo: ' || v_motivo
      || E'\n\nTu cupo sigue reservado hasta el ' || capa.fmt_fecha(ins.reserva_expira_en)
      || '. Puedes volver a enviar el comprobante desde "Mis inscripciones". Si no lo haces, el cupo se libera.',
    'pago', e.id, 'Volver a enviar', '/mis-inscripciones?pagar=' || ins.id);
  perform capa.auditar(u, 'Rechazó un pago', 'pago', pg.id::text, capa.nombre_completo(titular) || ' · ' || e.nombre || ' · ' || v_motivo);
  return jsonb_build_object('ok', true, 'pago', capa.pago_json(pg), 'reserva_expira_en', ins.reserva_expira_en);
end $$;

-- ---------------------------------------------------------------------------
-- CA-06 · Configuración de pagos (solo administración)
-- ---------------------------------------------------------------------------
create or replace function public.guardar_config_pagos(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  c capa.config_pagos;
  v_cuenta text := nullif(regexp_replace(coalesce(capa.txt(p, 'cuenta'), ''), '[\s-]', '', 'g'), '');
  v_cci text := nullif(regexp_replace(coalesce(capa.txt(p, 'cci'), ''), '[\s-]', '', 'g'), '');
  v_whatsapp text := capa.normalizar_celular(capa.txt(p, 'whatsapp'));
  v_malos text[] := '{}';
  k text;
begin
  select * into c from capa.config_pagos where id = 1 for update;
  -- Una clave ausente no se toca; vacía, se borra (igual que guardar_imagenes_evento, CAP-109).
  if p ? 'cuenta' and v_cuenta is not null and v_cuenta !~ '^[0-9]{8,20}$' then v_malos := array_append(v_malos, 'cuenta'); end if;
  if p ? 'cci' and v_cci is not null and v_cci !~ '^[0-9]{20}$' then v_malos := array_append(v_malos, 'cci'); end if;
  if p ? 'whatsapp' and v_whatsapp is not null and not capa.celular_valido(v_whatsapp) then v_malos := array_append(v_malos, 'whatsapp'); end if;
  foreach k in array array['yape_titular', 'banco', 'titular'] loop
    if char_length(capa.txt(p, k)) > 120 then v_malos := array_append(v_malos, k); end if;
  end loop;
  if char_length(capa.txt(p, 'yape_qr')) > 300 then v_malos := array_append(v_malos, 'yape_qr'); end if;
  if cardinality(v_malos) > 0 then
    perform capa.err(case
        when v_malos = array['cuenta'] then 'El número de cuenta debe tener de 8 a 20 dígitos.'
        when v_malos = array['cci'] then 'El CCI debe tener 20 dígitos.'
        when v_malos = array['whatsapp'] then replace(capa.mensaje_celular(), 'El celular', 'El WhatsApp')
        else 'Revisa los datos marcados.' end,
      'CAMPOS', jsonb_build_object('campos', v_malos));
  end if;

  update capa.config_pagos set
    yape_qr = case when p ? 'yape_qr' then nullif(btrim(coalesce(capa.txt(p, 'yape_qr'), '')), '') else yape_qr end,
    yape_titular = case when p ? 'yape_titular' then nullif(btrim(coalesce(capa.txt(p, 'yape_titular'), '')), '') else yape_titular end,
    banco = case when p ? 'banco' then nullif(btrim(coalesce(capa.txt(p, 'banco'), '')), '') else banco end,
    cuenta = case when p ? 'cuenta' then v_cuenta else cuenta end,
    cci = case when p ? 'cci' then v_cci else cci end,
    titular = case when p ? 'titular' then nullif(btrim(coalesce(capa.txt(p, 'titular'), '')), '') else titular end,
    whatsapp = case when p ? 'whatsapp' then v_whatsapp else whatsapp end,
    actualizado_en = capa.ahora(), actualizado_por = u.id
  where id = 1 returning * into c;
  perform capa.auditar(u, 'Cambió la configuración de pagos', 'sistema', 'config_pagos',
    'medios disponibles: ' || coalesce(nullif(array_to_string(capa.medios_disponibles(c), ', '), ''), 'ninguno'));
  return public.medios_pago('{}');
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.medios_pago(jsonb), public.registrar_pago_manual(jsonb), public.pagos_por_verificar(jsonb),
      public.aprobar_pago(jsonb), public.rechazar_pago(jsonb), public.guardar_config_pagos(jsonb) to anon, authenticated';
  end if;
end $$;
