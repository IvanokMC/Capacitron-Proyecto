-- CAPACITRON · Validaciones de los campos nuevos del evento (CAP-77, refinamiento de la HU-02)
-- Portable (Supabase y PGlite). Requiere 20261109000001_campos_evento.sql (CAP-76).
-- En Supabase se ejecuta en el SQL Editor después de la migración de CAP-76.
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación (diap. 20–24): los campos solo cambian por guardar_evento, que valida
--   el tipo, y el contacto no sale por evento_json (catálogo y detalle públicos), solo por
--   evento_gestion, que exige ser el organizador del evento.
-- · Code smells / duplicación (diap. 33): la regla «qué falta para publicar» vive en una sola
--   función, capa.campos_faltantes_publicacion, que usan publicar y evento_gestion.
-- · SRP (diap. 39–49): guardar un borrador no exige estos campos; exigirlos es responsabilidad
--   de publicar (CA-02 se mantiene: un borrador se guarda incompleto).
-- · Evitar sobreingeniería (diap. 135–139): se redefinen las funciones existentes en lugar de
--   crear una capa nueva; Postgres no permite extender una función sin volver a declararla.
--
-- Rol: Frontend (José) · Tarea: CAP-77 · Historia: HU-02 (CAP-2), criterio CA-07.

-- Campos que faltan para publicar un evento (CA-07). Un evento virtual no necesita lugar.
create or replace function capa.campos_faltantes_publicacion(e capa.eventos) returns text[]
language sql immutable as $$
  select array_remove(array[
    case when e.tipo is null then 'tipo' end,
    case when e.modalidad in ('presencial', 'mixta') and e.lugar is null then 'lugar' end,
    case when e.organizador_nombre is null then 'organizador_nombre' end,
    case when e.contacto is null then 'contacto' end
  ], null)
$$;

-- Publicar (usado por guardar_evento con accion = 'publicar' y por publicar_evento).
create or replace function capa.publicar(e capa.eventos) returns capa.eventos
language plpgsql as $$
declare
  pl capa.planes := capa.plan_institucion(e.institucion_id);
  activos int;
  faltan text[];
begin
  if e.estado <> 'borrador' then
    perform capa.err('Solo se pueden publicar eventos en borrador.');
  end if;
  -- CA-07: sin tipo, lugar, organizador o contacto no se publica. La lista sale de una sola función.
  faltan := capa.campos_faltantes_publicacion(e);
  if cardinality(faltan) > 0 then
    perform capa.err('Para publicar, completa el tipo, el lugar, el organizador y el contacto del evento.',
                     'CAMPOS', jsonb_build_object('campos', faltan));
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

-- Crear o editar un evento: ahora recibe tipo, organizador, contacto y consentimiento.
create or replace function public.guardar_evento(p jsonb) returns jsonb
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
  -- CAP-77: campos del refinamiento de la HU-02 (las columnas las creó CAP-76)
  v_tipo text := capa.txt(p, 'tipo');
  v_org text := capa.txt(p, 'organizador_nombre');
  v_contacto text := capa.txt(p, 'contacto');
  v_consent boolean := coalesce(capa.txt(p, 'contacto_consentimiento')::boolean, false);
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
  if v_tipo is not null and v_tipo not in ('seminario', 'congreso', 'taller', 'curso') then
    perform capa.err('Elige un tipo: seminario, congreso, taller o curso.', 'CAMPOS', '{"campos":["tipo"]}');
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
                              firmante_cargo, tipo, organizador_nombre, contacto, contacto_consentimiento,
                              estado, creado_en, actualizado_en)
    values (u.id, u.institucion_id, v_nombre, v_desc, v_inicio, v_fin, v_mod,
            case when v_mod = 'virtual' then null else v_lugar end, v_cupo, v_costo, v_pct, v_horas,
            coalesce(capa.txt(p, 'firmante_nombre'), capa.nombre_completo(u)),
            coalesce(capa.txt(p, 'firmante_cargo'), 'Coordinación académica'),
            v_tipo, v_org, v_contacto, v_consent,
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
      -- D-01: un campo que la llamada no envía conserva su valor; solo un null explícito lo borra.
      -- Antes, editar sin mandar estos campos los dejaba en null aunque el evento estuviera publicado.
      tipo = case when p ? 'tipo' then v_tipo else ant.tipo end,
      organizador_nombre = case when p ? 'organizador_nombre' then v_org else ant.organizador_nombre end,
      contacto = case when p ? 'contacto' then v_contacto else ant.contacto end,
      contacto_consentimiento = case when p ? 'contacto_consentimiento' then v_consent else ant.contacto_consentimiento end,
      actualizado_en = capa.ahora()
    where id = ant.id
    returning * into e;

    -- D-01 (hallado por las pruebas de aceptación de CAP-79): un evento ya publicado no puede quedarse
    -- sin tipo, lugar, organizador o contacto al editarlo (CA-07 y RN-01). Se usa la misma regla que al
    -- publicar (una sola función, diap. 33), así crear y editar cumplen lo mismo (LSP, diap. 64–79).
    -- El error deshace el update anterior porque todo ocurre en la misma transacción.
    if e.estado = 'publicado' and cardinality(capa.campos_faltantes_publicacion(e)) > 0 then
      perform capa.err('Un evento publicado debe conservar su tipo, lugar, organizador y contacto. Complétalos para guardar los cambios.',
                       'CAMPOS', jsonb_build_object('campos', capa.campos_faltantes_publicacion(e)));
    end if;

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

-- Vista del organizador: incluye sus campos y lo que le falta para publicar.
create or replace function public.evento_gestion(p jsonb) returns jsonb
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
    'tipo', e.tipo,
    'organizador_nombre', e.organizador_nombre,
    'contacto', e.contacto,
    'contacto_consentimiento', e.contacto_consentimiento,
    'faltan_para_publicar', to_jsonb(capa.campos_faltantes_publicacion(e)),
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
