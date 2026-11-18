-- CAPACITRON · Bucket público de imágenes de eventos en Supabase Storage (CAP-112, HU-20)
-- Solo tiene efecto en Supabase. En PGlite (modo local y pruebas) no existe el esquema storage y el
-- bloque termina sin hacer nada: el modo local guarda los archivos con src/lib/almacenamiento/local.ts.
-- Se ejecuta en el SQL Editor de Supabase en cualquier momento; se puede repetir sin efectos dobles.
--
-- Reglas (HU-20 CA-01, CA-03, CA-04 y CA-05):
-- · Lectura pública: el flyer y la imagen del lugar se ven en el catálogo y en la página del evento, sin sesión.
-- · Solo JPG, PNG o WEBP de hasta 3 MB: lo controla el propio bucket, además del módulo de almacenamiento
--   (REGLAS.eventos en src/lib/almacenamiento/contrato.ts).
-- · Subir solo archivos nuevos dentro de una carpeta con forma de id de evento (<uuid>/<archivo>), la misma
--   forma que acepta capa.ruta_imagen_evento_valida (CAP-109).
-- · Nadie puede reemplazar ni borrar un archivo: no hay políticas de update ni delete.
--
-- «Escritura solo para el organizador»: CAPACITRON usa sus propias sesiones (capa.sesiones), no Supabase Auth,
-- así que Storage no sabe quién sube. La regla la hace cumplir guardar_imagenes_evento (CAP-109): solo el dueño
-- del evento puede asociar una imagen, y solo si está en la carpeta de ESE evento. Como los archivos no se
-- reemplazan ni se borran, nadie puede alterar la imagen que el organizador ya eligió.
-- Riesgo que queda (igual que en el bucket de fotos, CAP-97): alguien podría subir archivos sueltos a la carpeta
-- de un evento; no se muestran en ninguna parte y los limitan el tipo y el tamaño. Limpiarlos queda como mejora.
--
-- Teoría de Diseño de Software aplicada:
-- · DIP y code smells (diap. 92–106 y 33): el mismo módulo y la misma forma de bucket que las fotos de perfil;
--   el bucket nuevo no agrega otra manera de subir archivos.
-- · Encapsulación (diap. 20–24): qué imagen es de qué evento se decide en la base de datos.
--
-- Rol: DevOps (George) · Tarea: CAP-112 · Historia: HU-20 (CAP-87).

do $bloque$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Sin Supabase Storage: se omite el bucket de imágenes de eventos (modo local y pruebas).';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('eventos', 'eventos', true, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "eventos: lectura publica" on storage.objects';
  execute $p$create policy "eventos: lectura publica" on storage.objects
    for select to anon, authenticated using (bucket_id = 'eventos')$p$;

  execute 'drop policy if exists "eventos: subir archivo nuevo" on storage.objects';
  execute $p$create policy "eventos: subir archivo nuevo" on storage.objects
    for insert to anon, authenticated
    with check (
      bucket_id = 'eventos'
      and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$'
    )$p$;
end
$bloque$;
