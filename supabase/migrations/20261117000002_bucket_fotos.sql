-- CAPACITRON · Bucket de fotos de perfil en Supabase Storage (CAP-97, HU-17)
-- Solo tiene efecto en Supabase. En PGlite (modo local y pruebas) no existe el esquema storage y el
-- bloque termina sin hacer nada: el modo local guarda los archivos con src/lib/almacenamiento/local.ts.
-- Se ejecuta en el SQL Editor de Supabase en cualquier momento; se puede repetir sin efectos dobles.
--
-- Reglas (HU-17 CA-01, CA-02 y CA-05):
-- · Lectura pública: la foto se muestra en el menú y en la lista de inscritos.
-- · Solo JPG, PNG o WEBP de hasta 2 MB: lo controla el propio bucket, además de la validación en pantalla.
-- · Subir solo archivos nuevos dentro de una carpeta con forma de id de usuario (<uuid>/<archivo>).
-- · Nadie puede reemplazar ni borrar un archivo: no hay políticas de update ni delete.
--
-- Por qué así: CAPACITRON usa sus propias sesiones (capa.sesiones), no Supabase Auth, así que
-- Storage no sabe quién sube. La regla «solo yo cambio mi foto» (CA-05) la hace cumplir
-- actualizar_perfil (CAP-94), que solo acepta rutas dentro de la carpeta del dueño del token. Como los
-- archivos no se pueden reemplazar ni borrar, nadie puede alterar la foto que otra persona ya eligió.
-- Riesgo que queda: alguien podría subir archivos sueltos a una carpeta ajena; no se muestran en
-- ninguna parte y los limitan el tipo y el tamaño. Limpiar esos archivos queda como mejora futura.
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación (diap. 20–24): la decisión de qué foto es de quién vive en un solo lugar (la base de
--   datos); Storage solo guarda archivos que no cambian.
-- · Evitar sobreingeniería (diap. 135–139): no se agrega una función de borde ni URLs firmadas mientras
--   las reglas de arriba basten para la HU-17.
--
-- Rol: DevOps (George) · Tarea: CAP-97 · Historia: HU-17 (CAP-84).

do $bloque$
begin
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise notice 'Sin Supabase Storage: se omite el bucket de fotos (modo local y pruebas).';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos', 'fotos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists "fotos: lectura publica" on storage.objects';
  execute $p$create policy "fotos: lectura publica" on storage.objects
    for select to anon, authenticated using (bucket_id = 'fotos')$p$;

  execute 'drop policy if exists "fotos: subir archivo nuevo" on storage.objects';
  execute $p$create policy "fotos: subir archivo nuevo" on storage.objects
    for insert to anon, authenticated
    with check (
      bucket_id = 'fotos'
      and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$'
    )$p$;
end
$bloque$;
