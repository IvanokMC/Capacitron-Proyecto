-- CAPACITRON · Endurecimiento y operación
-- Portable (Supabase y PGlite). Para una base que ya tenía las migraciones
-- 0001 a 0005, basta con ejecutar este archivo en el SQL Editor de Supabase.
--
--   1. La pasarela simulada solo responde en modo demostración.
--   2. Interruptor del modo demostración y diagnóstico para la administración.
--   3. Registro de la última ejecución de las tareas programadas (pg_cron).

-- ---------------------------------------------------------------------------
-- 1. Pasarela simulada protegida
-- ---------------------------------------------------------------------------

-- La implementación pasa al esquema privado: deja de ser parte de la API.
alter function public.respuesta_pasarela(jsonb) set schema capa;
alter function capa.respuesta_pasarela(jsonb) rename to pasarela_simulada;

-- En producción la confirmación de un pago debe llegar como webhook firmado de
-- la plataforma de pago; el simulador del navegador solo existe en la demo.
create function public.respuesta_pasarela(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
begin
  if not (select modo_demo from capa.config where id = 1) then
    perform capa.err('La pasarela simulada está desactivada. Los pagos se confirman cuando la plataforma de pago avisa al sistema.',
                     'PASARELA_DESACTIVADA');
  end if;
  return capa.pasarela_simulada(p);
end $$;

-- ---------------------------------------------------------------------------
-- 2 y 3. Modo demostración, diagnóstico y última ejecución del cron
-- ---------------------------------------------------------------------------

alter table capa.config add column if not exists ultima_tarea_cron_en timestamptz;

create or replace function public.procesar_tareas(p jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
begin
  if capa.txt(p, 'origen') = 'cron' then
    update capa.config set ultima_tarea_cron_en = now() where id = 1;
  end if;
  return capa.procesar_tareas_internas();
end $$;

create function public.admin_modo_demo(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  v_activo boolean := (p ->> 'activo')::boolean;
begin
  if v_activo is null then
    perform capa.err('Indica si el modo demostración queda activo o no.');
  end if;
  -- Al apagarlo, el reloj vuelve a la hora real.
  update capa.config set modo_demo = v_activo,
    reloj_offset = case when v_activo then reloj_offset else interval '0' end,
    actualizado_en = now()
  where id = 1;
  perform capa.auditar(u, case when v_activo then 'Activó el modo demostración' else 'Desactivó el modo demostración' end,
                       'sistema', 'modo_demo',
                       case when v_activo then 'buzón público, reloj y pasarela simulada habilitados'
                            else 'buzón público, reloj y pasarela simulada deshabilitados' end);
  return public.estado_sistema('{}');
end $$;

create function public.admin_diagnostico(p jsonb) returns jsonb
language plpgsql security definer set search_path = capa, extensions, public as $$
declare
  u capa.usuarios := capa.exigir_admin(p);
  v_cron boolean := false;
  v_cron_instalado boolean := to_regclass('cron.job') is not null;
begin
  if v_cron_instalado then
    -- Consulta dinámica: el esquema cron no existe en el modo local.
    execute $q$select exists (select 1 from cron.job where jobname = 'capacitron-tareas' and active)$q$ into v_cron;
  end if;
  return jsonb_build_object(
    'modo_demo', (select modo_demo from capa.config where id = 1),
    'cron_instalado', v_cron_instalado,
    'cron_activo', v_cron,
    'ultima_tarea_cron_en', (select ultima_tarea_cron_en from capa.config where id = 1),
    'realtime_activo', exists (select 1 from pg_publication_tables
                               where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'actividad_eventos'),
    'pasarela_simulada', (select modo_demo from capa.config where id = 1),
    'correos_pendientes', (select count(*) from capa.correos where enviado_en > now() - interval '1 day'),
    'ahora', capa.ahora());
end $$;

-- ---------------------------------------------------------------------------
-- pg_cron marca sus ejecuciones para que el diagnóstico pueda comprobarlas.
-- (cron.schedule con un nombre existente actualiza la tarea.)
-- ---------------------------------------------------------------------------

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.schedule('capacitron-tareas', '* * * * *', $c$select public.procesar_tareas('{"origen":"cron"}'::jsonb)$c$);
  end if;
end $$;
