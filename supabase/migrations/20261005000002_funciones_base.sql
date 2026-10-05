-- CAPACITRON · Funciones base
-- Auxiliares internas (esquema capa) y API RPC de cuentas, eventos, inscripciones,
-- lista de espera y pagos (HU-01 a HU-05).
--
-- Convenciones de la API:
--   * Toda función pública recibe un único parámetro jsonb "p" y devuelve jsonb.
--   * La sesión viaja en p.token (token opaco; en BD solo se guarda su hash SHA-256).
--   * Los errores de validación se lanzan con RAISE: message = texto para la persona,
--     hint = código (CAMPOS, PLAN, PROHIBIDO, NO_AUTH...), detail = jsonb opcional.
--   * Cuando un fallo debe dejar rastro (intentos de login, pagos rechazados,
--     consultas de verificación) la función NO lanza: devuelve {ok:false, ...}
--     para que el registro no se revierta con la transacción.

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

create function capa.err(msg text, codigo text default 'VALIDACION', detalle jsonb default null)
returns void language plpgsql as $$
begin
  raise exception using message = msg, hint = codigo, detail = coalesce(detalle::text, '');
end $$;

create function capa.txt(p jsonb, k text) returns text
language sql immutable as $$ select nullif(trim(p ->> k), '') $$;

create function capa.password_valida(pw text) returns boolean
language sql immutable as $$
  select pw is not null and length(pw) >= 8 and pw ~ '[A-Za-zÁÉÍÓÚáéíóúÑñ]' and pw ~ '[0-9]'
$$;

create function capa.nombre_completo(u capa.usuarios) returns text
language sql immutable as $$ select u.nombres || ' ' || u.apellidos $$;

create function capa.plan_institucion(inst uuid) returns capa.planes
language sql stable as $$
  select pl.* from capa.planes pl
  where pl.codigo = coalesce((select i.plan_codigo from capa.instituciones i where i.id = inst), 'basico')
$$;

create function capa.usuario_json(u capa.usuarios) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', u.id,
    'nombres', u.nombres,
    'apellidos', u.apellidos,
    'nombre_completo', u.nombres || ' ' || u.apellidos,
    'correo', u.correo,
    'rol', u.rol,
    'estado', u.estado,
    'recordatorios_activos', u.recordatorios_activos,
    'institucion', (
      select jsonb_build_object('id', i.id, 'nombre', i.nombre, 'siglas', i.siglas, 'estado', i.estado,
                                'plan', to_jsonb(pl) - 'actualizado_en')
      from capa.instituciones i join capa.planes pl on pl.codigo = i.plan_codigo
      where i.id = u.institucion_id)
  )
$$;

-- Sesión obligatoria: devuelve la fila del usuario o lanza NO_AUTH.
create function capa.usuario_sesion(p jsonb) returns capa.usuarios
language plpgsql stable as $$
declare
  u capa.usuarios;
  inst capa.instituciones;
  t text := p ->> 'token';
begin
  if t is null or t = '' then
    perform capa.err('Inicia sesión para continuar.', 'NO_AUTH');
  end if;
  select us.* into u
  from capa.sesiones s join capa.usuarios us on us.id = s.usuario_id
  where s.token_hash = encode(extensions.digest(t, 'sha256'), 'hex')
    and not s.revocada and s.expira_en > now();
  if not found then
    perform capa.err('Tu sesión terminó. Vuelve a iniciar sesión.', 'NO_AUTH');
  end if;
  if u.estado = 'suspendida' then
    perform capa.err('Tu cuenta está suspendida. Motivo: ' || coalesce(u.motivo_suspension, 'no especificado') || '.', 'NO_AUTH');
  end if;
  if u.rol = 'organizador' then
    select * into inst from capa.instituciones where id = u.institucion_id;
    if found and inst.estado = 'suspendida' then
      perform capa.err('La institución ' || inst.nombre || ' está suspendida. Motivo: '
                       || coalesce(inst.motivo_suspension, 'no especificado') || '.', 'NO_AUTH');
    end if;
  end if;
  return u;
end $$;

-- Sesión opcional (páginas públicas): null si no hay sesión válida.
create function capa.usuario_opcional(p jsonb) returns capa.usuarios
language plpgsql stable as $$
declare
  u capa.usuarios;
  t text := p ->> 'token';
begin
  if t is null or t = '' then return null; end if;
  select us.* into u
  from capa.sesiones s join capa.usuarios us on us.id = s.usuario_id
  where s.token_hash = encode(extensions.digest(t, 'sha256'), 'hex')
    and not s.revocada and s.expira_en > now() and us.estado = 'activa';
  if not found then return null; end if;
  return u;
end $$;

create function capa.exigir_rol(u capa.usuarios, variadic roles text[]) returns void
language plpgsql as $$
begin
  if not (u.rol = any (roles)) then
    perform capa.err('No tienes permiso para realizar esta acción.', 'PROHIBIDO');
  end if;
end $$;

-- Restricciones de plan (HU-13 CA-03): bloquea y sugiere el plan mínimo que la incluye.
create function capa.exigir_plan(inst uuid, funcion text) returns void
language plpgsql stable as $$
declare
  pl capa.planes := capa.plan_institucion(inst);
  permitido boolean;
  etiqueta text;
  sugerido text;
begin
  permitido := case funcion
    when 'pagos' then pl.permite_pagos
    when 'virtual' then pl.permite_virtual
    when 'exportar' then pl.permite_exportar
    when 'encuestas' then pl.permite_encuestas
    else true end;
  if permitido then return; end if;
  etiqueta := case funcion
    when 'pagos' then 'eventos con costo y pagos en línea'
    when 'virtual' then 'eventos virtuales o mixtos'
    when 'exportar' then 'la exportación de reportes'
    when 'encuestas' then 'las encuestas de satisfacción'
    else funcion end;
  select nombre into sugerido from capa.planes x
  where case funcion
          when 'pagos' then x.permite_pagos
          when 'virtual' then x.permite_virtual
          when 'exportar' then x.permite_exportar
          when 'encuestas' then x.permite_encuestas end
  order by x.orden limit 1;
  perform capa.err(format('El plan %s de tu institución no incluye %s. Mejora al plan %s para habilitarlo.',
                          pl.nombre, etiqueta, coalesce(sugerido, 'Pro')),
                   'PLAN', jsonb_build_object('funcion', funcion, 'plan_actual', pl.codigo, 'plan_sugerido', sugerido));
end $$;

create function capa.enviar_correo(
  p_usuario uuid, p_para text, p_asunto text, p_cuerpo text, p_tipo text,
  p_evento uuid default null, p_accion_texto text default null, p_accion_url text default null)
returns void language sql as $$
  insert into capa.correos (usuario_id, para, asunto, cuerpo, tipo, evento_id, accion_texto, accion_url, enviado_en)
  values (p_usuario, p_para, p_asunto, p_cuerpo, p_tipo, p_evento, p_accion_texto, p_accion_url, capa.ahora())
$$;

create function capa.auditar(actor capa.usuarios, accion text, entidad text, entidad_id text, detalle text)
returns void language sql as $$
  insert into capa.auditoria (actor_id, actor_nombre, accion, entidad, entidad_id, detalle, creado_en)
  values (actor.id, coalesce(actor.nombres || ' ' || actor.apellidos, 'Sistema'), accion, entidad, entidad_id, detalle, capa.ahora())
$$;

-- ---------------------------------------------------------------------------
-- Auxiliares de eventos
-- ---------------------------------------------------------------------------

-- Cupos ocupados: inscripciones confirmadas, reservas con pago pendiente y
-- cupos ofrecidos a la lista de espera que aún no vencen.
create function capa.cupos_ocupados(ev uuid) returns int
language sql stable as $$
  select (select count(*) from capa.inscripciones i
          where i.evento_id = ev and i.estado in ('confirmada', 'pendiente_pago'))::int
       + (select count(*) from capa.lista_espera l
          where l.evento_id = ev and l.estado = 'ofrecido')::int
$$;

