-- CAPACITRON · Datos de demostración
-- Personas, instituciones y eventos ficticios para la demo de clase.
-- Las fechas se calculan respecto de "hoy", de modo que siempre hay un evento
-- terminado (con certificados y encuesta), uno en curso (para escanear QR),
-- uno lleno con lista de espera, uno de pago y uno a punto de recordar.
-- Contraseña de todas las cuentas: Capacitron2026

create function capa.lima(base timestamp, dias int, hhmm text) returns timestamptz
language sql immutable as $$
  select ((base + make_interval(days => dias) + hhmm::time) at time zone 'America/Lima')
$$;

create function capa.sembrar_demo() returns jsonb
language plpgsql as $$
declare
  hoy timestamp := date_trunc('day', capa.ahora() at time zone 'America/Lima');
  ahora_h timestamptz := date_trunc('hour', capa.ahora());
  hash text := extensions.crypt('Capacitron2026', extensions.gen_salt('bf', 10));
  i_unsaac uuid; i_iac uuid; i_ceq uuid;
  u_admin uuid; u_carmen uuid; u_jorge uuid; u_elena uuid; u_raul uuid;
  a uuid[] := '{}';
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; e6 uuid; e7 uuid;
  pn1 uuid; pn2 uuid; pn3 uuid; pn4 uuid; pn5 uuid; pn6 uuid;
  s uuid;
  ins uuid;
  k int;
  metodos text[] := array['yape', 'plin', 'paypal'];
  nombres text[][] := array[
    ['Ana Lucía', 'Huamán Cusi', 'estudiante'],
    ['Diego', 'Mamani Quispe', 'diego.mamani'],
    ['Valeria', 'Condori Ttito', 'valeria.condori'],
    ['Luis Alberto', 'Ccahuana Rojas', 'luis.ccahuana'],
    ['Sofía', 'Chávez Pumacahua', 'sofia.chavez'],
    ['Miguel Ángel', 'Sutta Huillca', 'miguel.sutta'],
    ['Camila', 'Torres Yupanqui', 'camila.torres'],
    ['Renzo', 'Apaza Choque', 'renzo.apaza'],
    ['Daniela', 'Huarca Ramos', 'daniela.huarca'],
    ['Kevin', 'Layme Cruz', 'kevin.layme'],
    ['Fiorella', 'Puma Alccahuaman', 'fiorella.puma'],
    ['Jhon', 'Ccopa Mendoza', 'jhon.ccopa'],
    ['Mariela', 'Quispe Sayritupac', 'mariela.quispe'],
    ['Bruno', 'Vargas Llerena', 'bruno.vargas'],
    ['Paola', 'Nina Coaquira', 'paola.nina'],
    ['Héctor', 'Laura Gutiérrez', 'hector.laura']];
  e2_inicio timestamptz := date_trunc('hour', capa.ahora()) - interval '1 hour';
  e5_inicio timestamptz := date_trunc('hour', capa.ahora()) + interval '26 hours';
