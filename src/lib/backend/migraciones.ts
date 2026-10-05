// Migraciones para el modo local: el mismo SQL que se despliega en Supabase.
import esquema from '../../../supabase/migrations/20261005000001_esquema.sql?raw'
import funcionesBase from '../../../supabase/migrations/20261005000002_funciones_base.sql?raw'
import funcionesOperacion from '../../../supabase/migrations/20261005000003_funciones_operacion.sql?raw'
import demo from '../../../supabase/migrations/20261005000004_demo.sql?raw'
import endurecimiento from '../../../supabase/migrations/20261005000006_endurecimiento.sql?raw'

interface Ejecutor {
  exec(sql: string): Promise<unknown>
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>
}

// Solo modo local: el worker de PGlite transmite únicamente el mensaje de un error,
// así que las llamadas pasan por este envoltorio que devuelve también el código
// (hint) y el detalle como datos. La transacción de la función se revierte igual.
const RPC_LOCAL = `
create function capa.rpc_local(fn text, p jsonb) returns jsonb
language plpgsql as $$
declare
  r jsonb;
  v_msg text;
  v_hint text;
  v_det text;
begin
  if fn !~ '^[a-z_]+$' then
    raise exception 'Función no válida';
  end if;
  execute format('select public.%I($1)', fn) into r using p;
  return jsonb_build_object('r', r);
exception when others then
  get stacked diagnostics v_msg = message_text, v_hint = pg_exception_hint, v_det = pg_exception_detail;
  return jsonb_build_object('__error', jsonb_build_object('message', v_msg, 'hint', v_hint, 'detail', v_det));
end $$;
`

const SQL = [esquema, funcionesBase, funcionesOperacion, demo, endurecimiento, RPC_LOCAL]

/** Huella del SQL: si cambia una migración, la base local se recrea. */
export const VERSION_SQL = (() => {
  let h = 0x811c9dc5
  for (const parte of SQL) {
    for (let i = 0; i < parte.length; i++) {
      h ^= parte.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
  }
  return (h >>> 0).toString(16)
})()

async function versionActual(db: Ejecutor) {
  try {
    const r = await db.query<{ v: string }>(`select valor as v from capa.meta where clave = 'version_sql'`)
    return r.rows[0]?.v ?? null
  } catch {
    return null
  }
}

/** Borra todo y vuelve a crear la base con los datos de demostración. */
export async function recrear(db: Ejecutor) {
  await db.exec(`
    drop schema if exists capa cascade;
    drop schema if exists public cascade;
    drop schema if exists extensions cascade;
    create schema public;
    create schema extensions;
  `)
  for (const parte of SQL) await db.exec(parte)
  await db.exec(`
    create table capa.meta (clave text primary key, valor text not null);
    insert into capa.meta values ('version_sql', '${VERSION_SQL}');
  `)
  await db.query('select capa.sembrar_demo()')
}

export async function migrar(db: Ejecutor) {
  if ((await versionActual(db)) !== VERSION_SQL) await recrear(db)
}
