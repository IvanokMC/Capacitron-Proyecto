-- CAPACITRON · Funciones de operación
-- Asistencia QR, certificados y verificación, reportes, programa y ponentes,
-- eventos virtuales, administración, correos, encuestas y tareas programadas
-- (HU-06 a HU-14).

-- ---------------------------------------------------------------------------
-- HU-07 · Asistencia con QR
-- ---------------------------------------------------------------------------

create function public.registrar_asistencia(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  ins capa.inscripciones;
  titular capa.usuarios;
  a capa.asistencias;
  v_codigo text := lower(regexp_replace(coalesce(trim(p ->> 'codigo'), ''), '^capacitron:', '', 'i'));
  v_jornada date := (capa.ahora() at time zone 'America/Lima')::date;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'evento_id')::uuid);
  if e.estado <> 'publicado' then
    return jsonb_build_object('ok', false, 'tipo', 'fuera_de_horario', 'mensaje', 'El evento no está publicado.');
  end if;
  if capa.ahora() < e.fecha_inicio - interval '1 hour' or capa.ahora() > e.fecha_fin then
    return jsonb_build_object('ok', false, 'tipo', 'fuera_de_horario',
      'mensaje', 'El registro de asistencia se habilita desde 1 hora antes del inicio hasta el fin del evento.');
  end if;

  select * into ins from capa.inscripciones where codigo_qr = v_codigo;
  if not found or ins.evento_id <> e.id then
    return jsonb_build_object('ok', false, 'tipo', 'rechazado',
      'mensaje', 'Este código QR no corresponde a una inscripción de este evento.');
  end if;
  select * into titular from capa.usuarios where id = ins.usuario_id;
  if ins.estado <> 'confirmada' then
    return jsonb_build_object('ok', false, 'tipo', 'rechazado', 'nombre', capa.nombre_completo(titular),
      'mensaje', case ins.estado
        when 'pendiente_pago' then 'La inscripción de ' || capa.nombre_completo(titular) || ' tiene el pago pendiente.'
        else 'La inscripción de ' || capa.nombre_completo(titular) || ' no está confirmada (' || replace(ins.estado, '_', ' ') || ').' end);
  end if;

  select * into a from capa.asistencias where inscripcion_id = ins.id and jornada = v_jornada;
  if found then
    return jsonb_build_object('ok', false, 'tipo', 'duplicado', 'nombre', capa.nombre_completo(titular),
      'registrado_en', a.registrado_en,
      'mensaje', capa.nombre_completo(titular) || ' ya ingresó hoy a las '
                 || to_char(a.registrado_en at time zone 'America/Lima', 'HH24:MI') || ' h.');
  end if;

  insert into capa.asistencias (inscripcion_id, evento_id, jornada, registrado_en, registrado_por)
  values (ins.id, e.id, v_jornada, capa.ahora(), u.id) returning * into a;
  return jsonb_build_object('ok', true, 'tipo', 'registrado', 'nombre', capa.nombre_completo(titular),
    'registrado_en', a.registrado_en, 'jornada', a.jornada,
    'mensaje', 'Asistencia registrada: ' || capa.nombre_completo(titular) || '.');
end $$;

create function public.asistencia_evento(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  v_jornada date := (capa.ahora() at time zone 'America/Lima')::date;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'evento_id')::uuid);
  return jsonb_build_object(
    'evento', capa.evento_json(e),
    'jornada_actual', v_jornada,
    'total_jornadas', capa.total_jornadas(e),
    'habilitado', e.estado = 'publicado' and capa.ahora() between e.fecha_inicio - interval '1 hour' and e.fecha_fin,
    'confirmados', (select count(*) from capa.inscripciones where evento_id = e.id and estado = 'confirmada'),
    'presentes_hoy', (select count(*) from capa.asistencias where evento_id = e.id and jornada = v_jornada),
    'asistentes_total', (select count(distinct inscripcion_id) from capa.asistencias where evento_id = e.id),
    'registros', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'nombre', us.nombres || ' ' || us.apellidos, 'registrado_en', a.registrado_en, 'jornada', a.jornada)
        order by a.registrado_en desc), '[]'::jsonb)
      from capa.asistencias a
      join capa.inscripciones i on i.id = a.inscripcion_id
      join capa.usuarios us on us.id = i.usuario_id
      where a.evento_id = e.id)
  );
end $$;

-- ---------------------------------------------------------------------------
-- HU-08 · Certificados digitales
-- ---------------------------------------------------------------------------

create function capa.codigo_certificado() returns text
language plpgsql as $$
declare
  alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  c text;
begin
  loop
    b := extensions.gen_random_bytes(12);
    c := '';
    for k in 0..11 loop
      c := c || substr(alfabeto, (get_byte(b, k) % 32) + 1, 1);
      if k in (3, 7) then c := c || '-'; end if;
    end loop;
    c := 'CAP-' || c;
    exit when not exists (select 1 from capa.certificados where codigo = c);
  end loop;
  return c;
end $$;

create function capa.porcentaje_asistencia(ins capa.inscripciones, e capa.eventos) returns numeric
language sql stable as $$
  select round(100.0 * (select count(distinct jornada) from capa.asistencias where inscripcion_id = ins.id)
               / greatest(capa.total_jornadas(e), 1), 2)
$$;

-- Emite los certificados de un evento finalizado a quienes cumplen el porcentaje mínimo.
create function capa.emitir_certificados(ev uuid) returns int
language plpgsql as $$
declare
  e capa.eventos;
  r record;
  v_pct numeric;
  v_codigo text;
  n int := 0;
begin
  select * into e from capa.eventos where id = ev for update;
  if not found or e.estado <> 'publicado' or e.fecha_fin > capa.ahora() or e.certificados_emitidos_en is not null then
    return 0;
  end if;
  for r in
    select i.*, us.nombres, us.apellidos, us.correo as u_correo
    from capa.inscripciones i join capa.usuarios us on us.id = i.usuario_id
    where i.evento_id = e.id and i.estado = 'confirmada'
  loop
    v_pct := round(100.0 * (select count(distinct jornada) from capa.asistencias where inscripcion_id = r.id)
                   / greatest(capa.total_jornadas(e), 1), 2);
    if v_pct >= e.porcentaje_minimo and not exists (select 1 from capa.certificados where inscripcion_id = r.id) then
      v_codigo := capa.codigo_certificado();
      insert into capa.certificados (codigo, inscripcion_id, evento_id, usuario_id, titular_nombre, porcentaje_asistencia, emitido_en)
      values (v_codigo, r.id, e.id, r.usuario_id, r.nombres || ' ' || r.apellidos, v_pct, capa.ahora());
      perform capa.enviar_correo(r.usuario_id, r.u_correo, 'Tu certificado de ' || e.nombre || ' está listo',
        'Hola ' || r.nombres || E',\n\nCumpliste la asistencia mínima (' || v_pct || ' %) y tu certificado digital ya está disponible.'
          || E'\nCódigo de verificación: ' || v_codigo
          || E'\n\nCualquier persona puede comprobar su autenticidad en la página de verificación de CAPACITRON.',
        'certificado', e.id, 'Descargar certificado', '/mis-inscripciones');
      n := n + 1;
    end if;
  end loop;
  update capa.eventos set certificados_emitidos_en = capa.ahora() where id = e.id;
  return n;
end $$;

create function capa.certificado_json(c capa.certificados) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', c.id, 'codigo', c.codigo, 'titular', c.titular_nombre, 'estado', c.estado,
    'emitido_en', c.emitido_en, 'revocado_en', c.revocado_en, 'motivo_revocacion', c.motivo_revocacion,
    'porcentaje_asistencia', c.porcentaje_asistencia,
    'evento', e.nombre, 'fecha_inicio', e.fecha_inicio, 'fecha_fin', e.fecha_fin, 'horas_academicas', e.horas_academicas,
    'modalidad', e.modalidad, 'firmante_nombre', e.firmante_nombre, 'firmante_cargo', e.firmante_cargo,
    'institucion', (select nombre from capa.instituciones where id = e.institucion_id))
  from capa.eventos e where e.id = c.evento_id
$$;