begin
  if exists (select 1 from capa.usuarios) then
    return jsonb_build_object('ok', false, 'mensaje', 'La base ya tiene datos; no se sembró la demo.');
  end if;

  -- Instituciones (una por plan)
  insert into capa.instituciones (nombre, siglas, plan_codigo)
  values ('Universidad Nacional de San Antonio Abad del Cusco', 'UNSAAC', 'enterprise') returning id into i_unsaac;
  insert into capa.instituciones (nombre, siglas, plan_codigo)
  values ('Instituto Andino de Capacitación', 'IAC', 'pro') returning id into i_iac;
  insert into capa.instituciones (nombre, siglas, plan_codigo)
  values ('Centro de Estudios Qhapaq', 'CEQ', 'basico') returning id into i_ceq;

  -- Cuentas de cada rol
  insert into capa.usuarios (nombres, apellidos, correo, password_hash, rol, estado, acepto_privacidad_en, confirmado_en)
  values ('Lucía', 'Mamani Torres', 'admin@capacitron.demo', hash, 'admin', 'activa', capa.ahora(), capa.ahora())
  returning id into u_admin;
  insert into capa.usuarios (nombres, apellidos, correo, password_hash, rol, institucion_id, estado, acepto_privacidad_en, confirmado_en)
  values ('Carmen', 'Valdivia Ríos', 'coordinacion@capacitron.demo', hash, 'organizador', i_unsaac, 'activa', capa.ahora(), capa.ahora())
  returning id into u_carmen;
  insert into capa.usuarios (nombres, apellidos, correo, password_hash, rol, institucion_id, estado, acepto_privacidad_en, confirmado_en)
  values ('Jorge', 'Paredes Luna', 'capacitacion.iac@capacitron.demo', hash, 'organizador', i_iac, 'activa', capa.ahora(), capa.ahora())
  returning id into u_jorge;
  insert into capa.usuarios (nombres, apellidos, correo, password_hash, rol, institucion_id, estado, acepto_privacidad_en, confirmado_en)
  values ('Elena', 'Ccori Apaza', 'cursos.qhapaq@capacitron.demo', hash, 'organizador', i_ceq, 'activa', capa.ahora(), capa.ahora())
  returning id into u_elena;
  insert into capa.usuarios (nombres, apellidos, correo, password_hash, rol, estado, acepto_privacidad_en, confirmado_en)
  values ('Raúl', 'Quispe Condori', 'ponente@capacitron.demo', hash, 'ponente', 'activa', capa.ahora(), capa.ahora())
  returning id into u_raul;

  for k in 1 .. array_length(nombres, 1) loop
    insert into capa.usuarios (nombres, apellidos, correo, password_hash, rol, estado, acepto_privacidad_en, confirmado_en)
    values (nombres[k][1], nombres[k][2], nombres[k][3] || '@capacitron.demo', hash, 'asistente', 'activa', capa.ahora(), capa.ahora())
    returning id into s;
    a := a || s;
  end loop;

  -- E1 · Terminó hace 3 días, dos jornadas, de pago: certificados y encuesta
  insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, lugar,
                            cupo_maximo, costo, porcentaje_minimo, horas_academicas, firmante_nombre, firmante_cargo,
                            estado, publicado_en)
  values (u_carmen, i_unsaac, 'Taller de Ingeniería de Requisitos con Historias de Usuario',
          'Taller práctico de dos jornadas para elicitar requerimientos, redactar historias de usuario con criterios de aceptación verificables y priorizar un Product Backlog con MoSCoW.',
          capa.lima(hoy, -4, '09:00'), capa.lima(hoy, -3, '13:00'), 'presencial',
          'Aula 301, Pabellón de Ingeniería Informática, Ciudad Universitaria de Perayoc',
          40, 30, 80, 8, 'Carmen Valdivia Ríos', 'Coordinadora académica', 'publicado', capa.ahora() - interval '40 days')
  returning id into e1;

  -- E2 · En curso ahora mismo (para registrar asistencia con QR)
  insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, lugar,
                            enlace_virtual, enlace_plataforma, cupo_maximo, costo, porcentaje_minimo, horas_academicas,
                            firmante_nombre, firmante_cargo, estado, publicado_en)
  values (u_carmen, i_unsaac, 'Seminario: Inteligencia artificial aplicada a la educación',
          'Experiencias de docentes que integran asistentes de IA en la evaluación formativa, la retroalimentación y el diseño de actividades. Modalidad mixta: auditorio y transmisión en vivo.',
          e2_inicio, e2_inicio + interval '6 hours', 'mixta',
          'Auditorio de Ingeniería, Ciudad Universitaria de Perayoc',
          'https://us02web.zoom.us/j/84512037766', 'zoom', 60, 0, 80, 6,
          'Carmen Valdivia Ríos', 'Coordinadora académica', 'publicado', capa.ahora() - interval '15 days')
  returning id into e2;

  -- E3 · Curso de pago del instituto (plan Pro), en 5 días
  insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, lugar,
                            cupo_maximo, costo, porcentaje_minimo, horas_academicas, firmante_nombre, firmante_cargo,
                            estado, publicado_en)
  values (u_jorge, i_iac, 'Curso: Desarrollo web con React y Supabase',
          'Tres jornadas para construir una aplicación web completa: componentes con React, base de datos y autenticación con Supabase, y despliegue en la nube.',
          capa.lima(hoy, 5, '15:00'), capa.lima(hoy, 7, '19:00'), 'presencial',
          'Laboratorio 2, Instituto Andino de Capacitación, Av. de la Cultura 1020, Cusco',
          30, 80, 80, 12, 'Jorge Paredes Luna', 'Jefe de capacitación', 'publicado', capa.ahora() - interval '10 days')
  returning id into e3;

  -- E4 · Lleno, con lista de espera, en 2 días
  insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, lugar,
                            cupo_maximo, costo, porcentaje_minimo, horas_academicas, firmante_nombre, firmante_cargo,
                            estado, publicado_en)
  values (u_carmen, i_unsaac, 'Conversatorio: Gestión del agua en comunidades andinas',
          'Diálogo entre investigadores y dirigentes comunales sobre siembra y cosecha de agua, conflictos por el recurso y tecnologías apropiadas. Aforo reducido para favorecer la conversación.',
          capa.lima(hoy, 2, '17:00'), capa.lima(hoy, 2, '20:00'), 'presencial',
          'Sala de Grados, Facultad de Ingeniería Civil, Ciudad Universitaria de Perayoc',
          12, 20, 80, 3, 'Carmen Valdivia Ríos', 'Coordinadora académica', 'publicado', capa.ahora() - interval '8 days')
  returning id into e4;

  -- E5 · Virtual, empieza en 26 horas (adelanta el reloj 2 h para ver el recordatorio)
  insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad,
                            enlace_virtual, enlace_plataforma, cupo_maximo, costo, porcentaje_minimo, horas_academicas,
                            firmante_nombre, firmante_cargo, estado, publicado_en)
  values (u_carmen, i_unsaac, 'Webinar: Ciberseguridad básica para docentes',
          'Buenas prácticas para proteger cuentas institucionales, reconocer correos de suplantación y cuidar los datos de los estudiantes en plataformas educativas.',
          e5_inicio, e5_inicio + interval '2 hours', 'virtual',
          'https://meet.google.com/kfu-tbqz-wme', 'meet', 200, 0, 80, 2,
          'Carmen Valdivia Ríos', 'Coordinadora académica', 'publicado', capa.ahora() - interval '5 days')
  returning id into e5;

  -- E6 · Borrador (no visible en el catálogo)
  insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, lugar,
                            cupo_maximo, costo, porcentaje_minimo, horas_academicas, firmante_nombre, firmante_cargo, estado)
  values (u_carmen, i_unsaac, 'Jornada de Metodologías Ágiles',
          'Borrador: charlas sobre Scrum, Kanban y métricas de flujo para equipos universitarios.',
          capa.lima(hoy, 30, '09:00'), capa.lima(hoy, 30, '17:00'), 'presencial', 'Por confirmar',
          80, 0, 80, 8, 'Carmen Valdivia Ríos', 'Coordinadora académica', 'borrador')
  returning id into e6;

  -- E7 · Centro con plan Básico (solo eventos presenciales y gratuitos)
  insert into capa.eventos (organizador_id, institucion_id, nombre, descripcion, fecha_inicio, fecha_fin, modalidad, lugar,
                            cupo_maximo, costo, porcentaje_minimo, horas_academicas, firmante_nombre, firmante_cargo,
                            estado, publicado_en)
  values (u_elena, i_ceq, 'Taller de hojas de cálculo para la gestión académica',
          'Registro de notas, tablas dinámicas y gráficos para docentes y personal administrativo.',
          capa.lima(hoy, 10, '16:00'), capa.lima(hoy, 10, '19:00'), 'presencial',
          'Centro de Estudios Qhapaq, Calle Saphy 645, Cusco',
          25, 0, 80, 3, 'Elena Ccori Apaza', 'Directora académica', 'publicado', capa.ahora() - interval '3 days')
  returning id into e7;

  -- Ponentes y programa
  insert into capa.ponentes (evento_id, nombre, correo, biografia, consentimiento, usuario_id, orden)
  values (e1, 'Raúl Quispe Condori', 'ponente@capacitron.demo',
          'Docente de Ingeniería de Software. Acompaña a equipos estudiantiles en la elicitación de requerimientos con clientes reales.',
          true, u_raul, 1) returning id into pn1;
  insert into capa.ponentes (evento_id, nombre, correo, biografia, consentimiento, orden)
  values (e1, 'Patricia Gamarra Salas', null,
          'Product Owner en proyectos de software educativo. Facilita talleres de historias de usuario y priorización.',
          true, 2) returning id into pn2;
  insert into capa.sesiones_programa (evento_id, titulo, descripcion, inicio, fin)
  values (e1, 'Del problema a la visión del producto', 'Visión, interesados y Lean Canvas.',
          capa.lima(hoy, -4, '09:00'), capa.lima(hoy, -4, '13:00')) returning id into s;
  insert into capa.sesion_ponentes values (s, pn1);
  insert into capa.sesiones_programa (evento_id, titulo, descripcion, inicio, fin)
  values (e1, 'Historias de usuario y criterios de aceptación', 'Formato «Dado que… cuando… entonces…» y backlog MoSCoW.',
          capa.lima(hoy, -3, '09:00'), capa.lima(hoy, -3, '13:00')) returning id into s;
  insert into capa.sesion_ponentes values (s, pn2);

  insert into capa.ponentes (evento_id, nombre, correo, biografia, consentimiento, usuario_id, orden)
  values (e2, 'Raúl Quispe Condori', 'ponente@capacitron.demo',
          'Docente de Ingeniería de Software. Investiga el uso de asistentes de IA para retroalimentar trabajos de programación.',
          true, u_raul, 1) returning id into pn3;
  insert into capa.ponentes (evento_id, nombre, biografia, consentimiento, orden)
  values (e2, 'Milagros Ugarte Paz',
          'Especialista en evaluación educativa. Diseña rúbricas y actividades con apoyo de herramientas de IA.',
          true, 2) returning id into pn4;
  insert into capa.sesiones_programa (evento_id, titulo, descripcion, inicio, fin)
  values (e2, 'IA para la retroalimentación formativa', 'Casos en cursos de programación.',
          e2_inicio, e2_inicio + interval '2 hours') returning id into s;
  insert into capa.sesion_ponentes values (s, pn3);
  insert into capa.sesiones_programa (evento_id, titulo, descripcion, inicio, fin)
  values (e2, 'Rúbricas y evaluación con apoyo de IA', 'Taller con ejemplos de rúbricas.',
          e2_inicio + interval '2 hours 30 minutes', e2_inicio + interval '4 hours 30 minutes') returning id into s;
  insert into capa.sesion_ponentes values (s, pn4);
  insert into capa.sesiones_programa (evento_id, titulo, descripcion, inicio, fin)
  values (e2, 'Mesa redonda y preguntas', '',
          e2_inicio + interval '4 hours 45 minutes', e2_inicio + interval '6 hours') returning id into s;
  insert into capa.sesion_ponentes values (s, pn3), (s, pn4);

  insert into capa.ponentes (evento_id, nombre, biografia, consentimiento, orden)
  values (e3, 'Andrés Salas Ferro',
          'Desarrollador full stack. Enseña React y bases de datos en programas de formación técnica.',
          true, 1) returning id into pn5;
  for k in 0 .. 2 loop
    insert into capa.sesiones_programa (evento_id, titulo, descripcion, inicio, fin)
    values (e3, (array['Componentes y estado en React', 'Base de datos y autenticación con Supabase', 'Despliegue y buenas prácticas'])[k + 1],
            '', capa.lima(hoy, 5 + k, '15:00'), capa.lima(hoy, 5 + k, '19:00')) returning id into s;
    insert into capa.sesion_ponentes values (s, pn5);
  end loop;

  insert into capa.ponentes (evento_id, nombre, correo, biografia, consentimiento, usuario_id, orden)
  values (e5, 'Raúl Quispe Condori', 'ponente@capacitron.demo',
          'Docente de Ingeniería de Software y responsable de seguridad de la información en proyectos académicos.',
          true, u_raul, 1) returning id into pn6;
  insert into capa.sesiones_programa (evento_id, titulo, descripcion, inicio, fin)
  values (e5, 'Cuentas seguras y correos de suplantación', '', e5_inicio, e5_inicio + interval '2 hours') returning id into s;
  insert into capa.sesion_ponentes values (s, pn6);

  -- E1: 12 inscritos que pagaron; asistencia de dos jornadas
  for k in 1 .. 12 loop
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, creado_en, confirmado_en)
    values (e1, a[k], 'confirmada', 30, capa.lima(hoy, -20 + k, '10:00'), capa.lima(hoy, -20 + k, '10:05'))
    returning id into ins;
    insert into capa.pagos (inscripcion_id, evento_id, usuario_id, metodo, monto, estado, referencia_externa,
                            numero_comprobante, mensaje, creado_en, actualizado_en)
    values (ins, e1, a[k], metodos[(k % 3) + 1], 30, 'confirmado',
            upper(metodos[(k % 3) + 1]) || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
            'CP-' || to_char(capa.ahora() at time zone 'America/Lima', 'YYYY') || '-' || lpad(nextval('capa.comprobante_seq')::text, 6, '0'),
            'Pago aprobado', capa.lima(hoy, -20 + k, '10:05'), capa.lima(hoy, -20 + k, '10:05'));
    if k <= 11 then
      insert into capa.asistencias (inscripcion_id, evento_id, jornada, registrado_en, registrado_por)
      values (ins, e1, (hoy - interval '4 days')::date, capa.lima(hoy, -4, '08:50') + make_interval(mins => k), u_carmen);
    end if;
    if k <= 8 or k = 10 then
      insert into capa.asistencias (inscripcion_id, evento_id, jornada, registrado_en, registrado_por)
      values (ins, e1, (hoy - interval '3 days')::date, capa.lima(hoy, -3, '08:52') + make_interval(mins => k), u_carmen);
    end if;
  end loop;

  -- E2: 14 inscritos; 6 ya registraron su ingreso hoy
  for k in 1 .. 14 loop
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, creado_en, confirmado_en)
    values (e2, a[k], 'confirmada', 0, capa.ahora() - make_interval(days => 14 - k), capa.ahora() - make_interval(days => 14 - k))
    returning id into ins;
    if k between 2 and 7 then
      insert into capa.asistencias (inscripcion_id, evento_id, jornada, registrado_en, registrado_por)
      values (ins, e2, (capa.ahora() at time zone 'America/Lima')::date,
              least(capa.ahora(), e2_inicio + make_interval(mins => k * 4)), u_carmen);
    end if;
  end loop;

  -- E3: cuatro pagos confirmados y una reserva con pago pendiente
  for k in 3 .. 9 by 2 loop
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, creado_en, confirmado_en)
    values (e3, a[k], 'confirmada', 80, capa.ahora() - make_interval(days => k), capa.ahora() - make_interval(days => k))
    returning id into ins;
    insert into capa.pagos (inscripcion_id, evento_id, usuario_id, metodo, monto, estado, referencia_externa,
                            numero_comprobante, mensaje, creado_en, actualizado_en)
    values (ins, e3, a[k], metodos[(k % 3) + 1], 80, 'confirmado',
            upper(metodos[(k % 3) + 1]) || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
            'CP-' || to_char(capa.ahora() at time zone 'America/Lima', 'YYYY') || '-' || lpad(nextval('capa.comprobante_seq')::text, 6, '0'),
            'Pago aprobado', capa.ahora() - make_interval(days => k), capa.ahora() - make_interval(days => k));
  end loop;
  insert into capa.inscripciones (evento_id, usuario_id, estado, monto, reserva_expira_en, creado_en)
  values (e3, a[11], 'pendiente_pago', 80, capa.ahora() + interval '20 minutes', capa.ahora() - interval '10 minutes');

  -- E4: lleno (12 de 12) y dos personas en lista de espera
  for k in 2 .. 13 loop
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, creado_en, confirmado_en)
    values (e4, a[k], 'confirmada', 20, capa.ahora() - make_interval(hours => 100 - k), capa.ahora() - make_interval(hours => 100 - k))
    returning id into ins;
    insert into capa.pagos (inscripcion_id, evento_id, usuario_id, metodo, monto, estado, referencia_externa,
                            numero_comprobante, mensaje, creado_en, actualizado_en)
    values (ins, e4, a[k], metodos[(k % 3) + 1], 20, 'confirmado',
            upper(metodos[(k % 3) + 1]) || '-' || upper(encode(extensions.gen_random_bytes(5), 'hex')),
            'CP-' || to_char(capa.ahora() at time zone 'America/Lima', 'YYYY') || '-' || lpad(nextval('capa.comprobante_seq')::text, 6, '0'),
            'Pago aprobado', capa.ahora() - make_interval(hours => 100 - k), capa.ahora() - make_interval(hours => 100 - k));
  end loop;
  insert into capa.lista_espera (evento_id, usuario_id, solicitado_en)
  values (e4, a[14], capa.ahora() - interval '30 hours'), (e4, a[15], capa.ahora() - interval '20 hours');

  -- E5: la estudiante principal y tres personas más
  foreach k in array array[1, 2, 4, 6] loop
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, creado_en, confirmado_en)
    values (e5, a[k], 'confirmada', 0, capa.ahora() - interval '3 days', capa.ahora() - interval '3 days');
  end loop;

  -- E7
  foreach k in array array[10, 12] loop
    insert into capa.inscripciones (evento_id, usuario_id, estado, monto, creado_en, confirmado_en)
    values (e7, a[k], 'confirmada', 0, capa.ahora() - interval '1 day', capa.ahora() - interval '1 day');
  end loop;

  -- Correos de bienvenida de la estudiante principal
  perform capa.enviar_correo(a[1], 'estudiante@capacitron.demo', 'Inscripción confirmada: Seminario: Inteligencia artificial aplicada a la educación',
    E'Hola Ana Lucía,\n\nTu inscripción quedó confirmada. Tu código QR de ingreso está en «Mis inscripciones».',
    'inscripcion', e2, 'Ver mi inscripción', '/mis-inscripciones');
  perform capa.enviar_correo(a[1], 'estudiante@capacitron.demo', 'Inscripción confirmada: Webinar: Ciberseguridad básica para docentes',
    E'Hola Ana Lucía,\n\nTu inscripción quedó confirmada. Recibirás recordatorios 24 horas y 1 hora antes, con el enlace de la sala.',
    'inscripcion', e5, 'Ver mi inscripción', '/mis-inscripciones');

  -- Emite certificados y envía la encuesta del evento terminado
  perform capa.procesar_tareas_internas();

  -- Fechas coherentes: la emisión y la encuesta ocurrieron al cierre del evento.
  update capa.certificados set emitido_en = capa.lima(hoy, -3, '13:10') where evento_id = e1;
  update capa.eventos set certificados_emitidos_en = capa.lima(hoy, -3, '13:10') where id = e1;
  update capa.encuestas set enviada_en = capa.lima(hoy, -3, '13:10'), cierra_en = capa.lima(hoy, 4, '13:10')
    where evento_id = e1;
  update capa.correos set enviado_en = capa.lima(hoy, -3, '13:10') where evento_id = e1 and tipo in ('certificado', 'encuesta');

  -- Un certificado revocado para demostrar la verificación «inválido»
  update capa.certificados
    set estado = 'revocado', revocado_en = capa.lima(hoy, -2, '10:30'), revocado_por = u_carmen,
        motivo_revocacion = 'Se detectó un registro de asistencia duplicado: la segunda jornada no se cumplió.'
  where inscripcion_id = (select id from capa.inscripciones where evento_id = e1 and usuario_id = a[8]);
  insert into capa.auditoria (actor_id, actor_nombre, accion, entidad, entidad_id, detalle, creado_en)
  select u_carmen, 'Carmen Valdivia Ríos', 'Revocó certificado', 'certificado', c.codigo,
         c.titular_nombre || ' · ' || 'Taller de Ingeniería de Requisitos con Historias de Usuario'
           || ' · motivo: ' || c.motivo_revocacion, capa.lima(hoy, -2, '10:30')
  from capa.certificados c where c.estado = 'revocado';

  -- Respuestas de la encuesta (modo anónimo)
  insert into capa.encuesta_respuestas (evento_id, usuario_id, puntajes, comentario, creado_en) values
    (e1, a[2], '[5,5,4,4,5]', 'Muy práctico; los ejemplos con criterios de aceptación ayudaron mucho.', capa.ahora() - interval '3 hours'),
    (e1, a[3], '[4,5,5,3,4]', 'La segunda jornada empezó tarde.', capa.ahora() - interval '2 hours'),
    (e1, a[4], '[5,4,5,4,5]', null, capa.ahora() - interval '2 hours'),
    (e1, a[5], '[4,4,4,4,4]', 'Me hubiera gustado más tiempo para el backlog.', capa.ahora() - interval '90 minutes'),
    (e1, a[6], '[3,4,4,2,3]', 'El aula era pequeña para el número de asistentes.', capa.ahora() - interval '1 hour'),
    (e1, a[7], '[5,5,5,5,5]', null, capa.ahora() - interval '30 minutes');

  return jsonb_build_object('ok', true, 'usuarios', (select count(*) from capa.usuarios),
                            'eventos', (select count(*) from capa.eventos));
end $$;
