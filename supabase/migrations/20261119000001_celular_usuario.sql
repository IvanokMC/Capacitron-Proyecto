-- CAPACITRON · Celular del usuario con consentimiento (CAP-99, HU-18 Celular del asistente)
-- Portable (Supabase y PGlite). Requiere las migraciones de CAP-76, CAP-77, CAP-94, CAP-78 y CAP-80.
-- En Supabase se ejecuta en el SQL Editor después de 20261118000001_busqueda_catalogo.sql.
--
-- Qué hace:
-- · Columnas `celular` (9 dígitos que empiezan con 9, con restricción check), `comparte_celular`
--   y `celular_consentido_en` (fecha del consentimiento vigente) en capa.usuarios.
-- · registrar_usuario exige el celular en las cuentas nuevas (CA-01); el consentimiento es explícito
--   y falso por defecto (CA-02). Las cuentas existentes quedan sin celular y lo completan en su perfil.
-- · actualizar_perfil cambia el celular y da o retira el consentimiento (CA-03).
-- · evento_gestion devuelve el celular de cada inscrito solo al organizador del evento, solo con
--   consentimiento y solo mientras la inscripción esté activa (CA-02 y CA-04).
-- El catálogo, el detalle del evento y las demás funciones públicas no lo devuelven nunca.
-- El enlace de WhatsApp (CA-05) lo arma la pantalla (CAP-100) con el número que llega aquí.
--
-- Teoría de Diseño de Software aplicada:
-- · Encapsulación y ocultamiento de información (diap. 20–24): el celular solo sale por evento_gestion
--   (dueño del evento + consentimiento) y por usuario_json, que solo responde a la propia sesión.
-- · ISP (diap. 80–91): cada respuesta trae solo lo que su pantalla necesita; la lista de espera y las
--   vistas públicas no reciben el celular.
-- · Code smells / duplicación (diap. 33): el formato está en capa.celular_valido, que usan la
--   restricción de la columna, el registro y el perfil; el mensaje está en capa.mensaje_celular.
-- · Evitar sobreingeniería (diap. 135–139): un texto con check basta; no se crea una tabla de teléfonos.
-- Postgres no permite extender una función sin volver a declararla: registrar_usuario (Sprint 1),
-- usuario_json, actualizar_perfil y evento_gestion (CAP-94) se copian completas con lo nuevo marcado «CAP-99».
--
-- Rol: Backend y base de datos (Carlos) · Tarea: CAP-99 · Historia: HU-18 (CAP-85), criterios CA-01 a CA-04.

-- Quita espacios, guiones y el prefijo +51 que algunas personas escriben; vacío = null.
create or replace function capa.normalizar_celular(t text) returns text
language sql immutable as $$
  select nullif(regexp_replace(regexp_replace(coalesce(t, ''), '[\s-]', '', 'g'), '^\+?51(?=9\d{8}$)', ''), '')
$$;

-- CA-01: 9 dígitos que empiezan con 9 (celulares del Perú).
create or replace function capa.celular_valido(c text) returns boolean
language sql immutable as $$
  select c ~ '^9[0-9]{8}$'
$$;

create or replace function capa.mensaje_celular() returns text
language sql immutable as $$
  select 'El celular debe tener 9 dígitos y empezar con 9.'::text
$$;

alter table capa.usuarios
  add column celular text check (celular is null or capa.celular_valido(celular)),
  add column comparte_celular boolean not null default false,
  add column celular_consentido_en timestamptz,
  add constraint usuarios_comparte_con_celular check (not comparte_celular or celular is not null);

comment on column capa.usuarios.celular is
  'Celular de 9 dígitos (empieza con 9). Dato personal (Ley N.° 29733): solo lo ve el organizador de un evento donde la persona está inscrita y si comparte_celular es verdadero.';
comment on column capa.usuarios.comparte_celular is
  'Consentimiento explícito y revocable para mostrar el celular a los organizadores de sus eventos.';
comment on column capa.usuarios.celular_consentido_en is
  'Cuándo se dio el consentimiento vigente; null si no lo hay.';

