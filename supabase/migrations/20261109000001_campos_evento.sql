-- CAPACITRON · Campos públicos del evento (CAP-76, refinamiento de la HU-02)
-- Portable (Supabase y PGlite). Para una base que ya tenía las migraciones
-- anteriores, basta con ejecutar este archivo en el SQL Editor de Supabase.
--
-- Los campos admiten nulos porque los eventos existentes no los tienen. Exigirlos
-- al publicar corresponde a CAP-77 y mostrarlos, a CAP-78. Hasta entonces ninguna
-- función los devuelve, así que el contacto no queda expuesto.
--
-- El nombre visible es organizador_nombre y no organizador porque la API ya usa
-- la clave «organizador» para el nombre de la cuenta que creó el evento.

alter table capa.eventos
  add column tipo                    text check (tipo in ('seminario', 'congreso', 'taller', 'curso')),
  add column organizador_nombre      text check (length(trim(organizador_nombre)) > 0),
  add column contacto                text check (length(trim(contacto)) > 0),
  add column contacto_consentimiento boolean not null default false;

comment on column capa.eventos.organizador_nombre is
  'Nombre del organizador que se muestra al público (persona o entidad).';
comment on column capa.eventos.contacto is
  'Correo o teléfono del organizador. Solo se muestra con contacto_consentimiento (RN-01, Ley N.° 29733).';
comment on column capa.eventos.contacto_consentimiento is
  'Autorización del organizador para mostrar su contacto al público.';
