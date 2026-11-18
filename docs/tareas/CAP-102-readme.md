# CAP-102 · README actualizado al cierre del Sprint 2

**Responsable:** George Iván Muñoz Castillo (Scrum Master · DevOps, integración y calidad de diseño)
**Historia:** HU-18 (CAP-85) · parte de integración de la tarea CAP-102
**Fecha:** 18/11/2026

## Qué se hizo

Con los 33 pull requests del Sprint 2 ya integrados en `main`, el README describía todavía solo el Sprint 1. Se actualizó para que cualquier persona pueda instalar, probar y entender el sistema completo:

1. **Descripción y enlaces:** las funciones nuevas (búsqueda y filtros, pago con verificación manual, foto, celular, mapa y flyer), la aplicación publicada y el proyecto de Jira.
2. **Tecnologías:** Supabase Storage con sus tres buckets, la Edge Function `url-comprobante` y los mapas con Leaflet y OpenStreetMap.
3. **Integración continua:** qué revisa `ci.yml` y la regla de integrar solo con el CI en verde.
4. **Base de datos:** las 13 migraciones del Sprint 2 en orden de instalación, el despliegue de la Edge Function y el estado real del proyecto en Supabase al 18/11, verificado con consultas.
5. **Pruebas:** 554 pruebas en verde (más 4 pendientes marcadas a propósito) y el comando de tipos que usa el CI.
6. **Historias:** una tabla del Sprint 2 con dónde se ve cada historia y qué archivos de prueba la cubren.
7. **Estructura y equipo:** las carpetas nuevas y el rol de cada integrante en el Sprint 2.

## Por qué así (teoría de Diseño de Software)

- **Mantenibilidad (diap. 137):** la claridad también es documentación: quien llega al repositorio entiende qué hace cada parte y cómo probarla sin preguntar.
- **Refactorizar con pruebas (diap. 140):** el README deja explícito que ningún cambio entra sin la suite en verde y cómo correrla en local.

## Arreglo: prueba de la demo que fallaba a veces

Al integrar el PR #16, el CI de `main` falló en `tests/cap102-privacidad-celular.test.ts` («hay cuentas de ejemplo con celular…»). La causa: la preparación de la prueba elegía al dueño de un certificado válido con `limit 1` y **sin `order by`**, así que Postgres podía devolver cualquiera. Cuando devolvía a `sofia.chavez`, le ponía celular, y la prueba siguiente exige justamente que esa cuenta no tenga.

- **Corrección:** se elige siempre el mismo certificado (`order by c.codigo`) y nunca el de `sofia.chavez`.
- **Teoría:** refactorizar con pruebas (diap. 140). Una prueba solo protege el comportamiento si da siempre el mismo resultado.
- **Comprobado:** la prueba pasa 3 de 3 veces seguidas, y la suite completa está en verde.

## Comprobación

- Se quitó la frase que pedía ejecutar `20261005000006_endurecimiento.sql`: la base de Supabase ya tiene sus funciones (`admin_diagnostico`, `admin_modo_demo`).
- El estado de las migraciones del Sprint 2 se comprobó en Supabase: hay `campos_evento` (columna `tipo`) y los buckets `fotos` y `eventos`; faltan las demás y la Edge Function.
- `npx tsc --noEmit` y `npm test` en verde antes de subir.