create function public.mi_certificado(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  ins capa.inscripciones;
  e capa.eventos;
  c capa.certificados;
  v_pct numeric;
  v_asis int;
begin
  select * into ins from capa.inscripciones where id = capa.txt(p, 'inscripcion_id')::uuid;
  if not found or ins.usuario_id <> u.id then
    perform capa.err('No encontramos esta inscripción.', 'NO_ENCONTRADO');
  end if;
  select * into e from capa.eventos where id = ins.evento_id;
  if e.estado = 'publicado' and e.fecha_fin <= capa.ahora() and e.certificados_emitidos_en is null then
    perform capa.emitir_certificados(e.id);
  end if;
  select * into c from capa.certificados where inscripcion_id = ins.id;
  if found then
    return jsonb_build_object('elegible', true, 'certificado', capa.certificado_json(c));
  end if;
  if ins.estado <> 'confirmada' then
    return jsonb_build_object('elegible', false, 'mensaje', 'No eres elegible: tu inscripción no está confirmada.');
  end if;
  if e.fecha_fin > capa.ahora() then
    return jsonb_build_object('elegible', false,
      'mensaje', 'El certificado estará disponible cuando el evento termine (' || capa.fmt_fecha(e.fecha_fin) || ').');
  end if;
  v_pct := capa.porcentaje_asistencia(ins, e);
  select count(distinct jornada) into v_asis from capa.asistencias where inscripcion_id = ins.id;
  return jsonb_build_object('elegible', false, 'porcentaje', v_pct,
    'mensaje', format('No eres elegible: asististe a %s de %s %s (%s %%) y este evento exige un mínimo de %s %%.',
                      v_asis, capa.total_jornadas(e), case when capa.total_jornadas(e) = 1 then 'jornada' else 'jornadas' end,
                      trim(to_char(v_pct, 'FM990D##')), e.porcentaje_minimo));
end $$;

create function public.certificados_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'evento_id')::uuid);
  if e.estado = 'publicado' and e.fecha_fin <= capa.ahora() and e.certificados_emitidos_en is null then
    perform capa.emitir_certificados(e.id);
    select * into e from capa.eventos where id = e.id;
  end if;
  return jsonb_build_object(
    'evento', capa.evento_json(e),
    'emitidos_en', e.certificados_emitidos_en,
    'participantes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'inscripcion_id', i.id,
        'nombre', us.nombres || ' ' || us.apellidos,
        'correo', us.correo,
        'porcentaje', capa.porcentaje_asistencia(i, e),
        'certificado', case when c.id is not null then jsonb_build_object(
          'id', c.id, 'codigo', c.codigo, 'estado', c.estado, 'emitido_en', c.emitido_en,
          'revocado_en', c.revocado_en, 'motivo_revocacion', c.motivo_revocacion) end)
        order by us.apellidos, us.nombres), '[]'::jsonb)
      from capa.inscripciones i
      join capa.usuarios us on us.id = i.usuario_id
      left join capa.certificados c on c.inscripcion_id = i.id
      where i.evento_id = e.id and i.estado = 'confirmada')
  );
end $$;

