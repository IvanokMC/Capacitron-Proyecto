-- CAPACITRON · Consultas de métricas de participación (HU-10, CAP-59)
-- Ejecutar en el SQL Editor de Supabase (o en cualquier cliente Postgres con
-- acceso al esquema capa). Son las mismas reglas que usa la función
-- public.reporte_participacion: solo pagos confirmados, asistentes = inscritos
-- confirmados con al menos una jornada registrada.

-- 1) Métricas por evento publicado
select
  e.nombre                                                         as evento,
  (e.fecha_inicio at time zone 'America/Lima')::date               as fecha,
  e.modalidad,
  e.cupo_maximo                                                    as cupo,
  count(distinct i.id) filter (where i.estado = 'confirmada')      as inscritos,
  count(distinct a.inscripcion_id)                                 as asistentes,
  round(100.0 * count(distinct a.inscripcion_id)
        / nullif(count(distinct i.id) filter (where i.estado = 'confirmada'), 0), 1) as porcentaje_asistencia,
  coalesce((select sum(pg.monto) from capa.pagos pg
            where pg.evento_id = e.id and pg.estado = 'confirmado'), 0) as ingresos
from capa.eventos e
left join capa.inscripciones i on i.evento_id = e.id
left join capa.asistencias a  on a.inscripcion_id = i.id and i.estado = 'confirmada'
where e.estado = 'publicado'
group by e.id
order by e.fecha_inicio desc;

-- 2) Totales de un organizador (reemplaza el correo)
select
  count(distinct e.id)                                             as eventos,
  count(distinct i.id) filter (where i.estado = 'confirmada')      as inscritos,
  count(distinct a.inscripcion_id)                                 as asistentes,
  round(100.0 * count(distinct a.inscripcion_id)
        / nullif(count(distinct i.id) filter (where i.estado = 'confirmada'), 0), 1) as porcentaje_asistencia
from capa.eventos e
join capa.usuarios o on o.id = e.organizador_id
left join capa.inscripciones i on i.evento_id = e.id
left join capa.asistencias a  on a.inscripcion_id = i.id and i.estado = 'confirmada'
where e.estado = 'publicado' and o.correo = 'coordinacion@capacitron.demo';

-- 3) Ingresos confirmados por medio de pago
select metodo, count(*) as operaciones, sum(monto) as monto
from capa.pagos
where estado = 'confirmado'
group by metodo
order by monto desc;

-- 4) Asistencia por jornada de un evento (reemplaza el nombre)
select a.jornada, count(*) as presentes
from capa.asistencias a
join capa.eventos e on e.id = a.evento_id
where e.nombre ilike '%Ingeniería de Requisitos%'
group by a.jornada
order by a.jornada;

-- 5) Satisfacción promedio por evento (encuestas)
select e.nombre as evento, count(distinct r.id) as respuestas,
       round(avg(x::numeric), 2) as promedio_1_a_5
from capa.encuesta_respuestas r
join capa.eventos e on e.id = r.evento_id
cross join lateral jsonb_array_elements_text(r.puntajes) x
group by e.id
order by promedio_1_a_5 desc;
