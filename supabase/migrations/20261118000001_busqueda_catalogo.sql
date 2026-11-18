-- CAPACITRON · Búsqueda y filtros del catálogo (CAP-80, HU-15)
-- Portable (Supabase y PGlite). Requiere las migraciones de CAP-76, CAP-77 y CAP-78.
-- En Supabase se ejecuta en el SQL Editor después de 20261117000001_campos_publicos_evento.sql.
--
-- Amplía public.catalogo_eventos, que ya buscaba por texto y filtraba por modalidad y precio:
-- · CA-01: el tema se busca en el nombre, la descripción, la institución y el nombre público del organizador.
-- · CA-02: rango de fechas `desde` / `hasta` (AAAA-MM-DD, hora de Lima) sobre la fecha de inicio.
-- · CA-03: `tipo` (seminario, congreso, taller o curso) y `ubicacion` (texto del lugar). «Virtual» sigue
--   siendo `modalidad = virtual`. Todos los filtros se combinan entre sí.
-- · CA-05: la búsqueda no exige sesión ni guarda nada del visitante (la función es de solo lectura).
-- Solo se listan eventos publicados (regla de negocio de la HU-15).
--
-- Teoría de Diseño de Software aplicada:
-- · OCP y compatibilidad (diap. 50–63): los parámetros nuevos son opcionales. Las llamadas
--   que ya existían (q, modalidad, precio, incluir_pasados) devuelven exactamente lo mismo.
-- · SRP (diap. 39–49): capa.filtros_catalogo solo valida y normaliza los filtros; catalogo_eventos
--   solo consulta. Así un filtro mal escrito se rechaza con un mensaje claro y no con un error de SQL.
-- · Code smells / duplicación (diap. 33): el patrón de texto se arma una sola vez (capa.patron_busqueda)
--   en lugar de repetir `'%' || ... || '%'` en cada columna; además escapa % y _ escritos por el usuario.
-- · Evitar sobreingeniería (diap. 135–139): ILIKE e índices B-tree bastan para el volumen de un catálogo
--   académico; no se agrega búsqueda de texto completo ni extensiones nuevas.
--
-- Rol: Backend (Carlos) · Tarea: CAP-80 · Historia: HU-15 (CAP-75), criterios CA-01 a CA-03 y CA-05.

-- Patrón para ILIKE: texto del usuario entre comodines, con sus propios % _ y \ escapados.
create or replace function capa.patron_busqueda(t text) returns text
language sql immutable as $$
  select case when t is null then null
              else '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%' end
$$;

-- Valida y normaliza los filtros. Devuelve las fechas ya convertidas para no repetir el cast.
create or replace function capa.filtros_catalogo(p jsonb, out v_desde date, out v_hasta date, out v_tipo text)
language plpgsql stable as $$
declare
  v_malos text[] := '{}';
begin
  v_tipo := lower(capa.txt(p, 'tipo'));
  if v_tipo is not null and v_tipo not in ('seminario', 'congreso', 'taller', 'curso') then
    v_malos := array_append(v_malos, 'tipo');
  end if;
  begin
    v_desde := capa.txt(p, 'desde')::date;
  exception when others then
    v_malos := array_append(v_malos, 'desde');
  end;
  begin
    v_hasta := capa.txt(p, 'hasta')::date;
  exception when others then
    v_malos := array_append(v_malos, 'hasta');
  end;
  if v_desde is not null and v_hasta is not null and v_hasta < v_desde then
    v_malos := array_append(v_malos, 'hasta');
  end if;
  if cardinality(v_malos) > 0 then
    perform capa.err('Revisa los filtros: el tipo debe ser seminario, congreso, taller o curso, y la fecha final no puede ser anterior a la inicial.',
                     'CAMPOS', jsonb_build_object('campos', v_malos));
  end if;
end $$;

create or replace function public.catalogo_eventos(p jsonb default '{}') returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  f record := capa.filtros_catalogo(p);
  v_q text := capa.patron_busqueda(capa.txt(p, 'q'));
  v_lugar text := capa.patron_busqueda(capa.txt(p, 'ubicacion'));
  r jsonb;
begin
  select coalesce(jsonb_agg(capa.evento_json(e) order by (e.fecha_fin < capa.ahora()), e.fecha_inicio), '[]'::jsonb)
  into r
  from capa.eventos e
  where e.estado = 'publicado'
    and (coalesce((p ->> 'incluir_pasados')::boolean, false) or e.fecha_fin >= capa.ahora())
    and (capa.txt(p, 'modalidad') is null or e.modalidad = capa.txt(p, 'modalidad'))
    and (capa.txt(p, 'precio') is null
         or (capa.txt(p, 'precio') = 'gratis' and e.costo = 0)
         or (capa.txt(p, 'precio') = 'pago' and e.costo > 0))
    -- CA-01: tema en nombre, descripción, institución o nombre público del organizador
    and (v_q is null
         or e.nombre ilike v_q
         or e.descripcion ilike v_q
         or e.organizador_nombre ilike v_q
         or exists (select 1 from capa.instituciones i where i.id = e.institucion_id
                    and (i.nombre ilike v_q or i.siglas ilike v_q)))
    -- CA-03: tipo y ubicación
    and (f.v_tipo is null or e.tipo = f.v_tipo)
    and (v_lugar is null or e.lugar ilike v_lugar)
    -- CA-02: el evento inicia dentro del rango (días de Lima, ambos extremos incluidos)
    and (f.v_desde is null or e.fecha_inicio >= (f.v_desde::timestamp at time zone 'America/Lima'))
    and (f.v_hasta is null or e.fecha_inicio < ((f.v_hasta + 1)::timestamp at time zone 'America/Lima'));
  return r;
end $$;

-- Índices de la HU-15. Ya existe eventos_estado_fecha_idx (estado, fecha_inicio) para el rango de fechas;
-- este cubre el filtro por tipo sobre los eventos publicados, que son los únicos que se buscan.
create index if not exists eventos_publicados_tipo_fecha_idx
  on capa.eventos (tipo, fecha_inicio) where estado = 'publicado';
