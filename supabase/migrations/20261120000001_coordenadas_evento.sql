-- CAPACITRON · Latitud y longitud del evento (CAP-104, HU-19 Mapa con la ubicación y la hora del evento)
-- Portable (Supabase y PGlite). Requiere las migraciones de CAP-76, CAP-77, CAP-78 y CAP-99.
-- En Supabase se ejecuta en el SQL Editor después de 20261119000001_celular_usuario.sql.
--
-- Qué hace:
-- · Columnas `latitud` (-90 a 90) y `longitud` (-180 a 180) en capa.eventos, con check y siempre en pareja.
-- · guardar_evento las valida (CA-05): un número mal escrito, fuera de rango o solo una de las dos se
--   rechaza con CAMPOS nombrando el campo. En eventos virtuales quedan vacías (CA-04).
-- · Publicar un evento presencial o mixto exige el punto (CA-01), con la misma regla única de CAP-77
--   (capa.campos_faltantes_publicacion), que ahora devuelve también 'ubicacion'.
-- · detalle_evento y catalogo_eventos las devuelven, porque los dos usan capa.evento_json (CA-02).
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación (diap. 20–24): las coordenadas solo entran validadas por capa.coordenadas_evento, y la
--   tabla las vuelve a revisar con check aunque alguien escriba directo.
-- · Code smells / duplicación (diap. 33): «presencial o mixto lleva ubicación» se define una sola vez, en
--   campos_faltantes_publicacion; la usan publicar, editar un publicado y evento_gestion.
-- · Evitar sobreingeniería (diap. 135–139): dos columnas numéricas y un check; sin PostGIS, porque solo se
--   guarda y se muestra un punto.
-- Postgres no permite extender una función sin volver a declararla: guardar_evento (CAP-77 con D-01) y
-- evento_json (CAP-78) se copian completas, con lo nuevo marcado «CAP-104».
--
-- Rol: Backend y base de datos (Carlos) · Tarea: CAP-104 · Historia: HU-19 (CAP-86), criterios CA-01, CA-04 y CA-05.

-- numeric(9,6): 6 decimales son unos 11 cm, de sobra para un auditorio.
alter table capa.eventos
  add column latitud numeric(9,6) check (latitud between -90 and 90),
  add column longitud numeric(9,6) check (longitud between -180 and 180),
  add constraint eventos_coordenadas_en_pareja check ((latitud is null) = (longitud is null));

comment on column capa.eventos.latitud is 'Latitud del lugar (-90 a 90). Null en eventos virtuales o sin punto marcado.';
comment on column capa.eventos.longitud is 'Longitud del lugar (-180 a 180). Null en eventos virtuales o sin punto marcado.';

-- CA-05: lee y valida las coordenadas de la llamada. Vacías = sin punto. Mal escritas, fuera de rango o
-- solo una de las dos: CAMPOS con el mismo texto que muestra el formulario (ficha de diseño CAP-103).
create or replace function capa.coordenadas_evento(p jsonb, out v_lat numeric, out v_lng numeric)
language plpgsql stable as $$
declare
  v_malos text[] := '{}';
begin
  begin
    v_lat := capa.txt(p, 'latitud')::numeric;
  exception when others then
    v_malos := array_append(v_malos, 'latitud');
  end;
  begin
    v_lng := capa.txt(p, 'longitud')::numeric;
  exception when others then
    v_malos := array_append(v_malos, 'longitud');
  end;
  if v_lat is not null and v_lat not between -90 and 90 then v_malos := array_append(v_malos, 'latitud'); end if;
  if v_lng is not null and v_lng not between -180 and 180 then v_malos := array_append(v_malos, 'longitud'); end if;
  if cardinality(v_malos) = 0 and (v_lat is null) <> (v_lng is null) then
    v_malos := array_append(v_malos, case when v_lat is null then 'latitud' else 'longitud' end);
  end if;
  if cardinality(v_malos) > 0 then
    perform capa.err('Las coordenadas están fuera de rango. Vuelve a marcar el punto en el mapa.',
                     'CAMPOS', jsonb_build_object('campos', v_malos));
  end if;
  v_lat := round(v_lat, 6);
  v_lng := round(v_lng, 6);
end $$;

-- Regla única de publicación (CAP-77) con el punto en el mapa.
create or replace function capa.campos_faltantes_publicacion(e capa.eventos) returns text[]
language sql immutable as $$
  select array_remove(array[
    case when e.tipo is null then 'tipo' end,
    case when e.modalidad in ('presencial', 'mixta') and e.lugar is null then 'lugar' end,
    -- CAP-104 (HU-19 CA-01): presencial o mixto también lleva el punto en el mapa.
    case when e.modalidad in ('presencial', 'mixta') and (e.latitud is null or e.longitud is null) then 'ubicacion' end,
    case when e.organizador_nombre is null then 'organizador_nombre' end,
    case when e.contacto is null then 'contacto' end
  ], null)
