# CAP-91 · HU-16 Pruebas del pago manual

**Documentación de la tarea** · Rol: QA y pruebas (Andree) · Sprint 2 · Cronograma: n.° 25

**Tarea:** HU-16 · QA: pruebas del pago manual y su verificación · **Responsable:** Andree (Product Owner y QA) · **Historia:** CAP-83 (HU-16 Pago real con verificación manual), criterios **CA-01 a CA-06**.

## Qué se entrega

1. **`tests/cap91-aceptacion-hu16.test.ts`:** 17 pruebas de aceptación («dado…, cuando…, entonces…») y 1 pendiente. Recorren la historia con las piezas reales:
   1. la administración configura los medios (CAP-89);
   2. la asistente reserva y abre la pantalla de pago (CAP-90 con el diseño de CAP-88);
   3. envía el número de operación y la captura con el almacenamiento local;
   4. la administración aprueba o rechaza, y el vencimiento automático libera los cupos sin pago.

   **Sin servicios externos** (lo pide la tarea): la base es PGlite y el almacenamiento, el local.
2. **`docs/pruebas/HU-16/PLAN_DE_PRUEBAS.md`:** alcance, entorno, matriz, 10 casos manuales (2 en celular con WhatsApp, 1 con Supabase), hallazgos, decisiones y la tabla de aceptación.

## Los casos mínimos de la tarea

| Caso de Jira | Prueba |
|---|---|
| El pago registrado queda «por verificar» y el cupo sigue reservado | CA-02: sigue reservado aunque pasen 3 horas |
| Aprobar confirma, genera el comprobante y envía el correo | CA-03, desde la bandeja, con el correo y la pantalla «Pago aprobado» |
| Rechazar guarda el motivo y permite volver a enviar | CA-04: el motivo en la pantalla y en el correo, y el reenvío |
| La reserva vencida sin aprobación libera el cupo | CA-05: sin comprobante, y después de un rechazo |
| Solo la administración aprueba, rechaza o configura | CA-06: el organizador, la asistente y un visitante sin sesión no pueden |
| Otro usuario no puede ver el comprobante ajeno | Otra asistente no lo recibe ni lo puede pedir; el organizador no recibe la ruta de la captura. En Supabase queda pendiente (H-01, CAP-92). |

## Defecto encontrado y corregido: D-02

Antes de escribir las pruebas se revisaron casos borde con una prueba de sonda.

**Qué pasaba:** si la persona cancelaba su inscripción, o el organizador cancelaba el evento, mientras el pago estaba «por verificar»:
- el pago quedaba así para siempre y **no salía en la bandeja**: nadie coordinaba la devolución;
- su **número de operación quedaba bloqueado**: al volver a inscribirse con el mismo pago, se rechazaba.

**Corrección** (George eligió corregirlo en el paquete de Carlos):
- **CAP-89:** la bandeja muestra esos pagos con `inscripcion_vigente = false`, y reenviar el mismo pago en una inscripción nueva marca el anterior como reenviado. Hay 2 pruebas nuevas.
- **CAP-90:** la tarjeta dice «Inscripción cancelada: rechaza el pago y coordina la devolución si hubo cobro». Hay 1 prueba nueva.
- **Etapas verificadas de nuevo:** Carlos 432 y José 493.

## Decisiones para Andree (Product Owner)

- **D-01:** máximo de 24 horas en estado «por verificar»; después se debe liberar el cupo. La implementación corresponde a la tarea de vencimientos y no se modifica en este paquete de pruebas.
- **D-03:** se confirma el plazo actual de 30 minutos para reenviar después de un rechazo.

## Otros hallazgos

- **H-01:** en Supabase falta el bucket privado de comprobantes con lectura firmada (CAP-92, George). Queda como prueba pendiente.
- **H-02:** la ayuda del QR dice 3 MB, pero su bucket admite 2 MB (CAP-90).
- **O-01:** en el celular, la fila de pago del Sprint 1 parte el texto.

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Refactorizar con pruebas** (diap. 140) | Las pruebas fijan cómo se comporta el pago real antes de retirar la pasarela simulada. Una prueba confirma que la pasarela ya no funciona con el modo demostración apagado. |
| **Mantenibilidad** (diap. 137) | Se prueba sin servicios externos y con las mismas piezas que la app. La matriz dice qué tarea prueba cada criterio. |
| **Encapsulación** (diap. 20–24) | Las pruebas de CA-06 comprueban que el pago solo cambia por las funciones que validan el rol. |

## Pruebas

- **Resultado reportado en el paquete (17/11/2026):** archivo de la tarea, 17 aprobadas y 1 pendiente (H-01); etapa con CAP-90, 527 aprobadas y 4 pendientes; `tsc` sin errores.
- **Verificación de esta rama (18/11/2026):** la suite CAP-91 no pudo cargar y ejecutó 0 pruebas porque faltan `src/lib/pagoManual`, `src/pages/PagarInscripcion` y `src/pages/admin/Pagos` de CAP-90. `npm test` terminó con 121 pruebas aprobadas y una suite fallida por esos módulos; `npx tsc --noEmit` reportó los mismos tres módulos ausentes.
- **Manuales:** M-01 a M-09 cumplen según la validación reportada por el equipo; M-10 queda pendiente por CAP-92. No se replica el desglose de evidencias.

## Rendimiento

CAP-91 no cambia la app. La medición de la historia está en CAP-89 (consultas y bandeja: 18,5 ms con 200 pagos) y en CAP-90 (pantallas).