create function capa.fase_evento(e capa.eventos) returns text
language sql stable as $$
  select case
    when e.estado = 'borrador' then 'borrador'
    when e.estado = 'cancelado' then 'cancelado'
    when capa.ahora() < e.fecha_inicio then 'proximo'
    when capa.ahora() <= e.fecha_fin then 'en_curso'
    else 'finalizado' end
$$;

-- Jornadas = días calendario (hora de Perú) que abarca el evento. La asistencia
-- se registra una vez por jornada y el porcentaje se calcula sobre ellas (HU-08).
create function capa.total_jornadas(e capa.eventos) returns int
language sql immutable as $$
  select ((e.fecha_fin at time zone 'America/Lima')::date
        - (e.fecha_inicio at time zone 'America/Lima')::date) + 1
$$;

create function capa.evento_json(e capa.eventos) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', e.id,
    'nombre', e.nombre,
    'descripcion', e.descripcion,
    'fecha_inicio', e.fecha_inicio,
    'fecha_fin', e.fecha_fin,
    'modalidad', e.modalidad,
    'lugar', e.lugar,
    'cupo_maximo', e.cupo_maximo,
    'cupos_ocupados', capa.cupos_ocupados(e.id),
    'cupos_disponibles', greatest(e.cupo_maximo - capa.cupos_ocupados(e.id), 0),
    'en_espera', (select count(*) from capa.lista_espera l where l.evento_id = e.id and l.estado = 'esperando'),
    'costo', e.costo,
    'porcentaje_minimo', e.porcentaje_minimo,
    'horas_academicas', e.horas_academicas,
    'firmante_nombre', e.firmante_nombre,
    'firmante_cargo', e.firmante_cargo,
    'estado', e.estado,
    'fase', capa.fase_evento(e),
    'motivo_cancelacion', e.motivo_cancelacion,
    'total_jornadas', capa.total_jornadas(e),
    'tiene_enlace', e.enlace_virtual is not null,
    'enlace_plataforma', e.enlace_plataforma,
    'organizador_id', e.organizador_id,
    'organizador', (select u.nombres || ' ' || u.apellidos from capa.usuarios u where u.id = e.organizador_id),
    'institucion', (select jsonb_build_object('id', i.id, 'nombre', i.nombre, 'siglas', i.siglas)
                    from capa.instituciones i where i.id = e.institucion_id),
    'ponentes_resumen', (select coalesce(jsonb_agg(pn.nombre order by pn.orden, pn.creado_en), '[]'::jsonb)
                         from capa.ponentes pn where pn.evento_id = e.id)
  )
$$;

create function capa.datos_evento_texto(e capa.eventos, incluir_enlace boolean default false) returns text
language sql stable as $$
  select 'Evento: ' || e.nombre || E'\n'
      || 'Inicio: ' || capa.fmt_fecha(e.fecha_inicio) || E'\n'
      || 'Fin: ' || capa.fmt_fecha(e.fecha_fin) || E'\n'
      || 'Modalidad: ' || initcap(e.modalidad) || E'\n'
      || case when e.lugar is not null and e.modalidad <> 'virtual' then 'Lugar: ' || e.lugar || E'\n' else '' end
      || case when incluir_enlace and e.enlace_virtual is not null then 'Enlace de la sala: ' || e.enlace_virtual || E'\n' else '' end
$$;

create function capa.inscripcion_json(i capa.inscripciones) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', i.id,
    'evento_id', i.evento_id,
    'estado', i.estado,
    'codigo_qr', case when i.estado = 'confirmada' then i.codigo_qr end,
    'monto', i.monto,
    'reserva_expira_en', i.reserva_expira_en,
    'creado_en', i.creado_en,
    'confirmado_en', i.confirmado_en,
    'cancelado_en', i.cancelado_en,
    'motivo_cancelacion', i.motivo_cancelacion
  )
$$;

create function capa.evento_del_organizador(u capa.usuarios, ev uuid, bloquear boolean default false)
returns capa.eventos language plpgsql as $$
declare
  e capa.eventos;
begin
  if bloquear then
    select * into e from capa.eventos where id = ev for update;
  else
    select * into e from capa.eventos where id = ev;
  end if;
  if not found then
    perform capa.err('No encontramos el evento.', 'NO_ENCONTRADO');
  end if;
  if e.organizador_id <> u.id then
    perform capa.err('Solo el organizador de este evento puede gestionarlo.', 'PROHIBIDO');
  end if;
  return e;
end $$;

-- Ofrece los cupos libres a la lista de espera, en orden de solicitud (HU-05 CA-02).
create function capa.procesar_lista_espera(ev uuid) returns int
language plpgsql as $$
declare
  e capa.eventos;
  l capa.lista_espera;
  u capa.usuarios;
  n int := 0;
begin
  select * into e from capa.eventos where id = ev for update;
  if not found or e.estado <> 'publicado' or e.fecha_inicio <= capa.ahora() then
    return 0;
  end if;
  loop
    exit when e.cupo_maximo - capa.cupos_ocupados(ev) <= 0;
    select * into l from capa.lista_espera
    where evento_id = ev and estado = 'esperando'
    order by solicitado_en, id limit 1 for update;
    exit when not found;
    update capa.lista_espera
      set estado = 'ofrecido', ofrecido_en = capa.ahora(),
          oferta_expira_en = least(capa.ahora() + interval '24 hours', e.fecha_inicio)
      where id = l.id
      returning * into l;
    select * into u from capa.usuarios where id = l.usuario_id;
    perform capa.enviar_correo(u.id, u.correo,
      'Se liberó un cupo en ' || e.nombre,
      'Hola ' || u.nombres || E',\n\nSe liberó un cupo en el evento que esperabas y lo reservamos para ti.\n\n'
        || capa.datos_evento_texto(e)
        || E'\nConfirma tu cupo antes del ' || capa.fmt_fecha(l.oferta_expira_en)
        || '. Si no lo confirmas, pasará a la siguiente persona de la lista.',
      'lista_espera', e.id, 'Confirmar mi cupo', '/mis-inscripciones');
    n := n + 1;
  end loop;
  return n;
end $$;

create function capa.plataforma_enlace(url text) returns text
language plpgsql immutable as $$
declare
  v text := lower(trim(coalesce(url, '')));
  host text;
  ruta text;
begin
  if v !~ '^https://[^\s]+$' then return null; end if;
  host := substring(v from '^https://([^/?#:]+)');
  ruta := coalesce(substring(v from '^https://[^/?#]+(/[^?#]*)'), '');
  if (host = 'zoom.us' or host like '%.zoom.us') and ruta ~ '^/(j|w|my|s)/.+' then
    return 'zoom';
  elsif host = 'meet.google.com' and ruta ~ '^/[a-z]{3}-[a-z]{4}-[a-z]{3}$' then
    return 'meet';
  elsif host in ('teams.microsoft.com', 'teams.live.com') and length(ruta) > 1 then
    return 'teams';
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- HU-01 · Cuentas
-- ---------------------------------------------------------------------------

create function public.instituciones_publicas(p jsonb default '{}') returns jsonb
language sql stable security definer set search_path = capa, extensions, public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'nombre', nombre, 'siglas', siglas) order by nombre), '[]'::jsonb)
  from capa.instituciones where estado = 'activa'
$$;