create function public.revocar_certificado(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  c capa.certificados;
  e capa.eventos;
  titular capa.usuarios;
  v_motivo text := capa.txt(p, 'motivo');
begin
  perform capa.exigir_rol(u, 'organizador');
  select * into c from capa.certificados where id = capa.txt(p, 'certificado_id')::uuid for update;
  if not found then
    perform capa.err('No encontramos este certificado.', 'NO_ENCONTRADO');
  end if;
  e := capa.evento_del_organizador(u, c.evento_id);
  if c.estado = 'revocado' then
    perform capa.err('Este certificado ya estaba revocado.');
  end if;
  if v_motivo is null then
    perform capa.err('Indica el motivo de la revocación; quedará registrado.', 'CAMPOS', '{"campos":["motivo"]}');
  end if;
  update capa.certificados set estado = 'revocado', revocado_en = capa.ahora(), motivo_revocacion = v_motivo,
                               revocado_por = u.id
    where id = c.id returning * into c;
  select * into titular from capa.usuarios where id = c.usuario_id;
  perform capa.enviar_correo(titular.id, titular.correo, 'Tu certificado de ' || e.nombre || ' fue revocado',
    'Hola ' || titular.nombres || E',\n\nEl organizador revocó tu certificado ' || c.codigo || E'.\nMotivo: ' || v_motivo
      || E'\n\nSi crees que es un error, comunícate con el organizador del evento.',
    'certificado', e.id);
  perform capa.auditar(u, 'Revocó certificado', 'certificado', c.codigo,
                       format('%s · %s · motivo: %s', c.titular_nombre, e.nombre, v_motivo));
  return jsonb_build_object('ok', true, 'certificado', capa.certificado_json(c));
end $$;

-- ---------------------------------------------------------------------------
-- HU-09 · Verificación pública de certificados (sin sesión)
-- ---------------------------------------------------------------------------

create function public.verificar_certificado(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  v_headers json;
  v_sol text;
  v_codigo text := upper(regexp_replace(coalesce(trim(p ->> 'codigo'), ''), '^.*/', ''));
  v_bloq timestamptz;
  v_fallos int;
  v_min int;
  c capa.certificados;
  e capa.eventos;
begin
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_headers := null;
  end;
  -- En Supabase se usa la IP del solicitante; en modo local, el id del navegador.
  v_sol := coalesce(nullif(trim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
                    capa.txt(p, 'solicitante'), 'anonimo');

  select bloqueado_hasta into v_bloq from capa.bloqueos_verificacion where solicitante = v_sol;
  if v_bloq is not null and v_bloq > capa.ahora() then
    insert into capa.verificaciones (codigo_consultado, solicitante, resultado, creado_en)
    values (left(v_codigo, 64), v_sol, 'bloqueado', capa.ahora());
    v_min := ceil(extract(epoch from (v_bloq - capa.ahora())) / 60);
    return jsonb_build_object('estado', 'bloqueado', 'bloqueado_hasta', v_bloq,
      'mensaje', format('Detectamos demasiadas consultas con códigos inexistentes. Por seguridad, espera %s %s antes de volver a consultar.',
                        v_min, case when v_min = 1 then 'minuto' else 'minutos' end));
  end if;

  if v_codigo = '' then
    return jsonb_build_object('estado', 'vacio', 'mensaje', 'Ingresa el código del certificado.');
  end if;

  select * into c from capa.certificados where codigo = v_codigo;
  if not found then
    insert into capa.verificaciones (codigo_consultado, solicitante, resultado, creado_en)
    values (left(v_codigo, 64), v_sol, 'no_encontrado', capa.ahora());
    select count(*) into v_fallos from capa.verificaciones
    where solicitante = v_sol and resultado = 'no_encontrado' and creado_en > capa.ahora() - interval '10 minutes';
    if v_fallos >= 5 then
      insert into capa.bloqueos_verificacion (solicitante, bloqueado_hasta)
      values (v_sol, capa.ahora() + interval '15 minutes')
      on conflict (solicitante) do update set bloqueado_hasta = excluded.bloqueado_hasta;
    end if;
    return jsonb_build_object('estado', 'no_encontrado',
      'mensaje', 'Certificado no encontrado. Revisa que el código esté completo, por ejemplo CAP-ABCD-EFGH-JKLM.');
  end if;

  insert into capa.verificaciones (codigo_consultado, solicitante, resultado, creado_en)
  values (v_codigo, v_sol, c.estado, capa.ahora());
  select * into e from capa.eventos where id = c.evento_id;
  -- Solo datos mínimos: titular y evento (más fechas para contrastar el documento).
  return jsonb_build_object(
    'estado', case when c.estado = 'valido' then 'valido' else 'invalido' end,
    'codigo', c.codigo,
    'titular', c.titular_nombre,
    'evento', e.nombre,
    'fecha_inicio', e.fecha_inicio,
    'fecha_fin', e.fecha_fin,
    'horas_academicas', e.horas_academicas,
    'institucion', (select nombre from capa.instituciones where id = e.institucion_id),
    'emitido_en', c.emitido_en,
    'revocado_en', c.revocado_en);
end $$;

-- ---------------------------------------------------------------------------
-- HU-10 · Reportes de participación
-- ---------------------------------------------------------------------------

create function public.reporte_participacion(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  pl capa.planes;
  v_desde date := capa.txt(p, 'desde')::date;
  v_hasta date := capa.txt(p, 'hasta')::date;
  v_mod text := capa.txt(p, 'modalidad');
  v_ev uuid := capa.txt(p, 'evento_id')::uuid;
  v_filas jsonb;
begin
  -- Solo organizadores; cada uno ve únicamente sus eventos (HU-10 CA-05).
  perform capa.exigir_rol(u, 'organizador');
  pl := capa.plan_institucion(u.institucion_id);

  with ev as (
    select e.* from capa.eventos e
    where e.organizador_id = u.id and e.estado = 'publicado'
      and (v_desde is null or (e.fecha_inicio at time zone 'America/Lima')::date >= v_desde)
      and (v_hasta is null or (e.fecha_inicio at time zone 'America/Lima')::date <= v_hasta)
      and (v_mod is null or e.modalidad = v_mod)
      and (v_ev is null or e.id = v_ev)
  ), filas as (
    select ev.id, ev.nombre, ev.fecha_inicio, ev.fecha_fin, ev.modalidad, ev.cupo_maximo, ev.costo,
      capa.fase_evento(ev::capa.eventos) as fase,
      (select count(*) from capa.inscripciones i where i.evento_id = ev.id and i.estado = 'confirmada') as inscritos,
      (select count(*) from capa.inscripciones i where i.evento_id = ev.id and i.estado = 'pendiente_pago') as pendientes_pago,
      (select count(distinct a.inscripcion_id) from capa.asistencias a
         join capa.inscripciones i on i.id = a.inscripcion_id
         where a.evento_id = ev.id and i.estado = 'confirmada') as asistentes,
      (select coalesce(sum(pg.monto), 0) from capa.pagos pg where pg.evento_id = ev.id and pg.estado = 'confirmado') as ingresos,
      (select count(*) from capa.lista_espera l where l.evento_id = ev.id and l.estado = 'esperando') as en_espera,
      (select count(*) from capa.certificados c where c.evento_id = ev.id and c.estado = 'valido') as certificados,
      (select round(avg(x::numeric), 2) from capa.encuesta_respuestas r, jsonb_array_elements_text(r.puntajes) x
         where r.evento_id = ev.id) as satisfaccion,
      (select count(*) from capa.encuesta_respuestas r where r.evento_id = ev.id) as respuestas_encuesta
    from ev
  )
  select coalesce(jsonb_agg(to_jsonb(f) || jsonb_build_object(
           'porcentaje_asistencia', case when f.inscritos > 0 then round(100.0 * f.asistentes / f.inscritos, 1) else 0 end)
         order by f.fecha_inicio desc), '[]'::jsonb)
  into v_filas from filas f;

  return jsonb_build_object(
    'generado_en', capa.ahora(),
    'plan', pl.nombre,
    'puede_exportar', pl.permite_exportar,
    'eventos', v_filas,
    'totales', (
      select jsonb_build_object(
        'eventos', count(*),
        'inscritos', coalesce(sum((x ->> 'inscritos')::int), 0),
        'asistentes', coalesce(sum((x ->> 'asistentes')::int), 0),
        'pendientes_pago', coalesce(sum((x ->> 'pendientes_pago')::int), 0),
        'en_espera', coalesce(sum((x ->> 'en_espera')::int), 0),
        'certificados', coalesce(sum((x ->> 'certificados')::int), 0),
        'ingresos', coalesce(sum((x ->> 'ingresos')::numeric), 0),
        'porcentaje_asistencia', case when coalesce(sum((x ->> 'inscritos')::int), 0) > 0
          then round(100.0 * sum((x ->> 'asistentes')::int) / sum((x ->> 'inscritos')::int), 1) else 0 end)
      from jsonb_array_elements(v_filas) x),
    'por_metodo', (
      select coalesce(jsonb_agg(jsonb_build_object('metodo', metodo, 'monto', monto, 'operaciones', ops) order by monto desc), '[]'::jsonb)
      from (select pg.metodo, sum(pg.monto) as monto, count(*) as ops
            from capa.pagos pg
            where pg.estado = 'confirmado'
              and pg.evento_id in (select (x ->> 'id')::uuid from jsonb_array_elements(v_filas) x)
            group by pg.metodo) m)
  );
end $$;

create function public.registrar_exportacion(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
begin
  perform capa.exigir_rol(u, 'organizador');
  perform capa.exigir_plan(u.institucion_id, 'exportar');
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- HU-11 · Ponentes y programa
-- ---------------------------------------------------------------------------

create function capa.notificar_cambio_programa(e capa.eventos, detalle text) returns void
language plpgsql as $$
declare
  r record;
begin
  if e.estado <> 'publicado' or e.fecha_fin <= capa.ahora() then return; end if;
  for r in
    select us.* from capa.inscripciones i join capa.usuarios us on us.id = i.usuario_id
    where i.evento_id = e.id and i.estado in ('confirmada', 'pendiente_pago')
  loop
    perform capa.enviar_correo(r.id, r.correo, 'Se actualizó el programa de ' || e.nombre,
      'Hola ' || r.nombres || E',\n\nEl organizador actualizó el programa del evento: ' || detalle
        || E'.\n\nRevisa el cronograma vigente en la página del evento.',
      'programa', e.id, 'Ver el programa', '/eventos/' || e.id);
  end loop;
end $$;

create function public.guardar_ponente(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  pn capa.ponentes;
  v_id uuid := capa.txt(p, 'id')::uuid;
  v_nombre text := capa.txt(p, 'nombre');
  v_correo text := lower(capa.txt(p, 'correo'));
  v_foto text := capa.txt(p, 'foto');
  v_bio text := coalesce(capa.txt(p, 'biografia'), '');
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'evento_id')::uuid, true);
  if e.estado = 'cancelado' then
    perform capa.err('El evento está cancelado.');
  end if;
  if v_nombre is null then
    perform capa.err('El nombre del ponente es obligatorio.', 'CAMPOS', '{"campos":["nombre"]}');
  end if;
  if not coalesce((p ->> 'consentimiento')::boolean, false) then
    perform capa.err('Confirma que el ponente autorizó publicar su nombre, foto y biografía.', 'CAMPOS', '{"campos":["consentimiento"]}');
  end if;
  if v_correo is not null and v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform capa.err('El correo del ponente no es válido.', 'CAMPOS', '{"campos":["correo"]}');
  end if;
  if v_foto is not null then
    if v_foto !~ '^data:image/(png|jpeg|webp);base64,' then
      perform capa.err('La foto debe ser una imagen JPG, PNG o WebP.', 'CAMPOS', '{"campos":["foto"]}');
    end if;
    -- 1 MB de imagen equivale a unos 1 398 102 caracteres en base64 (+ cabecera).
    if length(v_foto) > 1398200 then
      perform capa.err('La foto supera el límite de 1 MB. Usa una imagen más liviana.', 'CAMPOS', '{"campos":["foto"]}');
    end if;
  end if;

  if v_id is null then
    insert into capa.ponentes (evento_id, nombre, correo, foto, biografia, consentimiento, usuario_id, orden)
    values (e.id, v_nombre, v_correo, v_foto, v_bio, true,
            (select id from capa.usuarios where lower(correo) = v_correo),
            (select coalesce(max(orden), 0) + 1 from capa.ponentes where evento_id = e.id))
    returning * into pn;
    perform capa.notificar_cambio_programa(e, 'se agregó a ' || v_nombre || ' como ponente');
  else
    update capa.ponentes set nombre = v_nombre, correo = v_correo,
      foto = case when coalesce((p ->> 'quitar_foto')::boolean, false) then null else coalesce(v_foto, foto) end,
      biografia = v_bio, consentimiento = true,
      usuario_id = coalesce((select id from capa.usuarios where lower(correo) = v_correo), usuario_id)
    where id = v_id and evento_id = e.id returning * into pn;
    if not found then
      perform capa.err('No encontramos este ponente.', 'NO_ENCONTRADO');
    end if;
    perform capa.notificar_cambio_programa(e, 'se actualizaron los datos de ' || v_nombre);
  end if;
  return jsonb_build_object('ok', true, 'ponente', jsonb_build_object('id', pn.id, 'nombre', pn.nombre));
end $$;

create function public.eliminar_ponente(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  pn capa.ponentes;
begin
  perform capa.exigir_rol(u, 'organizador');
  select * into pn from capa.ponentes where id = capa.txt(p, 'id')::uuid;
  if not found then
    perform capa.err('No encontramos este ponente.', 'NO_ENCONTRADO');
  end if;
  e := capa.evento_del_organizador(u, pn.evento_id, true);
  delete from capa.ponentes where id = pn.id;
  perform capa.notificar_cambio_programa(e, pn.nombre || ' ya no participa como ponente');
  return jsonb_build_object('ok', true);
end $$;

create function public.guardar_sesion_programa(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  s capa.sesiones_programa;
  v_id uuid := capa.txt(p, 'id')::uuid;
  v_titulo text := capa.txt(p, 'titulo');
  v_inicio timestamptz := capa.txt(p, 'inicio')::timestamptz;
  v_fin timestamptz := capa.txt(p, 'fin')::timestamptz;
  v_ponentes uuid[] := coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'ponente_ids', '[]'::jsonb))::uuid), '{}');
  v_faltan text[] := '{}';
  v_cruces jsonb;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'evento_id')::uuid, true);
  if e.estado = 'cancelado' then
    perform capa.err('El evento está cancelado.');
  end if;
  if v_titulo is null then v_faltan := array_append(v_faltan, 'titulo'); end if;
  if v_inicio is null then v_faltan := array_append(v_faltan, 'inicio'); end if;
  if v_fin is null then v_faltan := array_append(v_faltan, 'fin'); end if;
  if cardinality(v_faltan) > 0 then
    perform capa.err('Completa el título y el horario de la sesión.', 'CAMPOS', jsonb_build_object('campos', v_faltan));
  end if;
  if v_fin <= v_inicio then
    perform capa.err('La hora de fin debe ser posterior a la de inicio.', 'CAMPOS', '{"campos":["fin"]}');
  end if;
  if v_inicio < e.fecha_inicio or v_fin > e.fecha_fin then
    perform capa.err('La sesión debe quedar dentro del horario del evento (' || capa.fmt_fecha(e.fecha_inicio)
                     || ' a ' || capa.fmt_fecha(e.fecha_fin) || ').', 'CAMPOS', '{"campos":["inicio","fin"]}');
  end if;
  if exists (select 1 from unnest(v_ponentes) x where not exists
             (select 1 from capa.ponentes pn where pn.id = x and pn.evento_id = e.id)) then
    perform capa.err('Uno de los ponentes elegidos no pertenece a este evento.');
  end if;

  -- Cruce de horarios del mismo ponente (HU-11 CA-03).
  select jsonb_agg(jsonb_build_object('ponente', pn.nombre, 'sesion', o.titulo, 'inicio', o.inicio, 'fin', o.fin))
  into v_cruces
  from capa.sesiones_programa o
  join capa.sesion_ponentes sp on sp.sesion_id = o.id
  join capa.ponentes pn on pn.id = sp.ponente_id
  where o.evento_id = e.id and o.id is distinct from v_id and sp.ponente_id = any (v_ponentes)
    and o.inicio < v_fin and v_inicio < o.fin;
  if v_cruces is not null and not coalesce((p ->> 'forzar')::boolean, false) then
    return jsonb_build_object('ok', false, 'motivo', 'cruce', 'cruces', v_cruces,
      'mensaje', (v_cruces -> 0 ->> 'ponente') || ' ya tiene la sesión «' || (v_cruces -> 0 ->> 'sesion')
                 || '» en un horario que se superpone con este.');
  end if;

  if v_id is null then
    insert into capa.sesiones_programa (evento_id, titulo, descripcion, inicio, fin)
    values (e.id, v_titulo, coalesce(capa.txt(p, 'descripcion'), ''), v_inicio, v_fin) returning * into s;
  else
    update capa.sesiones_programa set titulo = v_titulo, descripcion = coalesce(capa.txt(p, 'descripcion'), ''),
                                      inicio = v_inicio, fin = v_fin
      where id = v_id and evento_id = e.id returning * into s;
    if not found then
      perform capa.err('No encontramos esta sesión.', 'NO_ENCONTRADO');
    end if;
    delete from capa.sesion_ponentes where sesion_id = s.id;
  end if;
  insert into capa.sesion_ponentes (sesion_id, ponente_id) select s.id, x from unnest(v_ponentes) x;
  perform capa.notificar_cambio_programa(e, 'sesión «' || v_titulo || '», ' || capa.fmt_fecha(v_inicio));
  return jsonb_build_object('ok', true, 'sesion_id', s.id, 'con_cruce', v_cruces is not null);