-- Registro (Sprint 1) con el celular.
create or replace function public.registrar_usuario(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  v_nombres text := capa.txt(p, 'nombres');
  v_apellidos text := capa.txt(p, 'apellidos');
  v_correo text := lower(capa.txt(p, 'correo'));
  v_pass text := p ->> 'password';
  v_rol text := coalesce(capa.txt(p, 'rol'), 'asistente');
  v_inst uuid := capa.txt(p, 'institucion_id')::uuid;
  -- CAP-99: celular obligatorio en los registros nuevos y consentimiento explícito (falso si no se marca).
  v_celular text := capa.normalizar_celular(p ->> 'celular');
  v_comparte boolean := coalesce((p ->> 'comparte_celular')::boolean, false);
  v_faltan text[] := '{}';
  u capa.usuarios;
  v_token text;
begin
  if v_nombres is null then v_faltan := array_append(v_faltan, 'nombres'); end if;
  if v_apellidos is null then v_faltan := array_append(v_faltan, 'apellidos'); end if;
  if v_correo is null then v_faltan := array_append(v_faltan, 'correo'); end if;
  if coalesce(v_pass, '') = '' then v_faltan := array_append(v_faltan, 'password'); end if;
  if v_rol = 'organizador' and v_inst is null then v_faltan := array_append(v_faltan, 'institucion_id'); end if;
  if v_celular is null then v_faltan := array_append(v_faltan, 'celular'); end if;
  if cardinality(v_faltan) > 0 then
    perform capa.err('Completa los campos obligatorios.', 'CAMPOS', jsonb_build_object('campos', v_faltan));
  end if;
  if v_correo !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    perform capa.err('Ingresa un correo válido.', 'CAMPOS', '{"campos":["correo"]}');
  end if;
  -- CA-01: 9 dígitos que empiezan con 9; si no, se resalta el campo y no se guarda nada.
  if not capa.celular_valido(v_celular) then
    perform capa.err(capa.mensaje_celular(), 'CAMPOS', '{"campos":["celular"]}');
  end if;
  if v_rol not in ('asistente', 'organizador', 'ponente') then
    perform capa.err('Elige un rol válido: asistente, organizador o ponente.', 'CAMPOS', '{"campos":["rol"]}');
  end if;
  if not capa.password_valida(v_pass) then
    perform capa.err('La contraseña debe tener al menos 8 caracteres y combinar letras y números.',
                     'CAMPOS', '{"campos":["password"]}');
  end if;
  if not coalesce((p ->> 'acepta_privacidad')::boolean, false) then
    perform capa.err('Para registrarte debes aceptar la política de privacidad.', 'CAMPOS', '{"campos":["acepta_privacidad"]}');
  end if;
  if v_rol = 'organizador' then
    if not exists (select 1 from capa.instituciones where id = v_inst and estado = 'activa') then
      perform capa.err('La institución elegida no está disponible.', 'CAMPOS', '{"campos":["institucion_id"]}');
    end if;
  else
    v_inst := null;
  end if;
  if exists (select 1 from capa.usuarios where lower(correo) = v_correo) then
    perform capa.err('Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.',
                     'CORREO_EXISTE', '{"campos":["correo"]}');
  end if;

  insert into capa.usuarios (nombres, apellidos, correo, password_hash, rol, institucion_id, estado, acepto_privacidad_en, creado_en,
                             celular, comparte_celular, celular_consentido_en)
  values (v_nombres, v_apellidos, v_correo, extensions.crypt(v_pass, extensions.gen_salt('bf', 10)),
          v_rol, v_inst, 'pendiente', capa.ahora(), capa.ahora(),
          v_celular, v_comparte, case when v_comparte then capa.ahora() end)
  returning * into u;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into capa.tokens_confirmacion (token, usuario_id, expira_en)
  values (v_token, u.id, capa.ahora() + interval '24 hours');

  -- Si ya figuraba como ponente de algún evento, se vincula su cuenta.
  update capa.ponentes set usuario_id = u.id where lower(correo) = v_correo and usuario_id is null;

  perform capa.enviar_correo(u.id, u.correo, 'Confirma tu cuenta en CAPACITRON',
    'Hola ' || u.nombres || E',\n\nGracias por registrarte en CAPACITRON. Para activar tu cuenta, confirma tu correo con el botón de abajo.\n\n'
      || 'El enlace es válido por 24 horas (hasta el ' || capa.fmt_fecha(capa.ahora() + interval '24 hours') || ').'
      || E'\n\nSi no creaste esta cuenta, ignora este mensaje.',
    'confirmacion', null, 'Confirmar mi cuenta', '/confirmar/' || v_token);

  return jsonb_build_object('ok', true, 'correo', u.correo);
exception
  when unique_violation then
    perform capa.err('Ya existe una cuenta con este correo. Inicia sesión o usa otro correo.',
                     'CORREO_EXISTE', '{"campos":["correo"]}');
end $$;

-- Datos de la propia cuenta (sesión, registro y perfil).
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
    -- CAP-99: usuario_json solo responde a la propia sesión (registro, sesión y perfil), por eso aquí sí va.
    'celular', u.celular,
    'comparte_celular', u.comparte_celular,
    'institucion', (
      select jsonb_build_object('id', i.id, 'nombre', i.nombre, 'siglas', i.siglas, 'estado', i.estado,
                                'plan', to_jsonb(pl) - 'actualizado_en')
      from capa.instituciones i join capa.planes pl on pl.codigo = i.plan_codigo
      where i.id = u.institucion_id)
  )