create function public.registrar_usuario(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  v_nombres text := capa.txt(p, 'nombres');
  v_apellidos text := capa.txt(p, 'apellidos');
  v_correo text := lower(capa.txt(p, 'correo'));
  v_pass text := p ->> 'password';
  v_rol text := coalesce(capa.txt(p, 'rol'), 'asistente');
  v_inst uuid := capa.txt(p, 'institucion_id')::uuid;
  v_faltan text[] := '{}';
  u capa.usuarios;
  v_token text;
begin
  if v_nombres is null then v_faltan := array_append(v_faltan, 'nombres'); end if;
  if v_apellidos is null then v_faltan := array_append(v_faltan, 'apellidos'); end if;
  if v_correo is null then v_faltan := array_append(v_faltan, 'correo'); end if;
  if coalesce(v_pass, '') = '' then v_faltan := array_append(v_faltan, 'password'); end if;
  if v_rol = 'organizador' and v_inst is null then v_faltan := array_append(v_faltan, 'institucion_id'); end if;
  if cardinality(v_faltan) > 0 then
    perform capa.err('Completa los campos obligatorios.', 'CAMPOS', jsonb_build_object('campos', v_faltan));
  end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform capa.err('Ingresa un correo válido.', 'CAMPOS', '{"campos":["correo"]}');
  end if;
  if v_rol not in ('asistente', 'organizador', 'ponente') then
    perform capa.err('Elige un rol válido: asistente, organizador o ponente.', 'CAMPOS', '{"campos":["rol"]}');
  end if;
  if not capa.password_valida(v_pass) then
    perform capa.err('La contraseña debe tener al menos 8 caracteres y combinar letras y números.',
                     'CAMPOS', '{"campos":["password"]}');
  end if;
  if not coalesce((p ->> 'acepta_privacidad')::boolean, false) then
    perform capa.err('Para registrarte debes aceptar la política de privacidad.', 'CAMPOS', '{"campos":["acepta_privacidad"]}');
  end if;
  if v_rol = 'organizador' then
    if not exists (select 1 from capa.instituciones where id = v_inst and estado = 'activa') then
      perform capa.err('La institución elegida no está disponible.', 'CAMPOS', '{"campos":["institucion_id"]}');
    end if;
  else
    v_inst := null;
  end if;
  if exists (select 1 from capa.usuarios where lower(correo) = v_correo) then
    perform capa.err('Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.',
                     'CORREO_EXISTE', '{"campos":["correo"]}');
  end if;

  insert into capa.usuarios (nombres, apellidos, correo, password_hash, rol, institucion_id, estado, acepto_privacidad_en, creado_en)
  values (v_nombres, v_apellidos, v_correo, extensions.crypt(v_pass, extensions.gen_salt('bf', 10)),
          v_rol, v_inst, 'pendiente', capa.ahora(), capa.ahora())
  returning * into u;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into capa.tokens_confirmacion (token, usuario_id, expira_en)
  values (v_token, u.id, capa.ahora() + interval '24 hours');

  -- Si ya figuraba como ponente de algún evento, se vincula su cuenta.
  update capa.ponentes set usuario_id = u.id where lower(correo) = v_correo and usuario_id is null;

  perform capa.enviar_correo(u.id, u.correo, 'Confirma tu cuenta en CAPACITRON',
    'Hola ' || u.nombres || E',\n\nGracias por registrarte en CAPACITRON. Para activar tu cuenta, confirma tu correo con el botón de abajo.\n\n'
      || 'El enlace es válido por 24 horas (hasta el ' || capa.fmt_fecha(capa.ahora() + interval '24 hours') || ').'
      || E'\n\nSi no creaste esta cuenta, ignora este mensaje.',
    'confirmacion', null, 'Confirmar mi cuenta', '/confirmar/' || v_token);

  return jsonb_build_object('ok', true, 'correo', u.correo);
exception
  when unique_violation then
    perform capa.err('Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.',
                     'CORREO_EXISTE', '{"campos":["correo"]}');
end $$;

create function public.confirmar_cuenta(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  t capa.tokens_confirmacion;
  u capa.usuarios;
begin
  select * into t from capa.tokens_confirmacion where token = capa.txt(p, 'token') for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'invalido',
      'mensaje', 'Este enlace de confirmación no es válido.');
  end if;
  select * into u from capa.usuarios where id = t.usuario_id;
  if t.usado_en is not null or u.estado <> 'pendiente' then
    return jsonb_build_object('ok', true, 'ya_confirmada', true, 'correo', u.correo);
  end if;
  if t.expira_en <= capa.ahora() then
    return jsonb_build_object('ok', false, 'motivo', 'vencido', 'correo', u.correo,
      'mensaje', 'El enlace venció: era válido por 24 horas. Pide uno nuevo para activar tu cuenta.');
  end if;
  update capa.usuarios set estado = 'activa', confirmado_en = capa.ahora() where id = u.id;
  update capa.tokens_confirmacion set usado_en = capa.ahora() where token = t.token;
  return jsonb_build_object('ok', true, 'correo', u.correo);
end $$;

create function public.reenviar_confirmacion(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios;
  v_token text;
begin
  select * into u from capa.usuarios where lower(correo) = lower(capa.txt(p, 'correo'));
  if found and u.estado = 'pendiente' then
    update capa.tokens_confirmacion set expira_en = least(expira_en, capa.ahora())
      where usuario_id = u.id and usado_en is null;
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    insert into capa.tokens_confirmacion (token, usuario_id, expira_en)
    values (v_token, u.id, capa.ahora() + interval '24 hours');
    perform capa.enviar_correo(u.id, u.correo, 'Nuevo enlace para confirmar tu cuenta',
      'Hola ' || u.nombres || E',\n\nAquí tienes un nuevo enlace para confirmar tu cuenta. Es válido por 24 horas.',
      'confirmacion', null, 'Confirmar mi cuenta', '/confirmar/' || v_token);
  end if;
  -- Misma respuesta exista o no la cuenta: no revela qué correos están registrados.
  return jsonb_build_object('ok', true);
end $$;

create function public.iniciar_sesion(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios;
  inst capa.instituciones;
  v_token text;
  v_intentos int;
  v_min int;
begin
  select * into u from capa.usuarios where lower(correo) = lower(capa.txt(p, 'correo')) for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'credenciales', 'mensaje', 'Correo o contraseña incorrectos.');
  end if;

  if u.bloqueado_hasta is not null and u.bloqueado_hasta > capa.ahora() then
    v_min := ceil(extract(epoch from (u.bloqueado_hasta - capa.ahora())) / 60);
    return jsonb_build_object('ok', false, 'motivo', 'bloqueada', 'bloqueado_hasta', u.bloqueado_hasta,
      'mensaje', format('Tu cuenta está bloqueada por seguridad tras 5 intentos fallidos. Inténtalo de nuevo en %s %s.',
                        v_min, case when v_min = 1 then 'minuto' else 'minutos' end));
  end if;

  if u.password_hash <> extensions.crypt(coalesce(p ->> 'password', ''), u.password_hash) then
    v_intentos := u.intentos_fallidos + 1;
    if v_intentos >= 5 then
      update capa.usuarios set intentos_fallidos = 0, bloqueado_hasta = capa.ahora() + interval '15 minutes'
        where id = u.id;
      return jsonb_build_object('ok', false, 'motivo', 'bloqueada',
        'bloqueado_hasta', capa.ahora() + interval '15 minutes',
        'mensaje', 'Fallaste 5 intentos seguidos. Por seguridad, tu cuenta quedó bloqueada durante 15 minutos.');
    end if;
    update capa.usuarios set intentos_fallidos = v_intentos where id = u.id;
    return jsonb_build_object('ok', false, 'motivo', 'credenciales', 'intentos_restantes', 5 - v_intentos,
      'mensaje', 'Correo o contraseña incorrectos.');
  end if;

  update capa.usuarios set intentos_fallidos = 0, bloqueado_hasta = null where id = u.id;

  if u.estado = 'pendiente' then
    return jsonb_build_object('ok', false, 'motivo', 'pendiente', 'correo', u.correo,
      'mensaje', 'Aún no confirmas tu correo. Abre el enlace que te enviamos para activar tu cuenta.');
  end if;
  if u.estado = 'suspendida' then
    return jsonb_build_object('ok', false, 'motivo', 'suspendida',
      'mensaje', 'Tu cuenta está suspendida. Motivo: ' || coalesce(u.motivo_suspension, 'no especificado') || '.');
  end if;
  if u.rol = 'organizador' then
    select * into inst from capa.instituciones where id = u.institucion_id;
    if found and inst.estado = 'suspendida' then
      return jsonb_build_object('ok', false, 'motivo', 'suspendida',
        'mensaje', 'La institución ' || inst.nombre || ' está suspendida. Motivo: '
                   || coalesce(inst.motivo_suspension, 'no especificado') || '.');
    end if;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into capa.sesiones (token_hash, usuario_id, creado_en, expira_en)
  values (encode(extensions.digest(v_token, 'sha256'), 'hex'), u.id, now(), now() + interval '7 days');

  return jsonb_build_object('ok', true, 'token', v_token, 'usuario', capa.usuario_json(u));
end $$;

create function public.cerrar_sesion(p jsonb) returns jsonb
language sql security definer set search_path = capa, extensions, public as $$
  update capa.sesiones set revocada = true
  where token_hash = encode(extensions.digest(coalesce(p ->> 'token', ''), 'sha256'), 'hex');
  select jsonb_build_object('ok', true);
$$;

create function public.sesion_actual(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios;
begin
  u := capa.usuario_sesion(p);
  return jsonb_build_object('usuario', capa.usuario_json(u));
exception
  when others then
    return jsonb_build_object('usuario', null, 'mensaje', sqlerrm);
end $$;

create function public.actualizar_perfil(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
begin
  if capa.txt(p, 'nombres') is null or capa.txt(p, 'apellidos') is null then
    perform capa.err('Nombres y apellidos son obligatorios.', 'CAMPOS',
      jsonb_build_object('campos', array_remove(array[
        case when capa.txt(p, 'nombres') is null then 'nombres' end,
        case when capa.txt(p, 'apellidos') is null then 'apellidos' end], null)));
  end if;
  update capa.usuarios set
    nombres = capa.txt(p, 'nombres'),
    apellidos = capa.txt(p, 'apellidos'),
    recordatorios_activos = coalesce((p ->> 'recordatorios_activos')::boolean, recordatorios_activos)
  where id = u.id
  returning * into u;
  return jsonb_build_object('ok', true, 'usuario', capa.usuario_json(u));
end $$;

-- ---------------------------------------------------------------------------
-- HU-02 · Eventos
-- ---------------------------------------------------------------------------

create function capa.publicar(e capa.eventos) returns capa.eventos
language plpgsql as $$
declare
  pl capa.planes := capa.plan_institucion(e.institucion_id);
  activos int;
begin
  if e.estado <> 'borrador' then
    perform capa.err('Solo se pueden publicar eventos en borrador.');
  end if;
  if e.fecha_inicio <= capa.ahora() then
    perform capa.err('La fecha de inicio ya pasó. Elige una fecha futura para publicar el evento.',
                     'CAMPOS', '{"campos":["fecha_inicio"]}');
  end if;
  if pl.max_eventos_activos is not null then
    select count(*) into activos from capa.eventos
    where institucion_id is not distinct from e.institucion_id and estado = 'publicado' and fecha_fin > capa.ahora();
    if activos >= pl.max_eventos_activos then
      perform capa.err(format('El plan %s permite %s eventos publicados a la vez y tu institución ya los tiene. Mejora al plan Pro o espera a que termine alguno.',
                              pl.nombre, pl.max_eventos_activos), 'PLAN',
                       jsonb_build_object('funcion', 'eventos_activos', 'plan_actual', pl.codigo, 'plan_sugerido', 'Pro'));
    end if;
  end if;
  update capa.eventos set estado = 'publicado', publicado_en = capa.ahora(), actualizado_en = capa.ahora()
    where id = e.id returning * into e;
  return e;
end $$;

create function public.guardar_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  ant capa.eventos;
  pl capa.planes;
  v_id uuid := capa.txt(p, 'id')::uuid;
  v_nombre text := capa.txt(p, 'nombre');
  v_desc text := capa.txt(p, 'descripcion');
  v_inicio timestamptz := capa.txt(p, 'fecha_inicio')::timestamptz;
  v_fin timestamptz := capa.txt(p, 'fecha_fin')::timestamptz;
  v_mod text := capa.txt(p, 'modalidad');
  v_lugar text := capa.txt(p, 'lugar');
  v_cupo int := capa.txt(p, 'cupo_maximo')::int;
  v_costo numeric := capa.txt(p, 'costo')::numeric;
  v_pct int := coalesce(capa.txt(p, 'porcentaje_minimo')::int, 80);
  v_horas int := capa.txt(p, 'horas_academicas')::int;
  v_accion text := coalesce(capa.txt(p, 'accion'), 'guardar');
  v_faltan text[] := '{}';
  v_activos int;
  r record;
begin
  perform capa.exigir_rol(u, 'organizador');

  if v_nombre is null then v_faltan := array_append(v_faltan, 'nombre'); end if;
  if v_desc is null then v_faltan := array_append(v_faltan, 'descripcion'); end if;
  if v_inicio is null then v_faltan := array_append(v_faltan, 'fecha_inicio'); end if;
  if v_fin is null then v_faltan := array_append(v_faltan, 'fecha_fin'); end if;
  if v_mod is null then v_faltan := array_append(v_faltan, 'modalidad'); end if;
  if v_cupo is null then v_faltan := array_append(v_faltan, 'cupo_maximo'); end if;
  if v_costo is null then v_faltan := array_append(v_faltan, 'costo'); end if;
  if v_horas is null then v_faltan := array_append(v_faltan, 'horas_academicas'); end if;
  if v_mod in ('presencial', 'mixta') and v_lugar is null then v_faltan := array_append(v_faltan, 'lugar'); end if;
  if cardinality(v_faltan) > 0 then
    perform capa.err('Completa los campos obligatorios resaltados.', 'CAMPOS', jsonb_build_object('campos', v_faltan));
  end if;

  if v_mod not in ('presencial', 'virtual', 'mixta') then
    perform capa.err('Elige una modalidad: presencial, virtual o mixta.', 'CAMPOS', '{"campos":["modalidad"]}');
  end if;
  if v_fin <= v_inicio then
    perform capa.err('La fecha de fin debe ser posterior a la de inicio.', 'CAMPOS', '{"campos":["fecha_fin"]}');
  end if;
  if v_cupo <= 0 then
    perform capa.err('El cupo máximo debe ser mayor que cero.', 'CAMPOS', '{"campos":["cupo_maximo"]}');
  end if;
  if v_costo < 0 then
    perform capa.err('El costo no puede ser negativo. Usa 0 para un evento gratuito.', 'CAMPOS', '{"campos":["costo"]}');
  end if;
  if v_pct not between 1 and 100 then
    perform capa.err('El porcentaje mínimo de asistencia debe estar entre 1 y 100.', 'CAMPOS', '{"campos":["porcentaje_minimo"]}');
  end if;
  if v_horas <= 0 then
    perform capa.err('Las horas académicas deben ser mayores que cero.', 'CAMPOS', '{"campos":["horas_academicas"]}');
  end if;

  pl := capa.plan_institucion(u.institucion_id);
  if v_costo > 0 then perform capa.exigir_plan(u.institucion_id, 'pagos'); end if;
  if v_mod in ('virtual', 'mixta') then perform capa.exigir_plan(u.institucion_id, 'virtual'); end if;
  if pl.max_cupo_evento is not null and v_cupo > pl.max_cupo_evento then
    perform capa.err(format('El plan %s permite hasta %s cupos por evento. Mejora tu plan para eventos más grandes.',
                            pl.nombre, pl.max_cupo_evento), 'PLAN',
                     jsonb_build_object('funcion', 'cupo', 'plan_actual', pl.codigo, 'plan_sugerido', 'Pro', 'campos', '["cupo_maximo"]'::jsonb));
  end if;

  if v_id is null then
    insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad,
                              lugar, cupo_maximo, costo, porcentaje_minimo, horas_academicas, firmante_nombre,
                              firmante_cargo, estado, creado_en, actualizado_en)
    values (u.id, u.institucion_id, v_nombre, v_desc, v_inicio, v_fin, v_mod,
            case when v_mod = 'virtual' then null else v_lugar end, v_cupo, v_costo, v_pct, v_horas,
            coalesce(capa.txt(p, 'firmante_nombre'), capa.nombre_completo(u)),
            coalesce(capa.txt(p, 'firmante_cargo'), 'Coordinación académica'),
            'borrador', capa.ahora(), capa.ahora())
    returning * into e;
  else
    ant := capa.evento_del_organizador(u, v_id, true);
    if ant.estado = 'cancelado' then
      perform capa.err('El evento está cancelado y ya no se puede editar.');
    end if;
    if capa.fase_evento(ant) = 'finalizado' then
      perform capa.err('El evento ya finalizó y no se puede editar.');
    end if;
    select count(*) into v_activos from capa.inscripciones
    where evento_id = ant.id and estado in ('confirmada', 'pendiente_pago');
    if v_activos > 0 and (v_costo <> ant.costo or v_mod <> ant.modalidad) then
      perform capa.err('Este evento ya tiene inscritos: no se pueden cambiar el costo ni la modalidad. Si necesitas otro formato, cancélalo y crea uno nuevo.',
                       'CAMPOS', jsonb_build_object('campos', array_remove(array[
                         case when v_costo <> ant.costo then 'costo' end,
                         case when v_mod <> ant.modalidad then 'modalidad' end], null)));
    end if;
    if v_cupo < capa.cupos_ocupados(ant.id) then
      perform capa.err(format('Ya hay %s cupos ocupados: el cupo máximo no puede ser menor.', capa.cupos_ocupados(ant.id)),
                       'CAMPOS', '{"campos":["cupo_maximo"]}');
    end if;

    update capa.eventos set
      nombre = v_nombre, descripcion = v_desc, fecha_inicio = v_inicio, fecha_fin = v_fin, modalidad = v_mod,
      lugar = case when v_mod = 'virtual' then null else v_lugar end,
      enlace_virtual = case when v_mod = 'presencial' then null else enlace_virtual end,
      enlace_plataforma = case when v_mod = 'presencial' then null else enlace_plataforma end,
      cupo_maximo = v_cupo, costo = v_costo, porcentaje_minimo = v_pct, horas_academicas = v_horas,
      firmante_nombre = coalesce(capa.txt(p, 'firmante_nombre'), firmante_nombre),
      firmante_cargo = coalesce(capa.txt(p, 'firmante_cargo'), firmante_cargo),
      actualizado_en = capa.ahora()
    where id = ant.id
    returning * into e;

    -- Aviso a inscritos si cambian fecha, hora o lugar (los recordatorios se reprograman solos).
    if e.estado = 'publicado' and v_activos > 0
       and (e.fecha_inicio, e.fecha_fin, e.lugar) is distinct from (ant.fecha_inicio, ant.fecha_fin, ant.lugar) then
      for r in
        select us.* from capa.inscripciones i join capa.usuarios us on us.id = i.usuario_id
        where i.evento_id = e.id and i.estado in ('confirmada', 'pendiente_pago')
      loop
        perform capa.enviar_correo(r.id, r.correo, 'Cambios en ' || e.nombre,
          'Hola ' || r.nombres || E',\n\nEl organizador actualizó la fecha, la hora o el lugar del evento. Estos son los datos vigentes:\n\n'
            || capa.datos_evento_texto(e) || E'\nTus recordatorios se reprogramaron con estos datos.',
          'cambio_evento', e.id, 'Ver el evento', '/eventos/' || e.id);
      end loop;
    end if;

    if v_cupo > ant.cupo_maximo then
      perform capa.procesar_lista_espera(e.id);
    end if;
  end if;

  if v_accion = 'publicar' then
    e := capa.publicar(e);
  end if;

  return jsonb_build_object('ok', true, 'evento', capa.evento_json(e));
end $$;

create function public.publicar_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'id')::uuid, true);
  e := capa.publicar(e);
  return jsonb_build_object('ok', true, 'evento', capa.evento_json(e));
end $$;

create function public.cancelar_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  v_motivo text := capa.txt(p, 'motivo');
  r record;
  n int := 0;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'id')::uuid, true);
  if e.estado = 'cancelado' then
    perform capa.err('El evento ya estaba cancelado.');
  end if;
  if capa.fase_evento(e) = 'finalizado' then
    perform capa.err('El evento ya finalizó; no se puede cancelar.');
  end if;
  if v_motivo is null then
    perform capa.err('Indica el motivo de la cancelación; se enviará a los inscritos.', 'CAMPOS', '{"campos":["motivo"]}');
  end if;

  update capa.eventos set estado = 'cancelado', motivo_cancelacion = v_motivo, cancelado_en = capa.ahora(),
                          actualizado_en = capa.ahora()
    where id = e.id returning * into e;

  for r in
    select i.id as ins_id, us.id, us.correo, us.nombres from capa.inscripciones i join capa.usuarios us on us.id = i.usuario_id
    where i.evento_id = e.id and i.estado in ('confirmada', 'pendiente_pago')
  loop
    update capa.inscripciones set estado = 'cancelada', cancelado_en = capa.ahora(), motivo_cancelacion = 'Evento cancelado'
      where id = r.ins_id;
    update capa.pagos set estado = 'reembolsado', actualizado_en = capa.ahora(),
                          mensaje = 'Reembolso por cancelación del evento'
      where inscripcion_id = r.ins_id and estado = 'confirmado';
    perform capa.enviar_correo(r.id, r.correo, 'Se canceló ' || e.nombre,
      'Hola ' || r.nombres || E',\n\nLamentamos informarte que el evento fue cancelado.\nMotivo: ' || v_motivo
        || E'\n\nSi pagaste tu inscripción, el reembolso se procesa por el mismo medio de pago.',
      'cancelacion', e.id);
    n := n + 1;
  end loop;
  update capa.lista_espera set estado = 'retirado', resuelto_en = capa.ahora()
    where evento_id = e.id and estado in ('esperando', 'ofrecido');

  perform capa.auditar(u, 'Canceló evento', 'evento', e.id::text,
                       format('%s · motivo: %s · %s inscripciones canceladas', e.nombre, v_motivo, n));
  return jsonb_build_object('ok', true, 'inscripciones_canceladas', n, 'evento', capa.evento_json(e));
