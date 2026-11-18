# HU-17 · Plan y resultado de pruebas

**Historia:** CAP-84 · HU-17 Perfil del usuario con foto y datos · **Tarea:** CAP-96 · **Responsable:** Andree (Product Owner y QA)

> Como usuario de CAPACITRON, quiero tener un perfil con mi foto y mis datos, para que la plataforma y los organizadores me identifiquen.

## 1. Alcance

| Pieza | Tarea | Qué prueban sus pruebas |
|---|---|---|
| Diseño del avatar y del selector | CAP-93 (Medaly) | Estados del avatar y del selector de foto |
| Foto en la base de datos | CAP-94 (Carlos) | Formato de la ruta, carpeta propia, quitar y foto en inscritos |
| Módulo común de almacenamiento | CAP-97 (George) | Validación del archivo, rutas nuevas, las dos implementaciones (local y Supabase) |
| Mi perfil, menú e inscritos | CAP-95 (José) | Estados de la foto en la pantalla y guardado con el módulo y la API |
| Historia completa | CAP-96 (Andree) | CA-01 a CA-05 de punta a punta: elegir → subir → guardar → ver |

## 2. Entorno

- **Automáticas:** `npx vitest run` con PGlite en memoria y el almacenamiento local en memoria (la misma interfaz que Supabase Storage).
- **Manuales:** `npm run dev` en modo local con la cuenta de demostración «Ana Lucía Huamán» (asistente) y «Carmen Valdivia» (organizadora).

## 3. Matriz de trazabilidad

| Criterio | CAP-96 (aceptación) | También lo prueban | Resultado |
|---|---|---|---|
| **CA-01** JPG, PNG o WEBP de hasta 2 MB se guarda y se ve | 5 pruebas | CAP-93, CAP-94, CAP-95, CAP-97 | Cumple |
| **CA-02** Otro tipo o más de 2 MB se rechaza con el motivo | 9 pruebas | CAP-93, CAP-94, CAP-95, CAP-97 | Cumple (H-01 corregido) |
| **CA-03** Quitar la foto vuelve a las iniciales | 2 pruebas | CAP-93, CAP-94, CAP-95 | Cumple |
| **CA-04** Mi perfil muestra los datos; se editan los que no son de solo lectura | 2 pruebas + 1 pendiente (celular) | CAP-95 | **Parcial:** falta el celular, que llega con CAP-100 |
| **CA-05** Solo yo cambio o quito mi foto | 4 pruebas | CAP-94, CAP-95, CAP-97 | Cumple |
| Dónde se ve (perfil, menú, inscritos) | 1 prueba | CAP-95 | Cumple |

Lo que agregan las pruebas de CAP-96:

- El recorrido completo con el módulo de almacenamiento y la API juntos.
- El borde exacto de 2 MB (se acepta).
- SVG, HEIC (fotos de iPhone) y archivos sin tipo (se rechazan).
- Cambiar una foto por otra sin pisar la anterior.
- Quitar la foto también la quita de la lista de inscritos.
- Mi perfil dibujado con correo, rol e institución de solo lectura.
- Que la API ignore `rol`, `correo` e `institucion_id` si alguien los manda.
- Que el almacenamiento no reemplace un archivo ya subido.
- Sin sesión no se cambia nada.

**Resultado automático reportado en el paquete (17/11/2026):** 23 pruebas de aceptación aprobadas y 1 pendiente (el celular de CAP-100). H-01 se corrigió el mismo día en CAP-97 y su prueba ya está activa. `npx tsc --noEmit` sin errores. Detalle en `pruebas.txt` del paquete.

**Verificación de esta rama (18/11/2026):** la prueba de CAP-96 no pudo cargar porque falta `src/lib/fotoPerfil`; `npm test` terminó con 121 pruebas aprobadas y una suite fallida. `npx tsc --noEmit` reportó el módulo faltante y que `Avatar` no acepta la propiedad `alt`.

## 4. Casos manuales

Los ejecuta Andree en el navegador antes de aceptar la historia. Las capturas de CAP-95 muestran lo esperado.

