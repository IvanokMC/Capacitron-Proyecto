-- CAPACITRON · Campos públicos del evento y contacto con consentimiento (CAP-78, HU-02)
-- Portable (Supabase y PGlite). Requiere las migraciones de CAP-76, CAP-77 y CAP-94.
-- En Supabase se ejecuta en el SQL Editor después de 20261116000002_foto_usuario.sql.
--
-- CA-06: la página del evento y el catálogo muestran el tipo, el lugar, el organizador y el contacto.
-- CA-08 (Ley N.° 29733): sin consentimiento, el correo o teléfono no se muestra y se ofrece un
-- formulario; el mensaje llega al organizador sin que el visitante vea su dato.
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación y ocultamiento de información (diap. 20–24): evento_json, que alimenta todas las
--   vistas públicas, decide en un solo punto si el contacto sale o no. Ninguna pantalla puede
--   mostrarlo por error, porque el dato no viaja si no hay consentimiento.
-- · SRP (diap. 39–49): contactar_organizador solo entrega un mensaje; no expone ni modifica el evento.
-- · Evitar sobreingeniería (diap. 135–139): el mensaje se envía con el mismo capa.enviar_correo de
--   las notificaciones, sin una tabla nueva de mensajes.
--
-- Rol: Frontend (José) · Tarea: CAP-78 · Historia: HU-02 (CAP-2), criterios CA-06 y CA-08.

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

-- Formulario de contacto (CA-08). Lo usa cualquier visitante, con o sin sesión.
create or replace function public.contactar_organizador(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  e capa.eventos;
  org capa.usuarios;
  v_nombre text := capa.txt(p, 'nombre');
  v_correo text := lower(capa.txt(p, 'correo'));
  v_mensaje text := capa.txt(p, 'mensaje');
  v_faltan text[] := '{}';
  v_recientes int;
begin
  select * into e from capa.eventos where id = capa.txt(p, 'evento_id')::uuid and estado = 'publicado';
  if not found then
    perform capa.err('No encontramos el evento.', 'NO_ENCONTRADO');
  end if;

  if v_nombre is null then v_faltan := array_append(v_faltan, 'nombre'); end if;
  if v_correo is null or v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then v_faltan := array_append(v_faltan, 'correo'); end if;
  if v_mensaje is null or length(v_mensaje) < 10 then v_faltan := array_append(v_faltan, 'mensaje'); end if;
  if cardinality(v_faltan) > 0 then
    perform capa.err('Escribe tu nombre, un correo válido y un mensaje de al menos 10 caracteres.', 'CAMPOS',
                     jsonb_build_object('campos', v_faltan));
  end if;
  if length(v_mensaje) > 1000 or length(v_nombre) > 120 then
    perform capa.err('El mensaje puede tener hasta 1000 caracteres.', 'CAMPOS', '{"campos":["mensaje"]}');
  end if;

  -- Freno contra el envío masivo: hasta 10 mensajes por evento en una hora.
  select count(*) into v_recientes from capa.correos
  where evento_id = e.id and tipo = 'contacto_evento' and enviado_en > capa.ahora() - interval '1 hour';
  if v_recientes >= 10 then
    perform capa.err('El organizador recibió muchos mensajes en la última hora. Inténtalo más tarde.', 'LIMITE');
  end if;

  select * into org from capa.usuarios where id = e.organizador_id;
  perform capa.enviar_correo(org.id, org.correo, 'Consulta sobre ' || e.nombre,
    'Hola ' || org.nombres || E',\n\nUna persona te escribió desde la página del evento «' || e.nombre || E'»:\n\n'
      || 'Nombre: ' || v_nombre || E'\n' || 'Correo para responder: ' || v_correo || E'\n\n' || v_mensaje
      || E'\n\nTu correo o teléfono de contacto no se mostró, porque no autorizaste publicarlo.',
    'contacto_evento', e.id, 'Ver el evento', '/eventos/' || e.id);
  return jsonb_build_object('ok', true);
end $$;

-- En Supabase, las funciones públicas nuevas necesitan permiso de ejecución (en PGlite no existen estos roles).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.contactar_organizador(jsonb) to anon, authenticated';
  end if;
end $$;