end $$;

create function public.eliminar_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'id')::uuid, true);
  if exists (select 1 from capa.inscripciones where evento_id = e.id) then
    perform capa.err('Un evento con inscritos no se puede eliminar; solo se puede cancelar.', 'CON_INSCRITOS');
  end if;
  delete from capa.lista_espera where evento_id = e.id;
  delete from public.actividad_eventos where evento_id = e.id;
  delete from capa.eventos where id = e.id;
  return jsonb_build_object('ok', true);
end $$;

create function public.catalogo_eventos(p jsonb default '{}') returns jsonb
language sql stable security definer set search_path = capa, extensions, public as $$
  select coalesce(jsonb_agg(capa.evento_json(e) order by (e.fecha_fin < capa.ahora()), e.fecha_inicio), '[]'::jsonb)
  from capa.eventos e
  where e.estado = 'publicado'
    and (coalesce((p ->> 'incluir_pasados')::boolean, false) or e.fecha_fin >= capa.ahora())
    and (capa.txt(p, 'modalidad') is null or e.modalidad = capa.txt(p, 'modalidad'))
    and (capa.txt(p, 'precio') is null
         or (capa.txt(p, 'precio') = 'gratis' and e.costo = 0)
         or (capa.txt(p, 'precio') = 'pago' and e.costo > 0))
    and (capa.txt(p, 'q') is null
         or e.nombre ilike '%' || capa.txt(p, 'q') || '%'
         or e.descripcion ilike '%' || capa.txt(p, 'q') || '%'
         or exists (select 1 from capa.instituciones i where i.id = e.institucion_id
                    and (i.nombre ilike '%' || capa.txt(p, 'q') || '%' or i.siglas ilike '%' || capa.txt(p, 'q') || '%')))
