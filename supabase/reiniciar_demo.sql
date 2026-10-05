-- CAPACITRON · Reiniciar los datos de demostración
-- Ejecutar en el SQL Editor de Supabase. Borra TODOS los datos (usuarios,
-- eventos, inscripciones, pagos, certificados, correos, historial) y vuelve a
-- sembrar la demo con fechas relativas a hoy. Conserva los planes y la configuración.
-- TRUNCATE no dispara el trigger que protege el historial fila por fila, y CASCADE
-- vacía también las tablas que dependen de las listadas.

begin;

truncate table
  capa.encuesta_respuestas, capa.encuestas, capa.recordatorios_enviados, capa.correos,
  capa.verificaciones, capa.bloqueos_verificacion, capa.certificados, capa.asistencias,
  capa.pagos, capa.lista_espera, capa.inscripciones, capa.sesion_ponentes, capa.sesiones_programa,
  capa.ponentes, capa.eventos, capa.sesiones, capa.tokens_confirmacion,
  capa.usuarios, capa.instituciones, capa.auditoria, public.actividad_eventos
restart identity cascade;

update capa.config set reloj_offset = interval '0', actualizado_en = now() where id = 1;
alter sequence capa.comprobante_seq restart with 1001;

select capa.sembrar_demo();

commit;
