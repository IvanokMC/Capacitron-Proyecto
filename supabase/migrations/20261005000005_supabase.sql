-- CAPACITRON · Configuración exclusiva de Supabase
-- (El modo local con PGlite no ejecuta este archivo.)

-- 1) Ningún rol de la API toca las tablas directamente: todo pasa por las
--    funciones RPC SECURITY DEFINER del esquema public, que validan sesión y rol.
revoke all on schema capa from anon, authenticated;
revoke all on all tables in schema capa from anon, authenticated;
revoke all on all functions in schema capa from anon, authenticated, public;

-- Las funciones públicas son la API.
grant execute on all functions in schema public to anon, authenticated;

-- 2) Señal de tiempo real para el panel de reportes (HU-10 CA-02).
--    La tabla solo contiene evento_id + contador; no expone datos personales.
alter table public.actividad_eventos enable row level security;
create policy actividad_lectura on public.actividad_eventos for select to anon, authenticated using (true);
revoke insert, update, delete on public.actividad_eventos from anon, authenticated;
grant select on public.actividad_eventos to anon, authenticated;
alter publication supabase_realtime add table public.actividad_eventos;

-- 3) Tareas programadas cada minuto: vencimientos de pago y de lista de espera,
--    recordatorios, emisión de certificados y envío/cierre de encuestas.
create extension if not exists pg_cron;
select cron.schedule('capacitron-tareas', '* * * * *', $$select public.procesar_tareas('{}'::jsonb)$$);

-- 4) Datos de demostración (quitar esta línea para una instalación limpia).
select capa.sembrar_demo();