$$;

create function public.detalle_evento(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_opcional(p);
  e capa.eventos;
  ins capa.inscripciones;
  le capa.lista_espera;
  es_org boolean;
  es_ponente boolean;
  ve_enlace boolean;
  r jsonb;
begin
  select * into e from capa.eventos where id = capa.txt(p, 'id')::uuid;
  if not found then
    perform capa.err('No encontramos este evento.', 'NO_ENCONTRADO');
  end if;
  es_org := u.id is not null and u.id = e.organizador_id;
  es_ponente := u.id is not null and exists (select 1 from capa.ponentes where evento_id = e.id and usuario_id = u.id);
  if e.estado = 'borrador' and not (es_org or es_ponente or coalesce(u.rol = 'admin', false)) then
    perform capa.err('No encontramos este evento.', 'NO_ENCONTRADO');
  end if;

  if u.id is not null then
    select * into ins from capa.inscripciones
    where evento_id = e.id and usuario_id = u.id
    order by (estado in ('confirmada', 'pendiente_pago')) desc, creado_en desc limit 1;
    select * into le from capa.lista_espera
    where evento_id = e.id and usuario_id = u.id and estado in ('esperando', 'ofrecido');
  end if;
  ve_enlace := es_org or es_ponente or coalesce(ins.estado = 'confirmada', false);

  r := capa.evento_json(e) || jsonb_build_object(
    'enlace_virtual', case when ve_enlace then e.enlace_virtual end,
    'es_organizador', es_org,
    'es_ponente', es_ponente,
    'ponentes', (select coalesce(jsonb_agg(jsonb_build_object('id', pn.id, 'nombre', pn.nombre, 'foto', pn.foto,
                                                              'biografia', pn.biografia)
                                           order by pn.orden, pn.creado_en), '[]'::jsonb)
                 from capa.ponentes pn where pn.evento_id = e.id),
    'sesiones', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', s.id, 'titulo', s.titulo, 'descripcion', s.descripcion, 'inicio', s.inicio, 'fin', s.fin,
                    'ponentes', (select coalesce(jsonb_agg(jsonb_build_object('id', pn.id, 'nombre', pn.nombre) order by pn.nombre), '[]'::jsonb)
                                 from capa.sesion_ponentes sp join capa.ponentes pn on pn.id = sp.ponente_id
                                 where sp.sesion_id = s.id))
                  order by s.inicio), '[]'::jsonb)
                 from capa.sesiones_programa s where s.evento_id = e.id),
    'mi_inscripcion', case when ins.id is not null then capa.inscripcion_json(ins) end,
    'mi_lista_espera', case when le.id is not null then jsonb_build_object(
        'id', le.id, 'estado', le.estado, 'oferta_expira_en', le.oferta_expira_en,
        'posicion', (select count(*) from capa.lista_espera x where x.evento_id = e.id and x.estado = 'esperando'
                     and (x.solicitado_en, x.id) <= (le.solicitado_en, le.id))) end
  );
  return r;