end $$;

create function public.eliminar_sesion_programa(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  s capa.sesiones_programa;
begin
  perform capa.exigir_rol(u, 'organizador');
  select * into s from capa.sesiones_programa where id = capa.txt(p, 'id')::uuid;
  if not found then
    perform capa.err('No encontramos esta sesión.', 'NO_ENCONTRADO');
  end if;
  e := capa.evento_del_organizador(u, s.evento_id, true);
  delete from capa.sesiones_programa where id = s.id;
  perform capa.notificar_cambio_programa(e, 'se retiró la sesión «' || s.titulo || '»');
  return jsonb_build_object('ok', true);
end $$;

-- ---------------------------------------------------------------------------
-- HU-12 · Eventos virtuales
-- ---------------------------------------------------------------------------

create function public.guardar_enlace_virtual(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  v_enlace text := capa.txt(p, 'enlace');
  v_plat text;
  v_anterior text;
  r record;
begin
  select * into e from capa.eventos where id = capa.txt(p, 'evento_id')::uuid for update;
  if not found then
    perform capa.err('No encontramos el evento.', 'NO_ENCONTRADO');
  end if;
  if not (e.organizador_id = u.id
          or exists (select 1 from capa.ponentes where evento_id = e.id and usuario_id = u.id)) then
    perform capa.err('Solo el organizador o un ponente del evento puede gestionar el enlace.', 'PROHIBIDO');
  end if;
  if e.modalidad = 'presencial' then
    perform capa.err('Este evento es presencial: solo los eventos virtuales o mixtos llevan enlace.');
  end if;
  if e.estado = 'cancelado' or capa.fase_evento(e) = 'finalizado' then
    perform capa.err('El evento ya no admite cambios de enlace.');
  end if;
  perform capa.exigir_plan(e.institucion_id, 'virtual');
  v_plat := capa.plataforma_enlace(v_enlace);
  if v_plat is null then
    perform capa.err('Pega un enlace de sala válido de Zoom, Google Meet o Microsoft Teams que empiece con https://.',
                     'CAMPOS', '{"campos":["enlace"]}');
  end if;
  v_anterior := e.enlace_virtual;
  update capa.eventos set enlace_virtual = v_enlace, enlace_plataforma = v_plat, actualizado_en = capa.ahora()
    where id = e.id returning * into e;

  -- Si se reemplaza un enlace (por ejemplo, porque la plataforma falló), los
  -- inscritos confirmados reciben el nuevo por correo.
  if v_anterior is not null and v_anterior <> v_enlace and e.estado = 'publicado' then
    for r in
      select us.* from capa.inscripciones i join capa.usuarios us on us.id = i.usuario_id
      where i.evento_id = e.id and i.estado = 'confirmada'
    loop
      perform capa.enviar_correo(r.id, r.correo, 'Nuevo enlace para ' || e.nombre,
        'Hola ' || r.nombres || E',\n\nLa sala virtual del evento cambió. Usa este nuevo enlace para ingresar:\n'
          || v_enlace || E'\n\n' || capa.datos_evento_texto(e),
        'enlace', e.id, 'Abrir la sala', v_enlace);
    end loop;
  end if;
  return jsonb_build_object('ok', true, 'plataforma', v_plat, 'reemplazado', v_anterior is not null and v_anterior <> v_enlace);
end $$;

create function public.eventos_ponente(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
begin
  return (
    select coalesce(jsonb_agg(capa.evento_json(e) || jsonb_build_object('enlace_virtual', e.enlace_virtual)
                              order by e.fecha_inicio desc), '[]'::jsonb)
    from capa.eventos e
    where e.estado <> 'borrador' and exists (select 1 from capa.ponentes pn where pn.evento_id = e.id and pn.usuario_id = u.id)
  );
end $$;

-- ---------------------------------------------------------------------------
-- HU-06 · Recordatorios y bandeja de correos simulados
-- ---------------------------------------------------------------------------

create function public.mis_correos(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
begin
  return jsonb_build_object(
    'no_leidos', (select count(*) from capa.correos where (usuario_id = u.id or lower(para) = lower(u.correo)) and not leido),
    'correos', (select coalesce(jsonb_agg(to_jsonb(c) - 'orden' order by c.enviado_en desc, c.orden desc), '[]'::jsonb)
                from (select * from capa.correos where usuario_id = u.id or lower(para) = lower(u.correo)
                      order by enviado_en desc, orden desc limit 100) c));
end $$;

create function public.marcar_correo_leido(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
begin
  update capa.correos set leido = true
  where (usuario_id = u.id or lower(para) = lower(u.correo))
    and (coalesce((p ->> 'todos')::boolean, false) or id = capa.txt(p, 'id')::uuid);
  return jsonb_build_object('ok', true);
end $$;

-- Buzón de demostración: permite abrir el correo de confirmación sin un
-- servidor de correo real. Solo responde con el modo demostración activo.
create function public.correo_demo(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
begin
  if not (select modo_demo from capa.config where id = 1) then
    perform capa.err('El buzón de demostración está desactivado.', 'PROHIBIDO');
  end if;
  return (select coalesce(jsonb_agg(to_jsonb(c) - 'orden' order by c.enviado_en desc, c.orden desc), '[]'::jsonb)
          from (select * from capa.correos where lower(para) = lower(capa.txt(p, 'para'))
                order by enviado_en desc, orden desc limit 50) c);
end $$;

-- Inscripciones del usuario con todo lo necesario para su panel: QR, pagos,
-- asistencia, certificado, encuesta y próximos recordatorios.
create function public.mis_inscripciones(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
begin
  return jsonb_build_object(
    'inscripciones', (
      select coalesce(jsonb_agg(capa.inscripcion_json(i) || jsonb_build_object(
        'evento', capa.evento_json(e) || jsonb_build_object(
           'enlace_virtual', case when i.estado = 'confirmada' then e.enlace_virtual end),
        'pagos', (select coalesce(jsonb_agg(capa.pago_json(pg) order by pg.creado_en desc), '[]'::jsonb)
                  from capa.pagos pg where pg.inscripcion_id = i.id),
        'jornadas_asistidas', (select count(distinct jornada) from capa.asistencias a where a.inscripcion_id = i.id),
        'porcentaje_asistencia', capa.porcentaje_asistencia(i, e),
        'certificado', (select jsonb_build_object('id', c.id, 'codigo', c.codigo, 'estado', c.estado,
                                                  'emitido_en', c.emitido_en, 'revocado_en', c.revocado_en)
                        from capa.certificados c where c.inscripcion_id = i.id),
        'encuesta', (select jsonb_build_object(
                        'enviada', en.enviada_en is not null,
                        'cierra_en', en.cierra_en,
                        'cerrada', en.cierra_en is not null and en.cierra_en <= capa.ahora(),
                        'respondida', exists (select 1 from capa.encuesta_respuestas r where r.evento_id = e.id and r.usuario_id = u.id),
                        'invitado', exists (select 1 from capa.asistencias a where a.inscripcion_id = i.id))
                     from capa.encuestas en where en.evento_id = e.id),
        'puede_cancelar', i.estado in ('confirmada', 'pendiente_pago') and e.fecha_inicio - interval '24 hours' > capa.ahora(),
        'recordatorios', case when i.estado = 'confirmada' and u.recordatorios_activos and e.fecha_inicio > capa.ahora() then (
            select coalesce(jsonb_agg(jsonb_build_object('tipo', t.tipo, 'programado_para', t.cuando,
                                                         'enviado', exists (select 1 from capa.recordatorios_enviados re
                                                                            where re.inscripcion_id = i.id and re.tipo = t.tipo
                                                                              and re.fecha_evento_ref = e.fecha_inicio))
                                      order by t.cuando), '[]'::jsonb)
            from (values ('24h', e.fecha_inicio - interval '24 hours'), ('1h', e.fecha_inicio - interval '1 hour')) t(tipo, cuando))
          else '[]'::jsonb end
      ) order by (i.estado in ('confirmada', 'pendiente_pago')) desc, e.fecha_inicio desc), '[]'::jsonb)
      from capa.inscripciones i join capa.eventos e on e.id = i.evento_id
      where i.usuario_id = u.id),
    'lista_espera', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', l.id, 'estado', l.estado, 'solicitado_en', l.solicitado_en, 'oferta_expira_en', l.oferta_expira_en,
        'posicion', (select count(*) from capa.lista_espera x where x.evento_id = l.evento_id and x.estado = 'esperando'
                     and (x.solicitado_en, x.id) <= (l.solicitado_en, l.id)),
        'evento', capa.evento_json(e)) order by l.solicitado_en), '[]'::jsonb)
      from capa.lista_espera l join capa.eventos e on e.id = l.evento_id
      where l.usuario_id = u.id and l.estado in ('esperando', 'ofrecido'))
  );
end $$;

-- ---------------------------------------------------------------------------
-- HU-14 · Encuesta de satisfacción
-- ---------------------------------------------------------------------------

create function capa.preguntas_predeterminadas() returns jsonb
language sql immutable as $$
  select '["¿Qué tan satisfecho quedaste con el evento en general?",
           "¿El contenido fue útil para tu formación o trabajo?",
           "¿Cómo calificas el dominio del tema de los ponentes?",
           "¿La organización y la puntualidad fueron adecuadas?",
           "¿Recomendarías este evento a otras personas?"]'::jsonb
$$;

create function public.guardar_encuesta(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  en capa.encuestas;
  v_preg jsonb;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'evento_id')::uuid, true);
  perform capa.exigir_plan(e.institucion_id, 'encuestas');
  select * into en from capa.encuestas where evento_id = e.id;
  if found and en.enviada_en is not null then
    perform capa.err('La encuesta ya se envió a los asistentes y no se puede modificar.');
  end if;
  select coalesce(jsonb_agg(to_jsonb(trim(x))), '[]'::jsonb) into v_preg
  from jsonb_array_elements_text(coalesce(p -> 'preguntas', '[]'::jsonb)) x where trim(x) <> '';
  if jsonb_array_length(v_preg) = 0 then
    perform capa.err('Agrega al menos una pregunta.', 'CAMPOS', '{"campos":["preguntas"]}');
  end if;
  if jsonb_array_length(v_preg) > 10 then
    perform capa.err('La encuesta admite como máximo 10 preguntas.', 'CAMPOS', '{"campos":["preguntas"]}');
  end if;
  if exists (select 1 from jsonb_array_elements_text(v_preg) x where length(x) > 200) then
    perform capa.err('Cada pregunta debe tener como máximo 200 caracteres.', 'CAMPOS', '{"campos":["preguntas"]}');
  end if;
  insert into capa.encuestas (evento_id, anonima, preguntas)
  values (e.id, coalesce((p ->> 'anonima')::boolean, true), v_preg)
  on conflict (evento_id) do update set anonima = excluded.anonima, preguntas = excluded.preguntas;
  return jsonb_build_object('ok', true);
end $$;

create function public.obtener_encuesta(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  en capa.encuestas;
  es_org boolean;
begin
  select * into e from capa.eventos where id = capa.txt(p, 'evento_id')::uuid;
  if not found then
    perform capa.err('No encontramos el evento.', 'NO_ENCONTRADO');
  end if;
  es_org := e.organizador_id = u.id;
  select * into en from capa.encuestas where evento_id = e.id;
  if es_org then
    return jsonb_build_object('es_organizador', true, 'evento', capa.evento_json(e),
      'plan_permite', (capa.plan_institucion(e.institucion_id)).permite_encuestas,
      'configurada', en.evento_id is not null,
      'anonima', coalesce(en.anonima, true),
      'preguntas', coalesce(en.preguntas, capa.preguntas_predeterminadas()),
      'enviada_en', en.enviada_en, 'cierra_en', en.cierra_en);
  end if;
  if not exists (select 1 from capa.asistencias a join capa.inscripciones i on i.id = a.inscripcion_id
                 where a.evento_id = e.id and i.usuario_id = u.id) then
    perform capa.err('La encuesta es solo para quienes asistieron al evento.', 'PROHIBIDO');
  end if;
  if en.evento_id is null or en.enviada_en is null then
    return jsonb_build_object('disponible', false, 'evento', capa.evento_json(e),
      'mensaje', 'La encuesta se habilita cuando termina el evento.');
  end if;
  return jsonb_build_object('disponible', true, 'evento', capa.evento_json(e),
    'anonima', en.anonima, 'preguntas', en.preguntas, 'cierra_en', en.cierra_en,
    'cerrada', en.cierra_en <= capa.ahora(),
    'ya_respondio', exists (select 1 from capa.encuesta_respuestas r where r.evento_id = e.id and r.usuario_id = u.id));
end $$;

create function public.responder_encuesta(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  en capa.encuestas;
  v_punt jsonb := coalesce(p -> 'puntajes', '[]'::jsonb);
  v_com text := capa.txt(p, 'comentario');
begin
  select * into en from capa.encuestas where evento_id = capa.txt(p, 'evento_id')::uuid;
  if not found or en.enviada_en is null then
    perform capa.err('Esta encuesta todavía no está disponible.', 'NO_DISPONIBLE');
  end if;
  if en.cierra_en <= capa.ahora() then
    perform capa.err('La encuesta cerró el ' || capa.fmt_fecha(en.cierra_en) || '.', 'CERRADA');
  end if;
  if not exists (select 1 from capa.asistencias a join capa.inscripciones i on i.id = a.inscripcion_id
                 where a.evento_id = en.evento_id and i.usuario_id = u.id) then
    perform capa.err('La encuesta es solo para quienes asistieron al evento.', 'PROHIBIDO');
  end if;
  if exists (select 1 from capa.encuesta_respuestas where evento_id = en.evento_id and usuario_id = u.id) then
    perform capa.err('Ya respondiste esta encuesta. ¡Gracias!', 'YA_RESPONDIO');
  end if;
  if jsonb_typeof(v_punt) <> 'array' or jsonb_array_length(v_punt) <> jsonb_array_length(en.preguntas)
     or exists (select 1 from jsonb_array_elements(v_punt) x
                where jsonb_typeof(x) <> 'number' or (x #>> '{}')::numeric not in (1, 2, 3, 4, 5)) then
    perform capa.err('Califica todas las preguntas con un valor del 1 al 5.', 'CAMPOS', '{"campos":["puntajes"]}');
  end if;
  if v_com is not null and length(v_com) > 1000 then
    perform capa.err('El comentario admite como máximo 1000 caracteres.', 'CAMPOS', '{"campos":["comentario"]}');
  end if;
  insert into capa.encuesta_respuestas (evento_id, usuario_id, puntajes, comentario, creado_en)
  values (en.evento_id, u.id, v_punt, v_com, capa.ahora());
  return jsonb_build_object('ok', true);
exception
  when unique_violation then
    perform capa.err('Ya respondiste esta encuesta. ¡Gracias!', 'YA_RESPONDIO');
    return null;
end $$;

create function public.resultados_encuesta(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  en capa.encuestas;
begin
  perform capa.exigir_rol(u, 'organizador');
  e := capa.evento_del_organizador(u, capa.txt(p, 'evento_id')::uuid);
  select * into en from capa.encuestas where evento_id = e.id;
  if not found or en.enviada_en is null then
    return jsonb_build_object('enviada', false);
  end if;
  return jsonb_build_object(
    'enviada', true,
    'anonima', en.anonima,
    'enviada_en', en.enviada_en,
    'cierra_en', en.cierra_en,
    'cerrada', en.cierra_en <= capa.ahora(),
    'invitados', (select count(distinct a.inscripcion_id) from capa.asistencias a where a.evento_id = e.id),
    'total_respuestas', (select count(*) from capa.encuesta_respuestas where evento_id = e.id),
    'preguntas', (
      select jsonb_agg(jsonb_build_object(
        'texto', q.texto,
        'promedio', (select round(avg((r.puntajes ->> (q.n - 1)::int)::numeric), 2)
                     from capa.encuesta_respuestas r where r.evento_id = e.id),
        'distribucion', (select jsonb_agg((select count(*) from capa.encuesta_respuestas r
                                           where r.evento_id = e.id and (r.puntajes ->> (q.n - 1)::int)::int = v) order by v)
                         from generate_series(1, 5) v))
        order by q.n)
      from jsonb_array_elements_text(en.preguntas) with ordinality q(texto, n)),
    -- Con modo anónimo nunca se devuelve quién respondió (HU-14 CA-03).
    'comentarios', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'texto', r.comentario, 'creado_en', r.creado_en,
        'autor', case when en.anonima then null else us.nombres || ' ' || us.apellidos end)
        order by r.creado_en desc), '[]'::jsonb)
      from capa.encuesta_respuestas r join capa.usuarios us on us.id = r.usuario_id
      where r.evento_id = e.id and r.comentario is not null)
  );
end $$;

-- ---------------------------------------------------------------------------
-- HU-13 · Administración de la plataforma
-- ---------------------------------------------------------------------------

create function capa.exigir_admin(p jsonb) returns capa.usuarios
language plpgsql as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
begin
  perform capa.exigir_rol(u, 'admin');
  return u;
end $$;

create function public.admin_resumen(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
begin
  return jsonb_build_object(
    'usuarios', (select count(*) from capa.usuarios),
    'usuarios_suspendidos', (select count(*) from capa.usuarios where estado = 'suspendida'),
    'usuarios_por_rol', (select jsonb_object_agg(rol, n) from (select rol, count(*) n from capa.usuarios group by rol) x),
    'instituciones', (select count(*) from capa.instituciones),
    'instituciones_por_plan', (select jsonb_object_agg(plan_codigo, n) from (select plan_codigo, count(*) n from capa.instituciones group by plan_codigo) x),
    'eventos_publicados', (select count(*) from capa.eventos where estado = 'publicado' and fecha_fin > capa.ahora()),
    'ingresos_confirmados', (select coalesce(sum(monto), 0) from capa.pagos where estado = 'confirmado'),
    'facturacion_mensual', (select coalesce(sum(pl.precio_mensual), 0) from capa.instituciones i
                            join capa.planes pl on pl.codigo = i.plan_codigo where i.estado = 'activa'));
end $$;

create function public.admin_instituciones(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', i.id, 'nombre', i.nombre, 'siglas', i.siglas, 'plan_codigo', i.plan_codigo, 'plan', pl.nombre,
      'estado', i.estado, 'motivo_suspension', i.motivo_suspension, 'creado_en', i.creado_en,
      'organizadores', (select count(*) from capa.usuarios x where x.institucion_id = i.id and x.rol = 'organizador'),
      'eventos_activos', (select count(*) from capa.eventos e where e.institucion_id = i.id and e.estado = 'publicado' and e.fecha_fin > capa.ahora()),
      'eventos_total', (select count(*) from capa.eventos e where e.institucion_id = i.id))
    order by i.nombre), '[]'::jsonb)
    from capa.instituciones i join capa.planes pl on pl.codigo = i.plan_codigo);
