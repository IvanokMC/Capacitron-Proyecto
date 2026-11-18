-- CAPACITRON · Celulares en los datos de demostración (CAP-102, HU-18 Celular del asistente)
-- Portable (Supabase y PGlite). Requiere 20261119000001_celular_usuario.sql (CAP-99).
--
-- Para que la HU-18 se pueda mostrar en la demo, algunas cuentas de ejemplo tienen celular, unas con permiso para
-- compartirlo con el organizador y otras sin él. Los números son DE EJEMPLO (rango 900 000 1xx), no de personas reales.
--
-- Cómo: la siembra del Sprint 1 (capa.sembrar_demo) queda como capa.sembrar_demo_base y la nueva capa.sembrar_demo la
-- llama y después agrega los celulares. Así funcionan igual el modo local, las pruebas y reiniciar_demo.sql en Supabase,
-- que siguen llamando a capa.sembrar_demo().
--
-- Teoría de Diseño de Software aplicada:
-- · OCP (diap. 50–63): la siembra original no se reescribe; se extiende envolviéndola.
-- · Encapsulación (diap. 20–24): los datos de ejemplo respetan la misma regla que los reales (sin permiso, el
--   organizador no ve el número).
--
-- Rol: DevOps (George) · Tarea: CAP-102 · Historia: HU-18 (CAP-85).

alter function capa.sembrar_demo() rename to sembrar_demo_base;

create function capa.sembrar_demo() returns jsonb
language plpgsql as $$
declare
  r jsonb := capa.sembrar_demo_base();
begin
  if coalesce((r ->> 'ok')::boolean, true) is false then
    return r; -- la base ya tenía datos: no se tocó nada
  end if;
  -- Con permiso para compartirlo con el organizador del evento en el que se inscriben.
  update capa.usuarios set celular = c.celular, comparte_celular = true, celular_consentido_en = capa.ahora()
  from (values ('estudiante@capacitron.demo', '900000101'), ('diego.mamani@capacitron.demo', '900000102'),
               ('luis.ccahuana@capacitron.demo', '900000104')) as c(correo, celular)
  where capa.usuarios.correo = c.correo;
  -- Con celular, pero sin permiso para compartirlo.
  update capa.usuarios set celular = c.celular, comparte_celular = false
  from (values ('valeria.condori@capacitron.demo', '900000103'), ('ponente@capacitron.demo', '900000110')) as c(correo, celular)
  where capa.usuarios.correo = c.correo;
  -- Las demás cuentas quedan sin celular, como las creadas antes de la HU-18.
  return r;
end $$;
