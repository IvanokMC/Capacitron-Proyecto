-- CAPACITRON · Flyer e imagen del lugar del evento (CAP-109, HU-20 Flyer e imagen del lugar)
-- Portable (Supabase y PGlite). Requiere las migraciones de CAP-76, CAP-77, CAP-78, CAP-99 y CAP-104.
-- En Supabase se ejecuta en el SQL Editor después de 20261120000001_coordenadas_evento.sql.
--
-- Qué guarda: la RUTA de cada imagen dentro del bucket de imágenes de eventos
-- («<id del evento>/<archivo>.webp»), no la URL. La URL la arma el módulo común de almacenamiento
-- (CAP-97); el bucket y sus políticas son de CAP-112 (George), que debe usar esta misma forma de ruta.
-- También guarda el texto alternativo de cada imagen (accesibilidad, ficha de diseño CAP-108).
--
-- · public.guardar_imagenes_evento: guarda o quita el flyer y la imagen del lugar. Solo el organizador del
--   evento (CA-05). Una clave ausente no toca nada; vacía, quita la imagen y su descripción.
-- · catalogo_eventos y detalle_evento las devuelven por capa.evento_json, también sin sesión (CA-01 a CA-03).
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación (diap. 20–24): las imágenes solo cambian por guardar_imagenes_evento, que exige ser el dueño
--   (capa.evento_del_organizador) y que el archivo esté en la carpeta de ESE evento.
-- · SRP (diap. 39–49): guardar las imágenes no se mezcla con guardar los demás datos del evento
--   (guardar_evento): subir un flyer no obliga a reenviar fechas, cupos ni coordenadas.
-- · Code smells / duplicación (diap. 33): la forma de la ruta vive en capa.ruta_imagen_evento_valida, que usan
--   el check de las columnas y la función; el tipo y el tamaño del archivo (3 MB) los valida el módulo de
--   almacenamiento y el bucket (CAP-112), no se repiten aquí.
-- · DIP y bajo acoplamiento (diap. 29–35 y 92–106): se guarda una ruta, no una URL de Supabase.
--
-- Rol: Backend y base de datos (Carlos) · Tarea: CAP-109 · Historia: HU-20 (CAP-87), criterios CA-01 a CA-03 y CA-05.

-- Forma de la ruta: <uuid del evento>/<nombre>.<jpg|jpeg|png|webp>
create or replace function capa.ruta_imagen_evento_valida(ruta text) returns boolean
language sql immutable as $$
  select ruta ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$'
$$;

alter table capa.eventos
  add column flyer_url text check (flyer_url is null or capa.ruta_imagen_evento_valida(flyer_url)),
  add column flyer_alt text check (char_length(flyer_alt) <= 200),
  add column imagen_lugar_url text check (imagen_lugar_url is null or capa.ruta_imagen_evento_valida(imagen_lugar_url)),
  add column imagen_lugar_alt text check (char_length(imagen_lugar_alt) <= 200);

comment on column capa.eventos.flyer_url is 'Ruta del flyer en el bucket de imágenes de eventos: <id del evento>/<archivo>. Nula = sin flyer.';
comment on column capa.eventos.imagen_lugar_url is 'Ruta de la imagen del lugar en el bucket de imágenes de eventos. Nula = sin imagen.';
comment on column capa.eventos.flyer_alt is 'Texto alternativo del flyer (máximo 200 caracteres).';
comment on column capa.eventos.imagen_lugar_alt is 'Texto alternativo de la imagen del lugar (máximo 200 caracteres).';

-- Guardar o quitar las imágenes del evento (CA-01, CA-02 y CA-05).
create or replace function public.guardar_imagenes_evento(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  e capa.eventos;
  v_malos text[] := '{}';
  v_ruta text;
  k text;
begin
  perform capa.exigir_rol(u, 'organizador');
  -- CA-05: solo el dueño del evento (si no, PROHIBIDO o NO_ENCONTRADO, como el resto de la gestión).
  e := capa.evento_del_organizador(u, capa.txt(p, 'id')::uuid, true);
  if e.estado = 'cancelado' then
    perform capa.err('El evento está cancelado y ya no se puede editar.');
  end if;
  -- Cada ruta debe tener la forma correcta y estar en la carpeta de ESTE evento.
  foreach k in array array['flyer_url', 'imagen_lugar_url'] loop
    if p ? k then
      v_ruta := capa.txt(p, k);
      if v_ruta is not null and (not capa.ruta_imagen_evento_valida(v_ruta) or split_part(v_ruta, '/', 1) <> e.id::text) then
        v_malos := array_append(v_malos, k);
      end if;
    end if;
  end loop;
  if cardinality(v_malos) > 0 then
    perform capa.err('Usa una imagen JPG, PNG o WEBP subida para este evento.', 'CAMPOS', jsonb_build_object('campos', v_malos));
  end if;
  foreach k in array array['flyer_alt', 'imagen_lugar_alt'] loop
    if char_length(capa.txt(p, k)) > 200 then v_malos := array_append(v_malos, k); end if;
  end loop;
  if cardinality(v_malos) > 0 then
    perform capa.err('La descripción de la imagen puede tener hasta 200 caracteres.', 'CAMPOS', jsonb_build_object('campos', v_malos));
  end if;

  update capa.eventos set
    flyer_url = case when p ? 'flyer_url' then capa.txt(p, 'flyer_url') else flyer_url end,
    imagen_lugar_url = case when p ? 'imagen_lugar_url' then capa.txt(p, 'imagen_lugar_url') else imagen_lugar_url end,
    actualizado_en = capa.ahora()
  where id = e.id
  returning * into e;
  -- La descripción va con su imagen: si no hay imagen, no queda una descripción suelta.
  update capa.eventos set
    flyer_alt = case when e.flyer_url is null then null when p ? 'flyer_alt' then capa.txt(p, 'flyer_alt') else flyer_alt end,
    imagen_lugar_alt = case when e.imagen_lugar_url is null then null when p ? 'imagen_lugar_alt' then capa.txt(p, 'imagen_lugar_alt') else imagen_lugar_alt end
  where id = e.id
  returning * into e;
  return jsonb_build_object('ok', true, 'evento', capa.evento_json(e));
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.guardar_imagenes_evento(jsonb) to anon, authenticated';
  end if;
end $$;

-- Datos públicos del evento (CAP-104) con las imágenes.
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
    -- CAP-109 (HU-20 CA-01 a CA-03): flyer e imagen del lugar, también para visitantes sin sesión.
    'flyer_url', e.flyer_url,
    'flyer_alt', e.flyer_alt,
    'imagen_lugar_url', e.imagen_lugar_url,
    'imagen_lugar_alt', e.imagen_lugar_alt,
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