end $$;

create function public.admin_guardar_institucion(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  i capa.instituciones;
  ant capa.instituciones;
  v_id uuid := capa.txt(p, 'id')::uuid;
  v_nombre text := capa.txt(p, 'nombre');
  v_plan text := coalesce(capa.txt(p, 'plan_codigo'), 'basico');
begin
  if v_nombre is null then
    perform capa.err('El nombre de la institución es obligatorio.', 'CAMPOS', '{"campos":["nombre"]}');
  end if;
  if not exists (select 1 from capa.planes where codigo = v_plan) then
    perform capa.err('Elige un plan válido.', 'CAMPOS', '{"campos":["plan_codigo"]}');
  end if;
  if v_id is null then
    insert into capa.instituciones (nombre, siglas, plan_codigo) values (v_nombre, capa.txt(p, 'siglas'), v_plan)
    returning * into i;
    perform capa.auditar(u, 'Creó institución', 'institucion', i.id::text,
                         format('%s · plan %s', i.nombre, v_plan));
  else
    select * into ant from capa.instituciones where id = v_id for update;
    if not found then
      perform capa.err('No encontramos la institución.', 'NO_ENCONTRADO');
    end if;
    update capa.instituciones set nombre = v_nombre, siglas = capa.txt(p, 'siglas'), plan_codigo = v_plan
      where id = v_id returning * into i;
    perform capa.auditar(u, 'Editó institución', 'institucion', i.id::text,
      concat_ws(' · ', i.nombre,
        case when ant.nombre <> i.nombre then 'nombre: ' || ant.nombre || ' → ' || i.nombre end,
        case when ant.plan_codigo <> i.plan_codigo then 'plan: ' || ant.plan_codigo || ' → ' || i.plan_codigo end,
        case when ant.siglas is distinct from i.siglas then 'siglas: ' || coalesce(ant.siglas, '—') || ' → ' || coalesce(i.siglas, '—') end));
  end if;
  return jsonb_build_object('ok', true, 'id', i.id);
exception
  when unique_violation then
    perform capa.err('Ya existe una institución con ese nombre.', 'CAMPOS', '{"campos":["nombre"]}');
    return null;
end $$;

create function public.admin_estado_institucion(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  i capa.instituciones;
  v_estado text := capa.txt(p, 'estado');
  v_motivo text := capa.txt(p, 'motivo');
begin
  if v_estado not in ('activa', 'suspendida') then
    perform capa.err('Estado no válido.');
  end if;
  if v_estado = 'suspendida' and v_motivo is null then
    perform capa.err('Indica el motivo de la suspensión; se mostrará al intentar ingresar.', 'CAMPOS', '{"campos":["motivo"]}');
  end if;
  update capa.instituciones set estado = v_estado,
    motivo_suspension = case when v_estado = 'suspendida' then v_motivo end
  where id = capa.txt(p, 'id')::uuid returning * into i;
  if not found then
    perform capa.err('No encontramos la institución.', 'NO_ENCONTRADO');
  end if;
  if v_estado = 'suspendida' then
    update capa.sesiones set revocada = true
    where usuario_id in (select id from capa.usuarios where institucion_id = i.id and rol = 'organizador');
  end if;
  perform capa.auditar(u, case when v_estado = 'suspendida' then 'Suspendió institución' else 'Activó institución' end,
                       'institucion', i.id::text, i.nombre || coalesce(' · motivo: ' || v_motivo, ''));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_usuarios(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
begin
  return (select coalesce(jsonb_agg(jsonb_build_object(
      'id', x.id, 'nombres', x.nombres, 'apellidos', x.apellidos, 'correo', x.correo, 'rol', x.rol, 'estado', x.estado,
      'motivo_suspension', x.motivo_suspension, 'creado_en', x.creado_en, 'institucion_id', x.institucion_id,
      'institucion', (select nombre from capa.instituciones where id = x.institucion_id),
      'bloqueado_hasta', case when x.bloqueado_hasta > capa.ahora() then x.bloqueado_hasta end)
    order by x.creado_en desc), '[]'::jsonb)
    from capa.usuarios x
    where (capa.txt(p, 'q') is null or (x.nombres || ' ' || x.apellidos || ' ' || x.correo) ilike '%' || capa.txt(p, 'q') || '%')
      and (capa.txt(p, 'rol') is null or x.rol = capa.txt(p, 'rol'))
      and (capa.txt(p, 'estado') is null or x.estado = capa.txt(p, 'estado')));
end $$;

create function public.admin_editar_usuario(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  ant capa.usuarios;
  x capa.usuarios;
  v_rol text := capa.txt(p, 'rol');
  v_inst uuid := capa.txt(p, 'institucion_id')::uuid;
begin
  select * into ant from capa.usuarios where id = capa.txt(p, 'id')::uuid for update;
  if not found then
    perform capa.err('No encontramos el usuario.', 'NO_ENCONTRADO');
  end if;
  if capa.txt(p, 'nombres') is null or capa.txt(p, 'apellidos') is null then
    perform capa.err('Nombres y apellidos son obligatorios.', 'CAMPOS', '{"campos":["nombres","apellidos"]}');
  end if;
  if v_rol not in ('asistente', 'organizador', 'ponente', 'admin') then
    perform capa.err('Rol no válido.', 'CAMPOS', '{"campos":["rol"]}');
  end if;
  if ant.id = u.id and v_rol <> 'admin' then
    perform capa.err('No puedes quitarte a ti mismo el rol de administrador.');
  end if;
  if v_rol = 'organizador' and v_inst is null then
    perform capa.err('Un organizador debe pertenecer a una institución.', 'CAMPOS', '{"campos":["institucion_id"]}');
  end if;
  update capa.usuarios set nombres = capa.txt(p, 'nombres'), apellidos = capa.txt(p, 'apellidos'), rol = v_rol,
    institucion_id = case when v_rol in ('organizador') then v_inst else coalesce(v_inst, null) end
  where id = ant.id returning * into x;
  perform capa.auditar(u, 'Editó usuario', 'usuario', x.correo,
    concat_ws(' · ', capa.nombre_completo(x),
      case when ant.rol <> x.rol then 'rol: ' || ant.rol || ' → ' || x.rol end,
      case when ant.institucion_id is distinct from x.institucion_id then 'institución: '
        || coalesce((select nombre from capa.instituciones where id = ant.institucion_id), '—') || ' → '
        || coalesce((select nombre from capa.instituciones where id = x.institucion_id), '—') end,
      case when (ant.nombres, ant.apellidos) <> (x.nombres, x.apellidos) then 'nombre: ' || capa.nombre_completo(ant) end));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_estado_usuario(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  x capa.usuarios;
  v_estado text := capa.txt(p, 'estado');
  v_motivo text := capa.txt(p, 'motivo');
begin
  if v_estado not in ('activa', 'suspendida') then
    perform capa.err('Estado no válido.');
  end if;
  if v_estado = 'suspendida' and v_motivo is null then
    perform capa.err('Indica el motivo de la suspensión; se mostrará al usuario.', 'CAMPOS', '{"campos":["motivo"]}');
  end if;
  if capa.txt(p, 'id')::uuid = u.id then
    perform capa.err('No puedes suspender tu propia cuenta.');
  end if;
  update capa.usuarios set estado = v_estado,
    motivo_suspension = case when v_estado = 'suspendida' then v_motivo end,
    confirmado_en = coalesce(confirmado_en, case when v_estado = 'activa' then capa.ahora() end),
    intentos_fallidos = 0, bloqueado_hasta = null
  where id = capa.txt(p, 'id')::uuid returning * into x;
  if not found then
    perform capa.err('No encontramos el usuario.', 'NO_ENCONTRADO');
  end if;
  -- El cambio rige de inmediato: se cierran sus sesiones abiertas (HU-13 CA-01).
  if v_estado = 'suspendida' then
    update capa.sesiones set revocada = true where usuario_id = x.id;
  end if;
  perform capa.auditar(u, case when v_estado = 'suspendida' then 'Suspendió usuario' else 'Activó usuario' end,
                       'usuario', x.correo, capa.nombre_completo(x) || coalesce(' · motivo: ' || v_motivo, ''));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_planes(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
begin
  return (select coalesce(jsonb_agg(to_jsonb(pl) || jsonb_build_object(
            'instituciones', (select count(*) from capa.instituciones i where i.plan_codigo = pl.codigo))
          order by pl.orden), '[]'::jsonb) from capa.planes pl);
end $$;

create function public.admin_guardar_plan(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  ant capa.planes;
  pl capa.planes;
begin
  select * into ant from capa.planes where codigo = capa.txt(p, 'codigo') for update;
  if not found then
    perform capa.err('No encontramos el plan.', 'NO_ENCONTRADO');
  end if;
  if capa.txt(p, 'precio_mensual')::numeric < 0 then
    perform capa.err('El precio no puede ser negativo.', 'CAMPOS', '{"campos":["precio_mensual"]}');
  end if;
  if coalesce(capa.txt(p, 'max_eventos_activos')::int, 1) <= 0 or coalesce(capa.txt(p, 'max_cupo_evento')::int, 1) <= 0 then
    perform capa.err('Los límites deben ser mayores que cero, o quedar vacíos para «ilimitado».', 'CAMPOS',
                     '{"campos":["max_eventos_activos","max_cupo_evento"]}');
  end if;
  update capa.planes set
    precio_mensual = coalesce(capa.txt(p, 'precio_mensual')::numeric, precio_mensual),
    max_eventos_activos = capa.txt(p, 'max_eventos_activos')::int,
    max_cupo_evento = capa.txt(p, 'max_cupo_evento')::int,
    permite_pagos = coalesce((p ->> 'permite_pagos')::boolean, permite_pagos),
    permite_virtual = coalesce((p ->> 'permite_virtual')::boolean, permite_virtual),
    permite_exportar = coalesce((p ->> 'permite_exportar')::boolean, permite_exportar),
    permite_encuestas = coalesce((p ->> 'permite_encuestas')::boolean, permite_encuestas),
    actualizado_en = now()
  where codigo = ant.codigo returning * into pl;
  perform capa.auditar(u, 'Cambió plan', 'plan', pl.codigo,
    concat_ws(' · ', pl.nombre,
      case when ant.precio_mensual <> pl.precio_mensual then 'precio: ' || ant.precio_mensual || ' → ' || pl.precio_mensual end,
      case when ant.max_eventos_activos is distinct from pl.max_eventos_activos then 'eventos activos: '
        || coalesce(ant.max_eventos_activos::text, '∞') || ' → ' || coalesce(pl.max_eventos_activos::text, '∞') end,
      case when ant.max_cupo_evento is distinct from pl.max_cupo_evento then 'cupo por evento: '
        || coalesce(ant.max_cupo_evento::text, '∞') || ' → ' || coalesce(pl.max_cupo_evento::text, '∞') end,
      case when ant.permite_pagos <> pl.permite_pagos then 'pagos: ' || case when pl.permite_pagos then 'sí' else 'no' end end,
      case when ant.permite_virtual <> pl.permite_virtual then 'virtual: ' || case when pl.permite_virtual then 'sí' else 'no' end end,
      case when ant.permite_exportar <> pl.permite_exportar then 'exportar: ' || case when pl.permite_exportar then 'sí' else 'no' end end,
      case when ant.permite_encuestas <> pl.permite_encuestas then 'encuestas: ' || case when pl.permite_encuestas then 'sí' else 'no' end end));
  return jsonb_build_object('ok', true);
end $$;

create function public.admin_historial(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
begin
  return (select coalesce(jsonb_agg(to_jsonb(a) order by a.id desc), '[]'::jsonb)
          from (select * from capa.auditoria
                where capa.txt(p, 'q') is null
                   or (actor_nombre || ' ' || accion || ' ' || entidad || ' ' || coalesce(entidad_id, '') || ' ' || detalle)
                      ilike '%' || capa.txt(p, 'q') || '%'
                order by id desc limit coalesce(capa.txt(p, 'limite')::int, 200)) a);
end $$;

-- ---------------------------------------------------------------------------
-- Tareas programadas (vencimientos, recordatorios, certificados, encuestas)
-- En Supabase las ejecuta pg_cron cada minuto; en modo local, la propia app.
-- ---------------------------------------------------------------------------

create function capa.procesar_tareas_internas() returns jsonb
language plpgsql as $$
declare
  r record;
  v_tipo text;
  n_reservas int := 0;
  n_ofertas int := 0;
  n_recordatorios int := 0;
  n_certificados int := 0;
  n_encuestas int := 0;
  n_espera int := 0;
begin
  -- 1) Reservas con pago pendiente que vencieron (HU-04 CA-04).
  for r in
    select i.*, e.nombre as ev_nombre, us.correo as u_correo, us.nombres as u_nombres
    from capa.inscripciones i join capa.eventos e on e.id = i.evento_id join capa.usuarios us on us.id = i.usuario_id
    where i.estado = 'pendiente_pago' and i.reserva_expira_en <= capa.ahora()
  loop
    update capa.inscripciones set estado = 'expirada', reserva_expira_en = null where id = r.id;
    update capa.pagos set estado = 'sin_respuesta', mensaje = 'Reserva vencida sin confirmación', actualizado_en = capa.ahora()
      where inscripcion_id = r.id and estado = 'procesando';
    perform capa.enviar_correo(r.usuario_id, r.u_correo, 'Tu reserva en ' || r.ev_nombre || ' venció',
      'Hola ' || r.u_nombres || E',\n\nNo recibimos la confirmación de tu pago dentro de los 30 minutos, así que liberamos el cupo. '
        || 'No se realizó ningún cobro. Si aún hay cupos, puedes volver a inscribirte.',
      'pago', r.evento_id, 'Ver el evento', '/eventos/' || r.evento_id);
    perform capa.procesar_lista_espera(r.evento_id);
    n_reservas := n_reservas + 1;
  end loop;

  -- 2) Ofertas de la lista de espera sin confirmar en 24 h: pasan al siguiente (HU-05 CA-03).
  for r in
    select l.*, e.nombre as ev_nombre, us.correo as u_correo, us.nombres as u_nombres
    from capa.lista_espera l join capa.eventos e on e.id = l.evento_id join capa.usuarios us on us.id = l.usuario_id
    where l.estado = 'ofrecido' and l.oferta_expira_en <= capa.ahora()
  loop
    update capa.lista_espera set estado = 'expirado', resuelto_en = capa.ahora() where id = r.id;
    perform capa.enviar_correo(r.usuario_id, r.u_correo, 'Venció tu cupo reservado en ' || r.ev_nombre,
      'Hola ' || r.u_nombres || E',\n\nNo confirmaste el cupo que te ofrecimos dentro de las 24 horas, así que pasó a la siguiente persona de la lista de espera.',
      'lista_espera', r.evento_id);
    perform capa.procesar_lista_espera(r.evento_id);
    n_ofertas := n_ofertas + 1;
  end loop;

  -- 3) Personas que siguen esperando cuando el evento ya empezó.
  update capa.lista_espera l set estado = 'expirado', resuelto_en = capa.ahora()
  from capa.eventos e
  where e.id = l.evento_id and l.estado = 'esperando' and e.fecha_inicio <= capa.ahora();
  get diagnostics n_espera = row_count;

  -- 4) Recordatorios 24 h y 1 h antes (HU-06). Solo inscripciones confirmadas,
  --    de personas con recordatorios activos; nunca a canceladas ni en espera.
  for r in
    select i.id as ins_id, i.confirmado_en, e.*, us.id as u_id, us.correo as u_correo, us.nombres as u_nombres
    from capa.inscripciones i
    join capa.eventos e on e.id = i.evento_id
    join capa.usuarios us on us.id = i.usuario_id
    where i.estado = 'confirmada' and e.estado = 'publicado' and us.recordatorios_activos
      and e.fecha_inicio > capa.ahora() and e.fecha_inicio - interval '24 hours' <= capa.ahora()
  loop
    v_tipo := case when r.fecha_inicio - interval '1 hour' <= capa.ahora() then '1h' else '24h' end;
    -- Quien se inscribió dentro de la ventana no recibe un «24 h antes» tardío.
    continue when v_tipo = '24h' and r.confirmado_en > r.fecha_inicio - interval '24 hours';
    continue when v_tipo = '1h' and r.confirmado_en > r.fecha_inicio - interval '1 hour';
    continue when exists (select 1 from capa.recordatorios_enviados
                          where inscripcion_id = r.ins_id and tipo = v_tipo and fecha_evento_ref = r.fecha_inicio);
    insert into capa.recordatorios_enviados (inscripcion_id, tipo, fecha_evento_ref, enviado_en)
    values (r.ins_id, v_tipo, r.fecha_inicio, capa.ahora());
    perform capa.enviar_correo(r.u_id, r.u_correo,
      case when v_tipo = '24h' then 'Mañana: ' || r.nombre else 'En 1 hora: ' || r.nombre end,
      'Hola ' || r.u_nombres || E',\n\nTe recordamos que '
        || case when v_tipo = '24h' then 'el evento empieza en 24 horas.' else 'el evento empieza en 1 hora.' end
        || E'\n\n' || capa.datos_evento_texto((select e2 from capa.eventos e2 where e2.id = r.id), true)
        || case when r.modalidad <> 'virtual' then E'\nLleva tu código QR (está en Mis inscripciones) para registrar tu ingreso.' else '' end,
      'recordatorio', r.id,
      case when r.enlace_virtual is not null then 'Entrar a la sala' else 'Ver mi código QR' end,
      coalesce(r.enlace_virtual, '/mis-inscripciones'));
    n_recordatorios := n_recordatorios + 1;
  end loop;

  -- 5) Certificados de eventos que terminaron (HU-08 CA-01).
  for r in
    select id from capa.eventos
    where estado = 'publicado' and fecha_fin <= capa.ahora() and certificados_emitidos_en is null
  loop
    n_certificados := n_certificados + capa.emitir_certificados(r.id);
  end loop;

  -- 6) Encuesta de satisfacción al cierre del evento; se cierra a los 7 días (HU-14).
  for r in
    select e.* from capa.eventos e
    join capa.instituciones i on i.id = e.institucion_id
    join capa.planes pl on pl.codigo = i.plan_codigo
    left join capa.encuestas en on en.evento_id = e.id
    where e.estado = 'publicado' and e.fecha_fin <= capa.ahora() and pl.permite_encuestas
      and (en.evento_id is null or en.enviada_en is null)
  loop
    insert into capa.encuestas (evento_id, anonima, preguntas, enviada_en, cierra_en)
    values (r.id, true, capa.preguntas_predeterminadas(), capa.ahora(), capa.ahora() + interval '7 days')
    on conflict (evento_id) do update set enviada_en = capa.ahora(), cierra_en = capa.ahora() + interval '7 days';
    perform capa.enviar_correo(us.id, us.correo, '¿Qué te pareció ' || r.nombre || '?',
      'Hola ' || us.nombres || E',\n\nGracias por asistir. Cuéntanos tu opinión en una encuesta breve (menos de 2 minutos); nos ayuda a mejorar las próximas ediciones.'
        || E'\n\nLa encuesta estará abierta hasta el ' || capa.fmt_fecha(capa.ahora() + interval '7 days') || '.',
      'encuesta', r.id, 'Responder la encuesta', '/encuestas/' || r.id)
    from capa.usuarios us
    where us.id in (select i.usuario_id from capa.asistencias a join capa.inscripciones i on i.id = a.inscripcion_id
                    where a.evento_id = r.id);
    n_encuestas := n_encuestas + 1;
  end loop;

  return jsonb_build_object('reservas_vencidas', n_reservas, 'ofertas_vencidas', n_ofertas, 'esperas_cerradas', n_espera,
                            'recordatorios', n_recordatorios, 'certificados', n_certificados, 'encuestas', n_encuestas,
                            'ahora', capa.ahora());
end $$;

create function public.procesar_tareas(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
begin
  return capa.procesar_tareas_internas();
end $$;

create function public.estado_sistema(p jsonb default '{}') returns jsonb
language sql stable security definer set search_path = capa, extensions, public as $$
  select jsonb_build_object('ahora', capa.ahora(), 'modo_demo', modo_demo,
                            'reloj_desfase_min', round(extract(epoch from reloj_offset) / 60))
  from capa.config where id = 1
$$;

-- Reloj de demostración: adelanta la hora del sistema para mostrar
-- recordatorios, vencimientos, certificados y encuestas sin esperar.
create function public.admin_reloj(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  v_accion text := coalesce(capa.txt(p, 'accion'), 'consultar');
  v_tareas jsonb;
begin
  if not (select modo_demo from capa.config where id = 1) then
    perform capa.err('El reloj de demostración está desactivado.', 'PROHIBIDO');
  end if;
  if v_accion = 'avanzar' then
    update capa.config set reloj_offset = reloj_offset + make_interval(mins => capa.txt(p, 'minutos')::int),
                           actualizado_en = now() where id = 1;
  elsif v_accion = 'fijar' then
    update capa.config set reloj_offset = capa.txt(p, 'fecha')::timestamptz - now(), actualizado_en = now() where id = 1;
  elsif v_accion = 'restablecer' then
    update capa.config set reloj_offset = interval '0', actualizado_en = now() where id = 1;
  end if;
  if v_accion <> 'consultar' then
    perform capa.auditar(u, 'Ajustó el reloj de demostración', 'sistema', 'reloj',
                         'nueva hora del sistema: ' || capa.fmt_fecha(capa.ahora()));
  end if;
  v_tareas := capa.procesar_tareas_internas();
  return public.estado_sistema('{}') || jsonb_build_object('tareas', v_tareas);
end $$;
