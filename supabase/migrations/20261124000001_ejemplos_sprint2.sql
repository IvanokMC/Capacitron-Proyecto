-- CAPACITRON · Ejemplos del Sprint 2 para mostrar el sistema (CAP-114, HU-02 y HU-15 a HU-20)
-- Portable (Supabase y PGlite). Requiere todas las migraciones del Sprint 2 (hasta 20261123000001_demo_celulares.sql).
-- En Supabase se ejecuta en el SQL Editor después de 20261123000001_demo_celulares.sql.
--
-- Qué hace: capa.sembrar_ejemplos() completa la demostración con un ejemplo de cada función nueva, sobre las cuentas
-- @capacitron.demo y los eventos que siembra capa.sembrar_demo:
-- · HU-02: tipo, organizador y contacto de cada evento.
-- · HU-19: el punto en el mapa de los eventos presenciales y mixtos (coordenadas aproximadas del lugar).
-- · HU-20: flyer e imagen del lugar.
-- · HU-17: foto de perfil de algunas cuentas (ilustraciones, no fotos de personas).
-- · HU-18: los celulares de ejemplo de CAP-102, también en bases que ya tenían la demo.
-- · HU-16: datos de pago de la organización y tres pagos manuales (dos por verificar y uno aprobado).
-- Todo dice que es de ejemplo: números 900 000 1xx, operaciones «EJEMPLO-…», cuentas de banco de ejemplo y archivos
-- «ejemplo-….png». Las imágenes están en Supabase Storage y en public/ejemplos (modo local, ver almacenamiento/local.ts).
--
-- Reglas:
-- · Idempotente: se puede ejecutar varias veces; solo llena lo que está vacío y no repite pagos.
-- · No toca cuentas ni eventos que no sean de la demostración, ni datos que ya tengan valor.
-- · No es parte de capa.sembrar_demo: las pruebas de cada tarea siguen viendo la demo base. La llaman la app en modo
--   local (migraciones.ts), supabase/reiniciar_demo.sql y esta misma migración al final (para la base de Supabase).
--
-- Teoría de Diseño de Software aplicada:
-- · OCP (diap. 50–63): la siembra existente no se reescribe; se agrega una función nueva que la complementa.
-- · Encapsulación (diap. 20–24): los ejemplos respetan las mismas reglas que los datos reales (checks de rutas,
--   celulares válidos, pagos con su inscripción) porque se insertan en las mismas tablas con sus restricciones.
-- · Mantenibilidad (diap. 137): un solo lugar para todos los ejemplos; las pruebas de los compañeros no cambian.
--
-- Rol: DevOps (George) · Tarea: CAP-114.

create or replace function capa.sembrar_ejemplos() returns jsonb
language plpgsql as $$
declare
  v_admin capa.usuarios;
  v_usuario capa.usuarios;
  v_evento capa.eventos;
  v_ins capa.inscripciones;
  v_pagos int := 0;
  p record;