$$;

-- Crear y editar evento (CAP-77 con la corrección D-01) con las coordenadas.
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
  -- CAP-104: coordenadas ya validadas (capa.coordenadas_evento lanza CAMPOS si están mal).
  c record;
  v_quitados text[];
  v_activos int;
  r record;
begin
  perform capa.exigir_rol(u, 'organizador');
  c := capa.coordenadas_evento(p);

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
                              firmante_cargo, tipo, organizador_nombre, contacto, contacto_consentimiento, latitud, longitud,
                              estado, creado_en, actualizado_en)
    values (u.id, u.institucion_id, v_nombre, v_desc, v_inicio, v_fin, v_mod,
            case when v_mod = 'virtual' then null else v_lugar end, v_cupo, v_costo, v_pct, v_horas,
            coalesce(capa.txt(p, 'firmante_nombre'), capa.nombre_completo(u)),
            coalesce(capa.txt(p, 'firmante_cargo'), 'Coordinación académica'),
            v_tipo, v_org, v_contacto, v_consent,
            case when v_mod = 'virtual' then null else c.v_lat end, case when v_mod = 'virtual' then null else c.v_lng end,
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
      -- CAP-104: un evento virtual no tiene punto (CA-04); si la llamada no trae coordenadas, se conservan.
      latitud = case when v_mod = 'virtual' then null when p ? 'latitud' or p ? 'longitud' then c.v_lat else ant.latitud end,
      longitud = case when v_mod = 'virtual' then null when p ? 'latitud' or p ? 'longitud' then c.v_lng else ant.longitud end,
      actualizado_en = capa.ahora()
    where id = ant.id
    returning * into e;

    -- D-01 (hallado por las pruebas de aceptación de CAP-79): un evento ya publicado no puede quedarse
    -- sin tipo, lugar, organizador o contacto al editarlo (CA-07 y RN-01). Se usa la misma regla que al
    -- publicar (una sola función, diap. 33), así crear y editar cumplen lo mismo (LSP, diap. 64–79).
    -- El error deshace el update anterior porque todo ocurre en la misma transacción.
    -- CAP-104: solo se impide QUITAR lo que ya tenía. Un evento publicado antes de la HU-19 no tiene punto
    -- en el mapa y se puede seguir editando; pero si ya lo tenía, no se puede borrar.
    v_quitados := array(select unnest(capa.campos_faltantes_publicacion(e))
                        except select unnest(capa.campos_faltantes_publicacion(ant)));
    if e.estado = 'publicado' and cardinality(v_quitados) > 0 then
      perform capa.err('Un evento publicado debe conservar su tipo, lugar, punto en el mapa, organizador y contacto. Complétalos para guardar los cambios.',
                       'CAMPOS', jsonb_build_object('campos', to_jsonb(capa.campos_faltantes_publicacion(e))));
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

-- Datos públicos del evento (CAP-78) con las coordenadas.
create or replace function capa.evento_json(e capa.eventos) returns jsonb
language sql stable as $$
  select jsonb_build_object(
    'id', e.id,
    'nombre', e.nombre,
    'descripcion', e.descripcion,
    'fecha_inicio', e.fecha_inicio,
    'fecha_fin', e.fecha_fin,
    'modalidad', e.modalidad,
    'lugar', e.lugar,
    -- CAP-104 (HU-19 CA-02 y CA-04): punto del lugar; null en eventos virtuales o sin punto marcado.
    'latitud', e.latitud,
    'longitud', e.longitud,
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
    -- CAP-78 (HU-02 CA-06 y CA-08): datos públicos del evento. El contacto solo sale con consentimiento.
    'tipo', e.tipo,
    'organizador_nombre', e.organizador_nombre,
    'contacto_publico', e.contacto is not null and e.contacto_consentimiento,
    'contacto', case when e.contacto_consentimiento then e.contacto end,
    'organizador_id', e.organizador_id,
    'organizador', (select u.nombres || ' ' || u.apellidos from capa.usuarios u where u.id = e.organizador_id),
    'institucion', (select jsonb_build_object('id', i.id, 'nombre', i.nombre, 'siglas', i.siglas)
                    from capa.instituciones i where i.id = e.institucion_id),
    'ponentes_resumen', (select coalesce(jsonb_agg(pn.nombre order by pn.orden, pn.creado_en), '[]'::jsonb)
                         from capa.ponentes pn where pn.evento_id = e.id)
  )
$$;
