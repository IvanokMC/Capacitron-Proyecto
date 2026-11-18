-- CAPACITRON · Comprobantes de pago privados (CAP-92, HU-16 Pago real con verificación manual)
-- Requiere 20261122000001_pagos_manuales.sql (CAP-89). En Supabase se ejecuta en el SQL Editor después de esa.
--
-- La captura del comprobante es un dato personal (Ley N.° 29733): solo la ven su dueña y la administración.
-- CAPACITRON usa sus propias sesiones (capa.sesiones), no Supabase Auth, así que Storage no sabe quién pide un archivo.
-- Por eso el bucket es privado y nadie lo lee directamente con la clave pública. Para ver una captura:
--   1. el navegador llama a la Edge Function «url-comprobante» con su token de sesión y la ruta;
--   2. la función pregunta a public.ruta_comprobante_autorizada (abajo) si esa sesión puede verla;
--   3. si puede, firma un enlace de 60 segundos con la clave de servicio, que solo existe en el servidor.
--
-- Parte 1 (portable, también en PGlite): la función que autoriza.
-- Parte 2 (solo Supabase; en PGlite no hace nada): el bucket privado y su política de subida.
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación (diap. 20–24): quién puede ver una captura lo decide la base de datos, en un solo lugar; la Edge
--   Function solo firma lo que la base autoriza.
-- · DIP (diap. 92–106): las pantallas siguen usando el módulo común de almacenamiento (url); la firma entra como
--   una dependencia de la implementación de Supabase.
-- · Evitar sobreingeniería (diap. 135–139): no se agrega Supabase Auth ni un servidor propio; una función corta.
--
-- Rol: DevOps (George) · Tarea: CAP-92 · Historia: HU-16 (CAP-83).

-- ---------------------------------------------------------------------------
-- Parte 1 · ¿Puede esta sesión ver esta captura?
-- ---------------------------------------------------------------------------
-- Buscar el pago por la ruta de su captura sin recorrer toda la tabla.
create index if not exists pagos_comprobante_idx on capa.pagos (comprobante_ruta) where comprobante_ruta is not null;

create or replace function public.ruta_comprobante_autorizada(p jsonb) returns jsonb
language plpgsql stable security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  pg capa.pagos;
begin
  select * into pg from capa.pagos where comprobante_ruta = capa.txt(p, 'ruta') order by creado_en desc limit 1;
  if not found then
    perform capa.err('No encontramos este comprobante.', 'NO_ENCONTRADO');
  end if;
  -- Solo la persona que pagó y la administración (ni el organizador del evento ni otros asistentes).
  if pg.usuario_id <> u.id and u.rol <> 'admin' then
    perform capa.err('No tienes acceso a este comprobante.', 'PROHIBIDO');
  end if;
  return jsonb_build_object('bucket', 'comprobantes', 'ruta', pg.comprobante_ruta);
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'grant execute on function public.ruta_comprobante_autorizada(jsonb) to anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Parte 2 · Bucket privado (solo Supabase)
-- ---------------------------------------------------------------------------
do $bloque$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Sin Supabase Storage: se omite el bucket de comprobantes (modo local y pruebas).';
    return;
  end if;

  -- Privado (public = false), 3 MB y los mismos tipos que REGLAS.comprobantes del módulo de almacenamiento.
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('comprobantes', 'comprobantes', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  -- Subir: solo archivos nuevos dentro de una carpeta con forma de id de inscripción (<uuid>/<archivo>), la forma que
  -- exige registrar_pago_manual (CAP-89). Sin políticas de lectura, actualización ni borrado: nadie lee con la clave
  -- pública; las lecturas pasan por la Edge Function «url-comprobante».
  execute 'drop policy if exists "comprobantes: subir archivo nuevo" on storage.objects';
  execute $p$create policy "comprobantes: subir archivo nuevo" on storage.objects
    for insert to anon, authenticated
    with check (
      bucket_id = 'comprobantes'
      and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$'
    )$p$;
end
$bloque$;