begin
  select * into v_admin from capa.usuarios where correo = 'admin@capacitron.demo';
  if not found then
    return jsonb_build_object('ok', false, 'mensaje', 'No hay datos de demostración: primero capa.sembrar_demo().');
  end if;

  -- Eventos de ejemplo con fechas futuras (relativas al reloj de la demo), para que el catálogo siempre tenga qué
  -- mostrar aunque los eventos sembrados al inicio ya hayan terminado. Cada uno respeta el plan de su institución.
  for p in select * from (values
      ('Congreso de Ingeniería de Software 2026', 'congreso', 'presencial', 'coordinacion@capacitron.demo', 12, 2, 150, 50.00, 16,
       'Auditorio de Ingeniería, Ciudad Universitaria de Perayoc, Cusco', -13.521780, -71.958500,
       'Escuela Profesional de Ingeniería Informática · UNSAAC', 'congreso', 'perayoc',
       'Ponencias y talleres sobre arquitectura, pruebas automáticas y metodologías ágiles, con casos de proyectos universitarios.'),
      ('Taller de Diseño de Interfaces con Figma', 'taller', 'presencial', 'capacitacion.iac@capacitron.demo', 9, 1, 25, 30.00, 8,
       'Laboratorio 2, Instituto Andino de Capacitación, Av. de la Cultura 1020, Cusco', -13.526950, -71.950750,
       'Instituto Andino de Capacitación', 'figma', 'instituto',
       'Taller práctico para diseñar pantallas accesibles: componentes, estados de error y diseño para celular.'),
      ('Seminario de Ciencia de Datos para la Investigación', 'seminario', 'mixta', 'coordinacion@capacitron.demo', 6, 0, 80, 0.00, 4,
       'Sala de Grados, Facultad de Ingeniería Civil, Ciudad Universitaria de Perayoc', -13.522340, -71.957860,
       'Coordinación Académica · UNSAAC', 'datos', 'perayoc',
       'Introducción al análisis de datos para tesis y proyectos de investigación, con ejemplos en hojas de cálculo y Python.'),
      ('Curso de Python para Docentes', 'curso', 'virtual', 'coordinacion@capacitron.demo', 15, 3, 120, 0.00, 12,
       null, null, null,
       'Coordinación Académica · UNSAAC', 'python', null,
       'Curso virtual de programación básica con Python orientado a docentes que quieren automatizar tareas académicas.')
    ) as x(nombre, tipo, modalidad, organizador, dias, duracion, cupo, costo, horas, lugar, lat, lng, organiza, clave, lugar_img, descripcion)
  loop
    continue when exists (select 1 from capa.eventos where nombre = p.nombre);
    select * into v_usuario from capa.usuarios where correo = p.organizador;
    continue when not found;
    insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, lugar,
                              enlace_virtual, cupo_maximo, costo, porcentaje_minimo, horas_academicas, firmante_nombre,
                              firmante_cargo, estado, publicado_en, tipo, organizador_nombre, contacto, contacto_consentimiento,
                              latitud, longitud, creado_en, actualizado_en)
    values (v_usuario.id, v_usuario.institucion_id, p.nombre, p.descripcion || ' Evento de ejemplo para mostrar CAPACITRON.',
            (date_trunc('day', capa.ahora() at time zone 'America/Lima') + make_interval(days => p.dias, hours => 15)) at time zone 'America/Lima',
            (date_trunc('day', capa.ahora() at time zone 'America/Lima') + make_interval(days => p.dias + p.duracion, hours => 19)) at time zone 'America/Lima',
            p.modalidad, p.lugar,
            case when p.modalidad <> 'presencial' then 'https://meet.google.com/ejemplo-capacitron' end,
            p.cupo, p.costo, 80, p.horas, capa.nombre_completo(v_usuario), 'Coordinación académica',
            'publicado', capa.ahora(), p.tipo, p.organiza, p.organizador, true,
            p.lat, p.lng, capa.ahora(), capa.ahora())
    returning * into v_evento;
    update capa.eventos
       set flyer_url = v_evento.id::text || '/ejemplo-flyer-' || p.clave || '.png',
           flyer_alt = 'Flyer de ejemplo: ' || p.nombre,
           imagen_lugar_url = case when p.lugar_img is not null then v_evento.id::text || '/ejemplo-lugar-' || p.lugar_img || '.png' end,
           imagen_lugar_alt = case when p.lugar_img is not null then 'Imagen de ejemplo del lugar del evento' end
     where id = v_evento.id;
  end loop;

  -- HU-18: inscritos confirmados en el seminario gratuito, unos comparten su celular con el organizador y otros no.
  select * into v_evento from capa.eventos where nombre = 'Seminario de Ciencia de Datos para la Investigación';
  if found then
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, creado_en, confirmado_en)
    select v_evento.id, u.id, 'confirmada', 0, capa.ahora() - interval '1 day', capa.ahora() - interval '1 day'
      from capa.usuarios u
     where u.correo in ('estudiante@capacitron.demo', 'diego.mamani@capacitron.demo', 'luis.ccahuana@capacitron.demo',
                        'valeria.condori@capacitron.demo', 'sofia.chavez@capacitron.demo')
       and not exists (select 1 from capa.inscripciones i where i.evento_id = v_evento.id and i.usuario_id = u.id);
  end if;

  -- HU-02 (CAP-76 a CAP-78): tipo, quién organiza y contacto, con permiso para mostrarlo.
  update capa.eventos e
     set tipo = coalesce(e.tipo, x.tipo),
         organizador_nombre = coalesce(e.organizador_nombre, x.organiza),
         contacto = coalesce(e.contacto, x.contacto),
         contacto_consentimiento = true
    from (values
      ('Conversatorio: Gestión del agua en comunidades andinas', 'seminario', 'Facultad de Ingeniería Civil · UNSAAC', 'coordinacion@capacitron.demo'),
      ('Curso: Desarrollo web con React y Supabase', 'curso', 'Instituto Andino de Capacitación', 'capacitacion.iac@capacitron.demo'),
      ('Seminario: Inteligencia artificial aplicada a la educación', 'seminario', 'Coordinación Académica · UNSAAC', 'coordinacion@capacitron.demo'),
      ('Taller de hojas de cálculo para la gestión académica', 'taller', 'Centro de Estudios Qhapaq', 'cursos.qhapaq@capacitron.demo'),
      ('Taller de Ingeniería de Requisitos con Historias de Usuario', 'taller', 'Escuela Profesional de Ingeniería Informática · UNSAAC', 'coordinacion@capacitron.demo'),
      ('Webinar: Ciberseguridad básica para docentes', 'seminario', 'Coordinación Académica · UNSAAC', 'coordinacion@capacitron.demo'),
      ('Jornada de Metodologías Ágiles', 'congreso', 'Coordinación Académica · UNSAAC', 'coordinacion@capacitron.demo')
    ) as x(nombre, tipo, organiza, contacto)
   where e.nombre = x.nombre and (e.tipo is null or e.organizador_nombre is null or e.contacto is null);

  -- HU-19 (CAP-104): punto aproximado del lugar en los eventos presenciales y mixtos.
  update capa.eventos e set latitud = x.lat, longitud = x.lng
    from (values
      ('Conversatorio: Gestión del agua en comunidades andinas', -13.522340, -71.957860),
      ('Curso: Desarrollo web con React y Supabase', -13.526950, -71.950750),
      ('Seminario: Inteligencia artificial aplicada a la educación', -13.521780, -71.958500),
      ('Taller de hojas de cálculo para la gestión académica', -13.513590, -71.983980),
      ('Taller de Ingeniería de Requisitos con Historias de Usuario', -13.522900, -71.956900)
    ) as x(nombre, lat, lng)
   where e.nombre = x.nombre and e.modalidad <> 'virtual' and e.latitud is null and e.longitud is null;

  -- HU-20 (CAP-109): flyer y, en los presenciales, imagen del lugar. La ruta empieza con el id del evento, como exige
  -- capa.ruta_imagen_evento_valida.
  update capa.eventos e
     set flyer_url = e.id::text || '/ejemplo-flyer-' || x.clave || '.png',
         flyer_alt = 'Flyer de ejemplo: ' || e.nombre
    from (values
      ('Conversatorio: Gestión del agua en comunidades andinas', 'agua'),
      ('Curso: Desarrollo web con React y Supabase', 'react'),
      ('Seminario: Inteligencia artificial aplicada a la educación', 'ia'),
      ('Taller de hojas de cálculo para la gestión académica', 'hojas'),
      ('Taller de Ingeniería de Requisitos con Historias de Usuario', 'requisitos'),
      ('Webinar: Ciberseguridad básica para docentes', 'ciberseguridad')
    ) as x(nombre, clave)
   where e.nombre = x.nombre and e.flyer_url is null;

  update capa.eventos e
     set imagen_lugar_url = e.id::text || '/ejemplo-lugar-' || x.lugar || '.png',
         imagen_lugar_alt = 'Imagen de ejemplo del lugar: ' || x.descripcion
    from (values
      ('Conversatorio: Gestión del agua en comunidades andinas', 'perayoc', 'Ciudad Universitaria de Perayoc'),
      ('Curso: Desarrollo web con React y Supabase', 'instituto', 'laboratorio del Instituto Andino'),
      ('Seminario: Inteligencia artificial aplicada a la educación', 'perayoc', 'Ciudad Universitaria de Perayoc'),
      ('Taller de hojas de cálculo para la gestión académica', 'qhapaq', 'Centro de Estudios Qhapaq'),
      ('Taller de Ingeniería de Requisitos con Historias de Usuario', 'perayoc', 'Ciudad Universitaria de Perayoc')
    ) as x(nombre, lugar, descripcion)
   where e.nombre = x.nombre and e.modalidad <> 'virtual' and e.imagen_lugar_url is null;

  -- HU-17 (CAP-94): foto de perfil (ilustraciones de ejemplo). La ruta empieza con el id de la cuenta (capa.foto_valida).
  update capa.usuarios u set foto_url = u.id::text || '/ejemplo-foto-' || x.n || '.png'
    from (values ('estudiante@capacitron.demo', '1'), ('diego.mamani@capacitron.demo', '2'),
                 ('valeria.condori@capacitron.demo', '3'), ('ponente@capacitron.demo', '4'),
                 ('coordinacion@capacitron.demo', '5')) as x(correo, n)
   where u.correo = x.correo and u.foto_url is null;

  -- HU-18 (CAP-99 y CAP-102): los mismos celulares de ejemplo que la demo nueva, también en bases sembradas antes.
  update capa.usuarios u set celular = x.celular, comparte_celular = x.comparte,
         celular_consentido_en = case when x.comparte then capa.ahora() end
    from (values ('estudiante@capacitron.demo', '900000101', true), ('diego.mamani@capacitron.demo', '900000102', true),
                 ('luis.ccahuana@capacitron.demo', '900000104', true), ('valeria.condori@capacitron.demo', '900000103', false),
                 ('ponente@capacitron.demo', '900000110', false)) as x(correo, celular, comparte)
   where u.correo = x.correo and u.celular is null;

  -- HU-16 (CAP-89): datos de pago de la organización, solo si todavía no se configuraron.
  update capa.config_pagos
     set yape_qr = v_admin.id::text || '/ejemplo-qr-yape.png', yape_titular = 'CAPACITRON · cuenta de ejemplo',
         banco = 'Banco de ejemplo', cuenta = '0011223344556677', cci = '00211223344556677889',
         titular = 'CAPACITRON (ejemplo)', whatsapp = '900000100',
         actualizado_en = capa.ahora(), actualizado_por = v_admin.id
   where id = 1 and yape_qr is null and banco is null and cuenta is null and cci is null and whatsapp is null;

  -- HU-16 (CAP-89 y CAP-90): pagos manuales de ejemplo en un evento de pago futuro con cupo libre.
  for p in select * from (values
      ('estudiante@capacitron.demo', 'yape', 'EJEMPLO-1001', 'por_verificar', 1),
      ('paola.nina@capacitron.demo', 'transferencia', 'EJEMPLO-1002', 'por_verificar', 2),
      ('kevin.layme@capacitron.demo', 'whatsapp', 'EJEMPLO-1003', 'confirmado', 3)
    ) as x(correo, metodo, operacion, estado, n)
  loop
    continue when exists (select 1 from capa.pagos where numero_operacion = p.operacion);
    select * into v_usuario from capa.usuarios where correo = p.correo and estado = 'activa';
    continue when not found;
    select e.* into v_evento from capa.eventos e
     where e.estado = 'publicado' and coalesce(e.costo, 0) > 0 and e.fecha_inicio > capa.ahora()
       and not exists (select 1 from capa.inscripciones i
                        where i.evento_id = e.id and i.usuario_id = v_usuario.id and i.estado in ('confirmada', 'pendiente_pago'))
       and (select count(*) from capa.inscripciones i
             where i.evento_id = e.id and i.estado in ('confirmada', 'pendiente_pago')) < e.cupo_maximo
     order by e.costo desc, e.nombre
     limit 1;
    continue when not found;

    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, reserva_expira_en, creado_en, confirmado_en)
    values (v_evento.id, v_usuario.id, case when p.estado = 'confirmado' then 'confirmada' else 'pendiente_pago' end,
            v_evento.costo, null, capa.ahora() - interval '2 hours',
            case when p.estado = 'confirmado' then capa.ahora() - interval '1 hour' end)
    returning * into v_ins;

    insert into capa.pagos (inscripcion_id, evento_id, usuario_id, metodo, monto, estado, numero_operacion, comprobante_ruta,
                            mensaje, numero_comprobante, referencia_externa, verificado_por, verificado_en, creado_en, actualizado_en)
    values (v_ins.id, v_evento.id, v_usuario.id, p.metodo, v_evento.costo, p.estado, p.operacion,
            v_ins.id::text || '/ejemplo-comprobante-' || p.n || '.png',
            case when p.estado = 'confirmado' then 'Pago verificado por la administración (ejemplo)'
                 else 'Comprobante de ejemplo enviado para verificar' end,
            case when p.estado = 'confirmado' then capa.nuevo_numero_comprobante() end,
            case when p.estado = 'confirmado' then p.operacion end,
            case when p.estado = 'confirmado' then v_admin.id end,
            case when p.estado = 'confirmado' then capa.ahora() - interval '1 hour' end,
            capa.ahora() - interval '2 hours', capa.ahora() - interval '1 hour');
    v_pagos := v_pagos + 1;
  end loop;

  return jsonb_build_object('ok', true, 'pagos_creados', v_pagos);
end $$;

comment on function capa.sembrar_ejemplos() is
  'CAP-114: completa la demostración con un ejemplo de cada función del Sprint 2. Idempotente; solo cuentas y eventos de la demo.';

-- En una base que ya tiene la demo (Supabase), los ejemplos quedan listos al aplicar esta migración.
-- En una base nueva (modo local y pruebas) todavía no hay demo: la función responde ok = false y no cambia nada.
select capa.sembrar_ejemplos();