end $$;

create function public.eventos_organizador(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
begin
  perform capa.exigir_rol(u, 'organizador');
  return (
    select coalesce(jsonb_agg(capa.evento_json(e) || jsonb_build_object(
      'inscritos', (select count(*) from capa.inscripciones i where i.evento_id = e.id and i.estado = 'confirmada'),
      'pendientes_pago', (select count(*) from capa.inscripciones i where i.evento_id = e.id and i.estado = 'pendiente_pago'),
      'asistentes', (select count(distinct a.inscripcion_id) from capa.asistencias a where a.evento_id = e.id),
      'ingresos', (select coalesce(sum(pg.monto), 0) from capa.pagos pg where pg.evento_id = e.id and pg.estado = 'confirmado'),
      'tiene_inscripciones', exists (select 1 from capa.inscripciones i where i.evento_id = e.id)
    ) order by e.fecha_inicio desc), '[]'::jsonb)
    from capa.eventos e where e.organizador_id = u.id
  );
end $$;

-- Vista completa del evento para su organizador: datos, cupos, inscritos y lista de espera (HU-05 CA-05).
create function public.evento_gestion(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  tot int;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'id')::uuid);
  tot := capa.total_jornadas(e);
  return capa.evento_json(e) || jsonb_build_object(
    'enlace_virtual', e.enlace_virtual,
    'tiene_inscripciones', exists (select 1 from capa.inscripciones i where i.evento_id = e.id),
    'cupos', jsonb_build_object(
      'total', e.cupo_maximo,
      'ocupados', capa.cupos_ocupados(e.id),
      'disponibles', greatest(e.cupo_maximo - capa.cupos_ocupados(e.id), 0),
      'confirmados', (select count(*) from capa.inscripciones where evento_id = e.id and estado = 'confirmada'),
      'pendientes_pago', (select count(*) from capa.inscripciones where evento_id = e.id and estado = 'pendiente_pago'),
      'ofrecidos', (select count(*) from capa.lista_espera where evento_id = e.id and estado = 'ofrecido'),
      'en_espera', (select count(*) from capa.lista_espera where evento_id = e.id and estado = 'esperando')),
    'inscritos', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', i.id, 'nombre', us.nombres || ' ' || us.apellidos, 'correo', us.correo, 'estado', i.estado,
        'creado_en', i.creado_en, 'monto', i.monto, 'reserva_expira_en', i.reserva_expira_en,
        'pago', (select pg.estado from capa.pagos pg where pg.inscripcion_id = i.id order by pg.creado_en desc limit 1),
        'jornadas_asistidas', (select count(*) from capa.asistencias a where a.inscripcion_id = i.id),
        'total_jornadas', tot)
        order by i.creado_en), '[]'::jsonb)
      from capa.inscripciones i join capa.usuarios us on us.id = i.usuario_id
      where i.evento_id = e.id),
    'lista_espera', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'nombre', us.nombres || ' ' || us.apellidos, 'correo', us.correo, 'estado', l.estado,
        'solicitado_en', l.solicitado_en, 'oferta_expira_en', l.oferta_expira_en)
        order by l.solicitado_en, l.id), '[]'::jsonb)
      from capa.lista_espera l join capa.usuarios us on us.id = l.usuario_id
      where l.evento_id = e.id and l.estado in ('esperando', 'ofrecido')),
    'plan', to_jsonb(capa.plan_institucion(e.institucion_id)) - 'actualizado_en'
  );
end $$;

-- ---------------------------------------------------------------------------
-- HU-03 / HU-05 · Inscripción, cupos y lista de espera
-- ---------------------------------------------------------------------------

create function capa.crear_inscripcion(e capa.eventos, u capa.usuarios) returns capa.inscripciones
language plpgsql as $$
declare
  ins capa.inscripciones;
begin
  if e.costo = 0 then
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, creado_en, confirmado_en)
    values (e.id, u.id, 'confirmada', 0, capa.ahora(), capa.ahora())
    returning * into ins;
    perform capa.enviar_correo(u.id, u.correo, 'Inscripción confirmada: ' || e.nombre,
      'Hola ' || u.nombres || E',\n\nTu inscripción quedó confirmada. Estos son los datos del evento:\n\n'
        || capa.datos_evento_texto(e)
        || E'\nTu código QR de ingreso está en "Mis inscripciones". Te enviaremos recordatorios 24 horas y 1 hora antes.',
      'inscripcion', e.id, 'Ver mi inscripción', '/mis-inscripciones');
  else
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, reserva_expira_en, creado_en)
    values (e.id, u.id, 'pendiente_pago', e.costo, capa.ahora() + interval '30 minutes', capa.ahora())
    returning * into ins;
    perform capa.enviar_correo(u.id, u.correo, 'Inscripción registrada: completa tu pago',
      'Hola ' || u.nombres || E',\n\nRegistramos tu inscripción y reservamos tu cupo. Para confirmarla, paga '
        || capa.fmt_monto(e.costo) || ' con Yape, Plin o PayPal antes del ' || capa.fmt_fecha(ins.reserva_expira_en)
        || E'. Si no se confirma el pago en 30 minutos, el cupo se libera.\n\n' || capa.datos_evento_texto(e),
      'inscripcion', e.id, 'Pagar ahora', '/mis-inscripciones');
  end if;
  return ins;
end $$;