| N.° | Criterio | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|
| M-01 | CA-04 | Ingresar como «Ana Lucía Huamán» y abrir «Mi perfil». | Nombres y apellidos editables; correo, rol e institución sin poder cambiarse; iniciales en lugar de foto. | No cumple: no se muestra la institución en «Mi perfil». |
| M-02 | CA-02 | Elegir un PDF o un GIF. | «La foto debe ser una imagen JPG, PNG o WEBP.» y la foto no cambia. | No cumple: no hay selector de foto para elegir PDF o GIF. |
| M-03 | CA-02 | Elegir una imagen de más de 2 MB (por ejemplo, una foto del celular). | Dice cuánto pesa y que el límite es 2 MB. | No cumple: no hay selector de foto. |
| M-04 | CA-01 | Elegir un JPG de menos de 2 MB. | Aparece la vista previa con el aviso de guardar. | No cumple: no hay selector ni vista previa de foto. |
| M-05 | CA-01 | Pulsar «Guardar cambios». | «Perfil actualizado»; la foto se ve en el perfil y en el menú de arriba. | No cumple: no se puede elegir ni guardar una foto. |
| M-06 | CA-01 | Recargar la página. | La foto sigue (queda guardada). | No cumple: no se pudo cargar una foto para verificar su persistencia. |
| M-07 | Inscritos | Inscribirse en un evento de Carmen; ingresar como Carmen y abrir la gestión del evento. | La lista de inscritos muestra la foto de Ana. | No cumple: Ana aparece en la lista sin foto. |
| M-08 | CA-03 | Como Ana, «Quitar foto» y guardar. | Vuelven las iniciales en el perfil, el menú y la lista de Carmen. | No cumple: no existe la acción «Quitar foto». |
| M-09 | Celular | Repetir M-04 y M-05 en un celular (o a 390 px de ancho). | El selector y la vista previa caben sin desplazamiento horizontal. | No cumple: no hay selector ni vista previa para comprobar. La pantalla actual no tiene desbordamiento horizontal. |
| M-10 | CA-05 (Supabase) | Cuando George ejecute la migración del bucket en Supabase: subir una foto en la app desplegada. | La foto se guarda en `fotos/<id de Ana>/…` y se ve; no hay forma de escribir en la carpeta de otro. | Pendiente (requiere Supabase) |

## 5. Hallazgos

| N.° | Gravedad | Hallazgo | Evidencia | Propuesta |
|---|---|---|---|---|
| H-01 | Baja (texto confuso) | Un archivo apenas mayor a 2 MB se rechaza con «La foto pesa **2,0 MB** y el límite es **2 MB**». Se lee como si cumpliera el límite. Pasa entre 2 MB y unos 2,05 MB, porque el peso se redondea a un decimal. | `validarArchivo` en `src/lib/almacenamiento/contrato.ts` (CAP-97) usaba `toFixed(1)`: 2 MB + 1 byte → «2,0». | **Corregido el 17/11/2026 en CAP-97 (PR #2, commit 4f3849d):** el peso se redondea hacia arriba (2 MB + 1 byte → «2,1 MB»). La prueba de CAP-96 pasó de pendiente a activa, y CAP-97 suma una prueba del borde. |
| O-01 | Observación | Al cambiar o quitar la foto, el archivo anterior queda en el bucket. | Documentado como riesgo residual en la migración del bucket (CAP-97). | Limpieza de archivos huérfanos como mejora futura. |
| O-02 | Observación | CA-04 pide el celular en Mi perfil; la sesión ya lo trae (CAP-99), pero la pantalla lo muestra recién con CAP-100. | Prueba pendiente en CAP-96. | Revisar CA-04 de nuevo cuando se integre CAP-100. |
| H-02 | Bloqueante en esta rama | La pantalla de perfil no ofrece el flujo de foto y la lista de inscritos no muestra la foto de Ana. | M-01 a M-09; la prueba no carga por faltar `src/lib/fotoPerfil`, y TypeScript también reporta una incompatibilidad de `Avatar`. | Integrar la rama de CAP-95 y sus dependencias, y repetir las pruebas automáticas y manuales. |

## 6. Decisión de aceptación

La toma Andree como Product Owner después de los casos manuales. Las pruebas automáticas no encuentran nada que bloquee; CA-04 queda parcial hasta CAP-100.

| Fecha | Decisión | Observaciones |
|---|---|---|
| 18/11/2026 | Rechazada | M-01 a M-09 no cumplen en esta rama porque falta el flujo de foto; M-10 sigue pendiente por requerir Supabase. Repetir la evaluación después de integrar CAP-95. |
