-- CAPACITRON · Foto del usuario en la base de datos (CAP-94, HU-17 Perfil con foto)
-- Portable (Supabase y PGlite). Requiere las migraciones de CAP-76 y CAP-77.
-- En Supabase se ejecuta en el SQL Editor después de 20261116000001_validaciones_evento.sql.
--
-- Qué guarda: la RUTA del archivo dentro del bucket de fotos («<id del usuario>/<archivo>.jpg»),
-- no la URL completa. La URL la arma el módulo común de almacenamiento (CAP-97, George), así la
-- base no depende del proveedor (Supabase Storage o el almacenamiento local de la demo).
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación (diap. 20–24): la foto solo cambia por actualizar_perfil, que trabaja sobre el
--   usuario de la sesión y exige que el archivo esté en su propia carpeta (CA-05).
-- · DIP y bajo acoplamiento (diap. 29–35 y 92–106): se guarda una ruta, no una URL de Supabase;
--   el proveedor de archivos se puede cambiar sin migrar los datos.
-- · SRP (diap. 39–49): subir el archivo es tarea del módulo de almacenamiento (CAP-97); esta
--   migración solo guarda y valida la referencia.
-- · Code smells / duplicación (diap. 33): la regla de formato está en capa.foto_valida, que usan
--   la restricción de la columna y actualizar_perfil.
--
-- Rol: Backend y base de datos (Carlos) · Tarea: CAP-94 · Historia: HU-17 (CAP-84).

-- Formato de la ruta: <uuid del usuario>/<nombre>.<jpg|jpeg|png|webp> (CA-01 y CA-02).
create or replace function capa.foto_valida(ruta text) returns boolean
language sql immutable as $$
  select ruta ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z0-9._-]+\.(jpg|jpeg|png|webp)$'
$$;

alter table capa.usuarios
  add column foto_url text check (foto_url is null or capa.foto_valida(foto_url));

comment on column capa.usuarios.foto_url is
  'Ruta de la foto de perfil dentro del bucket de fotos: <id del usuario>/<archivo>. Nula = se muestran las iniciales.';

-- La sesión, el registro y el perfil devuelven la foto (usuario_json lo usan todos).
create or replace function capa.usuario_json(u capa.usuarios) returns jsonb
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
    'foto_url', u.foto_url,
    'institucion', (
      select jsonb_build_object('id', i.id, 'nombre', i.nombre, 'siglas', i.siglas, 'estado', i.estado,
                                'plan', to_jsonb(pl) - 'actualizado_en')
      from capa.instituciones i join capa.planes pl on pl.codigo = i.plan_codigo
      where i.id = u.institucion_id)
  )
$$;

-- Guardar o quitar la foto desde Mi perfil.
create or replace function public.actualizar_perfil(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  v_foto text;
begin
  if capa.txt(p, 'nombres') is null or capa.txt(p, 'apellidos') is null then
    perform capa.err('Nombres y apellidos son obligatorios.', 'CAMPOS',
      jsonb_build_object('campos', array_remove(array[
        case when capa.txt(p, 'nombres') is null then 'nombres' end,
        case when capa.txt(p, 'apellidos') is null then 'apellidos' end], null)));
  end if;
  -- CAP-94: la foto es opcional. Si la clave no viene, no se toca; si viene vacía, se quita (CA-03).
  if p ? 'foto_url' then
    v_foto := capa.txt(p, 'foto_url');
    if v_foto is not null and not capa.foto_valida(v_foto) then
      perform capa.err('Usa una imagen JPG, PNG o WEBP.', 'CAMPOS', '{"campos":["foto_url"]}');
    end if;
    -- CA-05: cada usuario solo puede usar archivos de su propia carpeta.
    if v_foto is not null and split_part(v_foto, '/', 1) <> u.id::text then
      perform capa.err('Solo puedes usar una foto subida a tu propia carpeta.', 'CAMPOS', '{"campos":["foto_url"]}');
    end if;
  end if;
  update capa.usuarios set
    foto_url = case when p ? 'foto_url' then v_foto else foto_url end,
    nombres = capa.txt(p, 'nombres'),
    apellidos = capa.txt(p, 'apellidos'),
    recordatorios_activos = coalesce((p ->> 'recordatorios_activos')::boolean, recordatorios_activos)
  where id = u.id
  returning * into u;
  return jsonb_build_object('ok', true, 'usuario', capa.usuario_json(u));
end $$;

-- La lista de inscritos del organizador muestra la foto de cada asistente.
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
        'foto_url', us.foto_url,
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
