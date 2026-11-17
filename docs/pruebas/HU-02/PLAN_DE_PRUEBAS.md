# HU-02 (refinamiento) · Plan y resultado de pruebas de CA-06 a CA-08

**Historia:** CAP-2 · HU-02 Crear evento, refinada para el Sprint 2 · **Tarea:** CAP-79 · **Responsable:** George (Scrum Master; DevOps y calidad de diseño). La historia la acepta Andree como Product Owner.

> Como organizadora de eventos académicos, quiero publicar un evento con su tipo, lugar, organizador y contacto, además de nombre, fecha, modalidad, cupos y costo, para llegar a nuevos participantes.

## 1. Alcance

| Pieza | Tarea | Qué prueban sus pruebas |
|---|---|---|
| Columnas nuevas | CAP-76 (José) | Tipo, organizador, contacto y consentimiento en la tabla |
| Reglas al publicar | CAP-77 (José) | La API y el formulario exigen los cuatro datos |
| Página pública y contacto | CAP-78 (José) | Qué ve el visitante, el contacto con consentimiento y el formulario |
| Historia completa | CAP-79 (George) | CA-06 a CA-08 de punta a punta: borrador → publicar o editar → página del visitante |

## 2. Entorno

- **Automáticas:** `npx vitest run` con PGlite en memoria y las mismas migraciones que Supabase.
- **Manuales:** `npm run dev` en modo local con la cuenta de demostración «Carmen Valdivia» (organizadora) y una ventana privada sin sesión (visitante).

## 3. Matriz de trazabilidad

| Criterio | CAP-79 (aceptación) | También lo prueban | Resultado |
|---|---|---|---|
| **CA-06** La página muestra tipo, lugar (o «Virtual»), organizador y contacto | 4 pruebas | CAP-77 (se guardan tal cual), CAP-78 (catálogo, página y enlace de contacto) | Cumple |
| **CA-07** Sin esos datos no se publica y se resalta el campo | 7 pruebas | CAP-76 (valores de tipo, texto vacío), CAP-77 (API y formulario) | Cumple tras corregir D-01 en CAP-77 |
| **CA-08** Sin consentimiento no se muestra y hay formulario | 4 pruebas | CAP-76 y CAP-77 (el contacto no sale en público), CAP-78 (formulario y sus límites) | Cumple |

Lo que agregan las pruebas de CAP-79:

- El recorrido real: borrador → `publicar_evento`, y la página armada con las funciones de la pantalla sobre la respuesta de la API.
- Que la API y el formulario resaltan **el mismo** campo en cada caso.
- Que un evento con datos incompletos tampoco aparece en el catálogo.
- El contacto por teléfono.
- El consentimiento omitido cuenta como «no» (privado por defecto).
- Retirar el consentimiento a un evento ya publicado.
- Editar un evento publicado, donde está el defecto D-01.

**Resultado automático (17/11/2026):**
- Primera ejecución: 14 de 15 aprobadas; falló la de D-01.
- Con la corrección en CAP-77: **15 de 15 aprobadas**.
- Proyecto completo con todas las tareas del Sprint 2 preparadas hasta CAP-82: 238 aprobadas y 1 pendiente (H-01 de la HU-15).
- `npx tsc --noEmit`: sin errores.

## 4. Casos manuales

Los ejecuta Andree antes de aceptar la historia.

| N.° | Criterio | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|
| M-01 | CA-07 | Como Carmen, crear un evento y dejar vacíos tipo, organizador y contacto. Pulsar «Publicar». | No se publica; los tres campos quedan en rojo con su mensaje. | Pendiente |
| M-02 | CA-07 | Completar solo el tipo y volver a publicar. | Siguen en rojo solo organizador y contacto. | Pendiente |
| M-03 | CA-06 | Completar todo, marcar el consentimiento y publicar. Abrir la página en una ventana privada. | Se ven el tipo, el lugar, «Organiza …» y el correo o teléfono como enlace. | Pendiente |
| M-04 | CA-06 | Publicar un evento virtual. | La página dice «Virtual» y no muestra un lugar. | Pendiente |
| M-05 | CA-08 | Publicar otro evento **sin** marcar el consentimiento y abrirlo sin sesión. | No aparece el correo ni el teléfono; aparece «Escribir al organizador». | Pendiente |
| M-06 | CA-08 | Enviar un mensaje desde ese formulario. Abrir el «Buzón de demostración». | Carmen recibe el mensaje con el correo del visitante para responder. | Pendiente |
| M-07 | CA-08 | Editar el evento de M-03 y quitar el consentimiento. | El contacto deja de verse en la página y aparece el formulario. | Pendiente |
| M-08 | CA-07 | Editar el evento publicado de M-03, borrar el contacto y guardar. | No se guarda y el contacto queda en rojo (D-01 corregido). | Pendiente |

## 5. Hallazgos

| N.° | Gravedad | Hallazgo | Evidencia | Propuesta |
|---|---|---|---|---|
| D-01 | **Alta** (incumple CA-07 y la regla RN-01) | Un evento **ya publicado** se puede editar y quedarse sin tipo, organizador y contacto: `guardar_evento` solo revisa esos datos al publicar, no al editar. El evento sigue publicado sin ellos. | Sonda del 17/11/2026: editar con los tres en `null` → sin error, estado `publicado`, y la página pública sin tipo, organizador ni contacto. Prueba de CAP-79 «dado un evento publicado, cuando la organizadora borra…». | **Corregido el 17/11/2026 en el paquete de CAP-77 (José; lo sube el 18/11).** En `guardar_evento`: (1) al editar, un campo no enviado conserva su valor y solo un `null` explícito lo borra; (2) si el evento está publicado, después de editar se aplica la misma regla que al publicar (`capa.campos_faltantes_publicacion`). La regla queda en un solo lugar (diap. 33) y crear y editar cumplen lo mismo (LSP, diap. 64–79). Tres pruebas del Sprint 1 reenviaban la vista pública del evento, que desde CAP-78 trae `contacto: null`, y con eso borraban el contacto sin querer. Ahora editan con `evento_gestion`, como el editor real; ese ajuste va en el paquete de CAP-78. |

## 6. Decisión de aceptación

| Fecha | Decisión | Observaciones |
|---|---|---|
| | Pendiente | D-01 corregido; falta integrar CAP-77 y CAP-78 y ejecutar los casos manuales |