$$;

-- Mi perfil: celular y consentimiento.
create or replace function public.actualizar_perfil(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.usuario_sesion(p);
  v_foto text;
  v_celular text := u.celular;
  v_comparte boolean := u.comparte_celular;
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
  -- CAP-99 (CA-03): cambiar el celular. Una clave ausente no toca nada. Una cuenta antigua puede seguir
  -- sin celular, pero quien ya lo tiene no lo borra: para dejar de compartirlo, retira el consentimiento.
  if p ? 'celular' then
    if capa.normalizar_celular(p ->> 'celular') is not null then
      v_celular := capa.normalizar_celular(p ->> 'celular');
      if not capa.celular_valido(v_celular) then
        perform capa.err(capa.mensaje_celular(), 'CAMPOS', '{"campos":["celular"]}');
      end if;
    elsif u.celular is not null then
      perform capa.err('El celular no se puede quitar. Si no quieres que lo vean, desmarca «Compartir mi celular».',
                       'CAMPOS', '{"campos":["celular"]}');
    end if;
  end if;
  -- CA-03: dar o retirar el consentimiento cuando quiera (Ley N.° 29733: explícito y revocable).
  if p ? 'comparte_celular' then
    v_comparte := coalesce((p ->> 'comparte_celular')::boolean, false);
    if v_comparte and v_celular is null then
      perform capa.err('Para compartir tu celular, primero escríbelo.', 'CAMPOS', '{"campos":["celular"]}');
    end if;
  end if;
  update capa.usuarios set
    celular = v_celular,
    comparte_celular = v_comparte,
    -- Fecha del consentimiento vigente: se fija al darlo y se borra al retirarlo.
    celular_consentido_en = case when not v_comparte then null
                                 when comparte_celular then celular_consentido_en
                                 else capa.ahora() end,
    foto_url = case when p ? 'foto_url' then v_foto else foto_url end,
    nombres = capa.txt(p, 'nombres'),
    apellidos = capa.txt(p, 'apellidos'),
    recordatorios_activos = coalesce((p ->> 'recordatorios_activos')::boolean, recordatorios_activos)
  where id = u.id
  returning * into u;
  return jsonb_build_object('ok', true, 'usuario', capa.usuario_json(u));
end $$;

-- Lista de inscritos del organizador con el celular de quien lo comparte.
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
        -- CAP-99 (CA-02 y CA-04): el celular solo sale aquí, para el dueño del evento (evento_del_organizador),
        -- si el inscrito dio su consentimiento y su inscripción sigue activa. Si no, llega null.
        'celular', case when us.comparte_celular and i.estado in ('confirmada', 'pendiente_pago') then us.celular end,
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
