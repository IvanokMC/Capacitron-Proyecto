# CAP-77 · HU-02 Validaciones de los campos nuevos

**Documentación de la tarea** · Rol: Frontend (José) · Sprint 2 · Cronograma: n.° 01

**Tarea:** HU-02 · Validaciones de los campos nuevos en el formulario y la API · **Responsable:** José (Frontend) · **Historia:** CAP-2 (HU-02), criterio **CA-07**.

> **CA-07.** Dado que falta el tipo, el lugar, el organizador o el contacto, cuando el organizador intenta publicar, el sistema lo impide y resalta el campo.

## Qué cambia para el usuario

- El formulario de **Nuevo evento / Editar evento** tiene un bloque nuevo, **«Tipo, organizador y contacto»**, con:
  - el tipo (seminario, congreso, taller o curso);
  - el organizador que verá el público;
  - un correo o teléfono de contacto;
  - la casilla para autorizar que el contacto se muestre (Ley N.° 29733).
- **Guardar borrador** funciona aunque falten esos datos (CA-02 no cambia).
- **Publicar** sin tipo, organizador o contacto (o sin lugar en un evento presencial o mixto) se detiene y resalta en rojo cada campo que falta, con su mensaje (ver `captura_formulario_CA-07.png`).
- La API hace la misma revisión: aunque alguien se salte el formulario, `guardar_evento` con «publicar» y `publicar_evento` rechazan el evento con el código `CAMPOS` y la lista de campos.
- El contacto **no** aparece en el catálogo ni en la página pública: solo el organizador lo ve al editar. Mostrarlo con consentimiento es la tarea CAP-78.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261116000001_validaciones_evento.sql` | **Nuevo.** Hace cuatro cosas:<br>• `capa.campos_faltantes_publicacion` deja la regla de CA-07 en un solo lugar.<br>• `capa.publicar` la usa para impedir la publicación.<br>• `guardar_evento` recibe y guarda el tipo, el organizador, el contacto y el consentimiento.<br>• `evento_gestion` devuelve esos campos al organizador, junto con `faltan_para_publicar`. |
| `src/lib/validacionEvento.ts` | **Nuevo.** Tipos de evento y `faltantesParaPublicar()`, que usa el formulario para avisar antes de enviar. |
| `src/pages/organizador/EditorEvento.tsx` | Agrega el bloque nuevo del formulario, carga los campos al editar, valida al publicar y envía los campos a la API. |
| `src/lib/backend/migraciones.ts` | Registra en el modo local las migraciones de CAP-76 y CAP-77 (la de CAP-76 solo estaba en las pruebas). |
| `tests/cap77-validaciones-evento.test.ts` | **Nuevo.** 12 pruebas: 9 de la API y 3 del formulario. |
| `tests/bd.ts` | Registra la migración nueva. El evento de prueba ahora trae tipo, organizador y contacto para poder publicarse. |
| `tests/cap76-campos-evento.test.ts` | Una prueba de CAP-76 crea su propio borrador sin los campos nuevos (antes usaba el evento publicado). |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Encapsulación** (diap. 20–24) | Los campos solo cambian por `guardar_evento`, que valida el tipo. El contacto no sale por `evento_json` (público), solo por `evento_gestion`, que exige ser el dueño del evento. |
| **Code smells: duplicación** (diap. 33) | La regla «qué falta para publicar» está en una sola función SQL, que usan `publicar` y `evento_gestion`. En el frontend se repite solo para avisar antes de enviar; la que decide es la API. |
| **SRP** (diap. 39–49) | Guardar un borrador no exige los campos; exigirlos es responsabilidad de publicar. `validacionEvento.ts` decide qué falta y la pantalla solo lo muestra. |
| **Cohesión** (diap. 26–28) | La regla de publicación del formulario vive en un módulo propio, que se puede probar sin dibujar la pantalla. |
| **Evitar sobreingeniería** (diap. 135–139) | Se redefinen las funciones existentes; no se creó una capa nueva de validación. |
| **Refactorizar con pruebas** (diap. 140) | Las 12 pruebas nuevas fijan CA-07 y las 86 anteriores confirman que nada más cambió. |

## Resultado de las pruebas

- `npm test`: **98 pruebas aprobadas** (86 anteriores y 12 nuevas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.
- **Rendimiento** (`rendimiento.json`, 30 repeticiones): las funciones medidas tardan lo mismo que en `main`, con diferencias menores a 0,4 ms. El build crece 18 KB porque el modo local incluye las dos migraciones nuevas.

## Corrección del 17/11/2026: defecto D-01

Las pruebas de aceptación de la HU-02 (CAP-79, George) encontraron que un evento **ya publicado** se podía editar y quedarse sin tipo, organizador y contacto. `guardar_evento` solo revisaba esos datos al publicar, no al editar, y el evento seguía publicado sin ellos. Eso incumplía el CA-07 y la regla RN-01 («todo evento publicado tiene un medio de contacto»).

Se cambió solo `supabase/migrations/20261116000001_validaciones_evento.sql`, dentro de `guardar_evento`:

1. **Al editar, un campo que la llamada no envía conserva su valor.** Antes quedaba en `null`. Solo un `null` explícito lo borra.
2. **Si el evento ya está publicado**, después de editar se aplica la misma regla que al publicar (`capa.campos_faltantes_publicacion`). Si falta algo, se rechaza con el código `CAMPOS` nombrando los campos y no se guarda nada.

Por qué así: la regla sigue en una sola función (diap. 33), y crear y editar cumplen lo mismo (LSP, diap. 64–79). El formulario no cambia, porque ya manda todos los campos.

Pruebas: las mismas 98, todas en verde, y `tsc` sin errores (verificado en la etapa de la tarea, sin las tareas posteriores). La prueba del defecto está en CAP-79.


- **Depende de CAP-76 (PR #1).** Si el PR #1 aún no está integrado, tu PR mostrará también sus 3 commits; desaparecen cuando se integre.
- **Supabase:** al desplegar hay que ejecutar en el SQL Editor la migración de CAP-76 y luego la de CAP-77. Eso lo hace George al integrar.