create function public.inscribirse(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  ins capa.inscripciones;
  le capa.lista_espera;
  v_pos int;
begin
  if u.rol = 'admin' then
    perform capa.err('La cuenta de administración no se inscribe en eventos.', 'PROHIBIDO');
  end if;
  -- Bloqueo de la fila del evento: dos solicitudes por el último cupo se atienden
  -- una tras otra, nunca a la vez (HU-05 CA-04).
  select * into e from capa.eventos where id = capa.txt(p, 'evento_id')::uuid for update;
  if not found or e.estado <> 'publicado' then
    perform capa.err('Este evento no está disponible para inscripciones.', 'NO_DISPONIBLE');
  end if;
  if e.organizador_id = u.id then
    perform capa.err('No puedes inscribirte en un evento que organizas.', 'PROHIBIDO');
  end if;
  if e.fecha_inicio <= capa.ahora() then
    perform capa.err('Las inscripciones cerraron porque el evento ya empezó.', 'NO_DISPONIBLE');
  end if;

  select * into ins from capa.inscripciones
  where evento_id = e.id and usuario_id = u.id and estado in ('confirmada', 'pendiente_pago');
  if found then
    return jsonb_build_object('ok', false, 'motivo', 'ya_inscrito',
      'mensaje', 'Ya estás inscrito en este evento.', 'inscripcion', capa.inscripcion_json(ins));
  end if;

  select * into le from capa.lista_espera
  where evento_id = e.id and usuario_id = u.id and estado in ('esperando', 'ofrecido');
  if found then
    if le.estado = 'ofrecido' then
      return jsonb_build_object('ok', false, 'motivo', 'oferta_pendiente',
        'mensaje', 'Tienes un cupo reservado desde la lista de espera. Confírmalo en Mis inscripciones.');
    end if;
    select count(*) into v_pos from capa.lista_espera
    where evento_id = e.id and estado = 'esperando' and (solicitado_en, id) <= (le.solicitado_en, le.id);
    return jsonb_build_object('ok', false, 'motivo', 'en_espera', 'posicion', v_pos,
      'mensaje', format('Ya estás en la lista de espera, en la posición %s.', v_pos));
  end if;

  if capa.cupos_ocupados(e.id) >= e.cupo_maximo then
    if coalesce((p ->> 'lista_espera_automatica')::boolean, false) then
      insert into capa.lista_espera (evento_id, usuario_id, solicitado_en)
      values (e.id, u.id, capa.ahora()) returning * into le;
      select count(*) into v_pos from capa.lista_espera where evento_id = e.id and estado = 'esperando';
      perform capa.enviar_correo(u.id, u.correo, 'Estás en la lista de espera de ' || e.nombre,
        'Hola ' || u.nombres || E',\n\nLos cupos se agotaron justo antes de tu solicitud. Te agregamos a la lista de espera en la posición '
          || v_pos || '. Si se libera un cupo, te avisaremos por correo y tendrás 24 horas para confirmarlo.',
        'lista_espera', e.id, 'Ver el evento', '/eventos/' || e.id);
      return jsonb_build_object('ok', false, 'motivo', 'sin_cupos', 'en_lista_espera', true, 'posicion', v_pos,
        'mensaje', format('El último cupo se acaba de ocupar. Te agregamos a la lista de espera en la posición %s.', v_pos));
    end if;
    return jsonb_build_object('ok', false, 'motivo', 'sin_cupos', 'en_lista_espera', false,
      'mensaje', 'Los cupos se agotaron. Únete a la lista de espera y te avisaremos por correo si se libera uno.');
  end if;

  ins := capa.crear_inscripcion(e, u);
  return jsonb_build_object('ok', true, 'inscripcion', capa.inscripcion_json(ins),
                            'evento', capa.evento_json(e));
end $$;

create function public.unirse_lista_espera(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  le capa.lista_espera;
  v_pos int;
begin
  select * into e from capa.eventos where id = capa.txt(p, 'evento_id')::uuid for update;
  if not found or e.estado <> 'publicado' or e.fecha_inicio <= capa.ahora() then
    perform capa.err('Este evento no admite lista de espera.', 'NO_DISPONIBLE');
  end if;
  if exists (select 1 from capa.inscripciones where evento_id = e.id and usuario_id = u.id
             and estado in ('confirmada', 'pendiente_pago')) then
    perform capa.err('Ya estás inscrito en este evento.');
  end if;
  if exists (select 1 from capa.lista_espera where evento_id = e.id and usuario_id = u.id
             and estado in ('esperando', 'ofrecido')) then
    perform capa.err('Ya estás en la lista de espera de este evento.');
  end if;
  if capa.cupos_ocupados(e.id) < e.cupo_maximo then
    perform capa.err('Todavía hay cupos disponibles: inscríbete directamente.', 'HAY_CUPOS');
  end if;
  insert into capa.lista_espera (evento_id, usuario_id, solicitado_en)
  values (e.id, u.id, capa.ahora()) returning * into le;
  select count(*) into v_pos from capa.lista_espera where evento_id = e.id and estado = 'esperando';
  perform capa.enviar_correo(u.id, u.correo, 'Estás en la lista de espera de ' || e.nombre,
    'Hola ' || u.nombres || E',\n\nTe uniste a la lista de espera en la posición ' || v_pos
      || '. Si se libera un cupo, te avisaremos por correo y tendrás 24 horas para confirmarlo.',
    'lista_espera', e.id, 'Ver el evento', '/eventos/' || e.id);
  return jsonb_build_object('ok', true, 'posicion', v_pos,
    'mensaje', format('Te uniste a la lista de espera en la posición %s.', v_pos));
end $$;

create function public.salir_lista_espera(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  le capa.lista_espera;
begin
  select * into le from capa.lista_espera where id = capa.txt(p, 'id')::uuid for update;
  if not found or le.usuario_id <> u.id or le.estado not in ('esperando', 'ofrecido') then
    perform capa.err('No encontramos tu lugar en la lista de espera.', 'NO_ENCONTRADO');
  end if;
  update capa.lista_espera set estado = 'retirado', resuelto_en = capa.ahora() where id = le.id;
  if le.estado = 'ofrecido' then
    perform capa.procesar_lista_espera(le.evento_id);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create function public.aceptar_oferta_espera(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  le capa.lista_espera;
  e capa.eventos;
  ins capa.inscripciones;
begin
  select * into le from capa.lista_espera where id = capa.txt(p, 'id')::uuid for update;
  if not found or le.usuario_id <> u.id then
    perform capa.err('No encontramos esta oferta de cupo.', 'NO_ENCONTRADO');
  end if;
  if le.estado <> 'ofrecido' or le.oferta_expira_en <= capa.ahora() then
    perform capa.err('Esta oferta de cupo ya no está vigente.', 'VENCIDA');
  end if;
  select * into e from capa.eventos where id = le.evento_id for update;
  if e.estado <> 'publicado' or e.fecha_inicio <= capa.ahora() then
    perform capa.err('El evento ya no admite inscripciones.', 'NO_DISPONIBLE');
  end if;
  update capa.lista_espera set estado = 'aceptado', resuelto_en = capa.ahora() where id = le.id;
  ins := capa.crear_inscripcion(e, u);
  return jsonb_build_object('ok', true, 'inscripcion', capa.inscripcion_json(ins));
end $$;

create function public.cancelar_inscripcion(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  ins capa.inscripciones;
  e capa.eventos;
begin
  select * into ins from capa.inscripciones where id = capa.txt(p, 'id')::uuid for update;
  if not found or ins.usuario_id <> u.id then
    perform capa.err('No encontramos esta inscripción.', 'NO_ENCONTRADO');
  end if;
  if ins.estado not in ('confirmada', 'pendiente_pago') then
    perform capa.err('Esta inscripción ya no está vigente.');
  end if;
  select * into e from capa.eventos where id = ins.evento_id for update;
  if e.fecha_inicio - interval '24 hours' <= capa.ahora() then
    perform capa.err('Solo puedes cancelar tu inscripción hasta 24 horas antes del inicio del evento.', 'FUERA_DE_PLAZO');
  end if;
  update capa.inscripciones set estado = 'cancelada', cancelado_en = capa.ahora(),
                                motivo_cancelacion = 'Cancelada por el asistente', reserva_expira_en = null
    where id = ins.id;
  update capa.pagos set estado = 'reembolsado', actualizado_en = capa.ahora(), mensaje = 'Reembolso por cancelación'
    where inscripcion_id = ins.id and estado = 'confirmado';
  update capa.pagos set estado = 'rechazado', actualizado_en = capa.ahora(), mensaje = 'Inscripción cancelada'
    where inscripcion_id = ins.id and estado = 'procesando';
  perform capa.enviar_correo(u.id, u.correo, 'Cancelaste tu inscripción en ' || e.nombre,
    'Hola ' || u.nombres || E',\n\nTu inscripción fue cancelada y tu cupo quedó libre para otra persona.'
      || case when ins.monto > 0 and ins.estado = 'confirmada' then E'\nEl reembolso de ' || capa.fmt_monto(ins.monto) || ' se procesa por el mismo medio de pago.' else '' end,
    'cancelacion', e.id);
  perform capa.procesar_lista_espera(e.id);
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- HU-04 · Pagos (pasarela simulada: Yape, Plin, PayPal)
-- No se guardan tarjetas ni credenciales: solo el resultado y una referencia.
-- ---------------------------------------------------------------------------

create function capa.pago_json(pg capa.pagos) returns jsonb
language sql stable as $$
  select jsonb_build_object('id', pg.id, 'inscripcion_id', pg.inscripcion_id, 'metodo', pg.metodo, 'monto', pg.monto,
    'estado', pg.estado, 'referencia_externa', pg.referencia_externa, 'numero_comprobante', pg.numero_comprobante,
    'mensaje', pg.mensaje, 'creado_en', pg.creado_en, 'actualizado_en', pg.actualizado_en)
$$;

create function public.iniciar_pago(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  ins capa.inscripciones;
  pg capa.pagos;
  v_metodo text := capa.txt(p, 'metodo');
begin
  select * into ins from capa.inscripciones where id = capa.txt(p, 'inscripcion_id')::uuid for update;
  if not found or ins.usuario_id <> u.id then
    perform capa.err('No encontramos esta inscripción.', 'NO_ENCONTRADO');
  end if;
  if ins.estado <> 'pendiente_pago' then
    perform capa.err('Esta inscripción no tiene un pago pendiente.');
  end if;
  if ins.reserva_expira_en <= capa.ahora() then
    perform capa.err('Tu reserva venció y el cupo se liberó. Vuelve a inscribirte si aún hay cupos.', 'VENCIDA');
  end if;
  if v_metodo not in ('yape', 'plin', 'paypal') then
    perform capa.err('Elige un medio de pago: Yape, Plin o PayPal.', 'CAMPOS', '{"campos":["metodo"]}');
  end if;
  update capa.pagos set estado = 'sin_respuesta', mensaje = 'Intento abandonado', actualizado_en = capa.ahora()
    where inscripcion_id = ins.id and estado = 'procesando';
  insert into capa.pagos (inscripcion_id, evento_id, usuario_id, metodo, monto, creado_en, actualizado_en)
  values (ins.id, ins.evento_id, u.id, v_metodo, ins.monto, capa.ahora(), capa.ahora())
  returning * into pg;
  return jsonb_build_object('ok', true, 'pago', capa.pago_json(pg), 'reserva_expira_en', ins.reserva_expira_en);
end $$;

-- Respuesta de la pasarela. En producción la enviaría la plataforma de pago
-- (webhook firmado); en esta versión la produce el simulador de la interfaz.
create function public.respuesta_pasarela(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  pg capa.pagos;
  ins capa.inscripciones;
  e capa.eventos;
  v_res text := capa.txt(p, 'resultado');
  v_metodo text;
begin
  select * into pg from capa.pagos where id = capa.txt(p, 'pago_id')::uuid for update;
  if not found or pg.usuario_id <> u.id then
    perform capa.err('No encontramos este pago.', 'NO_ENCONTRADO');
  end if;
  if pg.estado <> 'procesando' then
    perform capa.err('Este intento de pago ya fue procesado.');
  end if;
  v_metodo := case pg.metodo when 'yape' then 'Yape' when 'plin' then 'Plin' else 'PayPal' end;
  select * into ins from capa.inscripciones where id = pg.inscripcion_id for update;
  select * into e from capa.eventos where id = ins.evento_id;

  if ins.estado <> 'pendiente_pago' or ins.reserva_expira_en <= capa.ahora() then
    update capa.pagos set estado = 'rechazado', mensaje = 'La reserva ya no estaba vigente', actualizado_en = capa.ahora()
      where id = pg.id;
    return jsonb_build_object('ok', false, 'motivo', 'vencida',
      'mensaje', 'Tu reserva venció antes de confirmar el pago y no se realizó ningún cobro.');
  end if;

  if v_res = 'aprobado' then
    update capa.pagos set
      estado = 'confirmado',
      referencia_externa = coalesce(capa.txt(p, 'referencia'), upper(pg.metodo) || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex'))),
      numero_comprobante = 'CP-' || to_char(capa.ahora() at time zone 'America/Lima', 'YYYY') || '-'
                           || lpad(nextval('capa.comprobante_seq')::text, 6, '0'),
      mensaje = 'Pago aprobado por ' || v_metodo,
      actualizado_en = capa.ahora()
    where id = pg.id returning * into pg;
    update capa.inscripciones set estado = 'confirmada', confirmado_en = capa.ahora(), reserva_expira_en = null
      where id = ins.id;
    perform capa.enviar_correo(u.id, u.correo, 'Pago confirmado · comprobante ' || pg.numero_comprobante,
      'Hola ' || u.nombres || E',\n\nRecibimos tu pago de ' || capa.fmt_monto(pg.monto) || ' con ' || v_metodo
        || E'. Tu inscripción quedó confirmada.\n\nComprobante: ' || pg.numero_comprobante
        || E'\nReferencia de la operación: ' || pg.referencia_externa || E'\n\n' || capa.datos_evento_texto(e),
      'pago', e.id, 'Descargar comprobante', '/mis-inscripciones?comprobante=' || pg.id);
    return jsonb_build_object('ok', true, 'pago', capa.pago_json(pg));
  elsif v_res = 'rechazado' then
    update capa.pagos set estado = 'rechazado', mensaje = v_metodo || ' rechazó el cobro', actualizado_en = capa.ahora()
      where id = pg.id returning * into pg;
    return jsonb_build_object('ok', false, 'motivo', 'rechazado', 'pago', capa.pago_json(pg),
      'reserva_expira_en', ins.reserva_expira_en,
      'mensaje', v_metodo || ' rechazó el cobro y no se descontó nada. Tu inscripción sigue pendiente: puedes reintentar con el mismo u otro medio.');
  elsif v_res = 'sin_respuesta' then
    update capa.pagos set estado = 'sin_respuesta', mensaje = v_metodo || ' no respondió', actualizado_en = capa.ahora()
      where id = pg.id returning * into pg;
    return jsonb_build_object('ok', false, 'motivo', 'sin_respuesta', 'pago', capa.pago_json(pg),
      'reserva_expira_en', ins.reserva_expira_en,
      'mensaje', v_metodo || ' no respondió a tiempo y no se realizó ningún cobro. Tu inscripción sigue pendiente: puedes reintentar.');
  end if;
  perform capa.err('Respuesta de pasarela desconocida.');
  return null;
end $$;

create function public.comprobante_pago(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  pg capa.pagos;
  e capa.eventos;
  titular capa.usuarios;
begin
  select * into pg from capa.pagos where id = capa.txt(p, 'pago_id')::uuid;
  if not found then
    perform capa.err('No encontramos este pago.', 'NO_ENCONTRADO');
  end if;
  select * into e from capa.eventos where id = pg.evento_id;
  if pg.usuario_id <> u.id and e.organizador_id <> u.id then
    perform capa.err('No tienes acceso a este comprobante.', 'PROHIBIDO');
  end if;
  if pg.numero_comprobante is null then
    perform capa.err('Este pago no tiene comprobante porque no fue confirmado.');
  end if;
  select * into titular from capa.usuarios where id = pg.usuario_id;
  return capa.pago_json(pg) || jsonb_build_object(
    'titular', capa.nombre_completo(titular), 'correo', titular.correo,
    'evento', e.nombre, 'evento_fecha', e.fecha_inicio,
    'institucion', (select nombre from capa.instituciones where id = e.institucion_id));
end $$;
