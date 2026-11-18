# HU-16 · Plan y resultado de pruebas

**Historia:** CAP-83 · HU-16 Pago real con verificación manual (QR de Yape, transferencia o WhatsApp) · **Tarea:** CAP-91 · **Responsable:** Andree (Product Owner y QA)

> Como asistente, quiero pagar mi inscripción con un medio real (QR de Yape, transferencia bancaria o WhatsApp de la organización) y que la administración verifique mi pago, para asegurar mi cupo sin una pasarela simulada.

## 1. Alcance

| Pieza | Tarea | Qué prueban sus pruebas |
|---|---|---|
| Diseño del pago y de la bandeja | CAP-88 (Medaly) | Paneles por medio, formulario, estados, bandeja, rechazo y configuración |
| Pagos manuales en la base de datos | CAP-89 (Carlos) | Configuración, registrar, bandeja, aprobar, rechazar, reserva, privacidad y permisos |
| Pantallas | CAP-90 (José) | Pantalla de pago, Mis inscripciones, pestaña «Pagos» y pasarela solo en demostración |
| Almacenamiento de comprobantes y WhatsApp | CAP-92 (George) | Bucket privado y lectura firmada en Supabase (pendiente) |
| Historia completa | CAP-91 (Andree) | CA-01 a CA-06 de punta a punta: configurar → reservar → pagar → verificar → vencer |

## 2. Entorno

- **Automáticas:** `npx vitest run`.
  - Sin servicios externos: la base es PGlite con las mismas migraciones que Supabase, y el almacenamiento es el local, con la misma interfaz que Supabase Storage.
  - Las pantallas se dibujan con lo que devuelve la base.
  - El reloj de negocio se adelanta para probar los vencimientos.
  - Los datos de pago son de ejemplo: cuentas con ceros, WhatsApp 900 000 000 y números de operación inventados.
- **Manuales:** `npm run dev` con «Lucía Mamani» (Administración), «Ana Lucía Huamán» (asistente) y «Carmen Valdivia» (organizadora), en computadora y en un **celular real** con WhatsApp. M-10 necesita Supabase con CAP-92 terminada.

## 3. Matriz de trazabilidad

| Criterio | CAP-91 (aceptación) | También lo prueban | Resultado |
|---|---|---|---|
| **CA-01** QR de Yape, datos de la cuenta y WhatsApp con el mensaje preparado | 4 pruebas | CAP-88, CAP-89, CAP-90 | Cumple |
| **CA-02** Número de operación y captura → «Por verificar», cupo reservado | 2 pruebas | CAP-89, CAP-90 | Cumple (ver D-01) |
| **CA-03** Aprobar confirma, genera el comprobante y envía el correo | 1 prueba | CAP-89, CAP-90 | Cumple |
| **CA-04** Rechazar con motivo: se ve, llega el correo y se puede reenviar | 2 pruebas | CAP-89, CAP-90 | Cumple (ver D-03) |
| **CA-05** Reserva vencida sin pago aprobado libera el cupo | 2 pruebas | CAP-89 | Cumple (ver D-01) |
| **CA-06** Solo la administración aprueba, rechaza y configura | 2 pruebas | CAP-89, CAP-90 | Cumple |
| Comprobante ajeno (Ley N.° 29733) | 2 pruebas + 1 pendiente (H-01) | CAP-89 | Cumple en la API; en Supabase falta CAP-92 |
| Defecto D-02 y pasarela simulada | 2 pruebas | CAP-89, CAP-90 | Cumple |

**Resultado automático del paquete (17/11/2026):** 17 pruebas de aceptación aprobadas y 1 pendiente (H-01). `npx tsc --noEmit` sin errores.

**Verificación de esta rama (18/11/2026):** la suite CAP-91 no pudo cargar y ejecutó 0 pruebas porque faltan `src/lib/pagoManual`, `src/pages/PagarInscripcion` y `src/pages/admin/Pagos` de CAP-90. `npm test` terminó con 121 pruebas aprobadas y una suite fallida por esos módulos; `npx tsc --noEmit` reportó los mismos tres módulos ausentes.

## 4. Casos manuales

Los ejecuta Andree antes de aceptar la historia. **M-04 y M-09 van en un celular real.** Las capturas de CAP-90 muestran lo esperado.

| N.° | Criterio | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|
| M-01 | CA-06 | Como Lucía, en Administración → Pagos → Configuración, subir un QR, llenar banco, titular, cuenta, CCI y WhatsApp, y guardar. | «Medios disponibles: 3 de 3»; la cuenta y el CCI quedan solo con dígitos. | Cumple |
| M-02 | CA-06 | Como Carmen (organizadora), abrir `/admin?pestana=pagos`. | No puede entrar a Administración. | Cumple |
| M-03 | CA-01 | Como Ana, reservar un cupo en un evento con costo y pulsar «Pagar». | Pantalla de pago con el total, la hora de la reserva y las tres opciones. | Cumple |
| M-04 | CA-01 (celular) | En el celular, elegir WhatsApp y pulsar «Escribir por WhatsApp». | Se abre WhatsApp con el mensaje: nombre, evento y monto. | Cumple |
| M-05 | CA-02 | Pulsar «Enviar para verificar» sin datos; luego con número y captura. | Primero, los dos errores en rojo; después, «Pago por verificar». En Mis inscripciones, «Ver mi pago». | Cumple |
| M-06 | CA-04 | Como Lucía, rechazar con un motivo frecuente. Como Ana, abrir el correo y la pantalla de pago. | El motivo está en el correo y en la pantalla, con «Volver a enviar». | Cumple |
| M-07 | CA-03 | Reenviar y, como Lucía, aprobar. Como Ana, descargar el comprobante. | «Pago aprobado»; el PDF tiene el número CP-… y el correo llegó. | Cumple |
| M-08 | CA-05 | En modo demostración, reservar sin pagar y adelantar el reloj 31 minutos (Administración → Sistema). | La reserva vence y el cupo vuelve a estar libre. | Cumple |
| M-09 | Celular | Recorrer la pantalla de pago y la bandeja en el celular. | Sin desplazamiento horizontal; «Copiar» copia la cuenta. | Cumple |
| M-10 | Privacidad (Supabase) | Con CAP-92 terminada, copiar la dirección de una captura y abrirla en otra ventana sin sesión. | No se puede ver: solo con el enlace firmado que pide la administración. | Pendiente (falta CAP-92) |

## 5. Hallazgos y decisiones

| N.° | Tipo | Hallazgo | Evidencia | Estado o propuesta |
|---|---|---|---|---|
| D-02 | Defecto (medio) | Al cancelar la inscripción (la persona) o el evento (el organizador) con un pago «por verificar», el pago quedaba colgado para siempre: no salía en la bandeja y nadie coordinaba la devolución. Además, su número de operación quedaba bloqueado: si la persona se volvía a inscribir con el mismo pago, se rechazaba. | Prueba de sonda del 17/11 en CAP-91. | **Corregido el 17/11 en CAP-89** (la bandeja los muestra con `inscripcion_vigente = false`; reinscribirse con el mismo pago marca el anterior como reenviado) **y en CAP-90** (la tarjeta dice «Inscripción cancelada: rechaza el pago y coordina la devolución si hubo cobro»). Pruebas nuevas en CAP-89 (+2), CAP-90 (+1) y aquí. |
| D-01 | Decisión del PO | Mientras un pago está «por verificar», la reserva no vence (CA-02). Si nadie lo revisa, el cupo queda tomado sin límite. | Prueba de CA-02 (180 minutos después sigue reservado). | Decisión: el pago puede permanecer «por verificar» un máximo de 24 horas; después debe liberarse el cupo. Requiere implementar el vencimiento en la tarea correspondiente; CAP-91 solo documenta la decisión. |
| D-03 | Decisión del PO | Después de un rechazo se dan 30 minutos nuevos para reenviar (CAP-89). El CA-04 dice «mientras dure la reserva». | Prueba de CA-05 con rechazo. | Decisión: confirmar el plazo actual de 30 minutos. |
| H-01 | Pendiente (CAP-92) | En Supabase, la captura todavía no está en un bucket privado con lectura firmada. En modo local funciona, y la API ya solo entrega la ruta a la administración. | `it.todo` en esta prueba; `contrato.ts` (CAP-90). | Lo resuelve CAP-92 (George) antes de producción. |
| H-02 | Baja (CAP-90) | La ayuda del campo del QR dice «hasta 3 MB», pero el QR va al bucket «fotos», que admite 2 MB. | QUE_SE_HIZO de CAP-90. | Se resuelve cuando George decida dónde va el QR (CAP-92). |
| O-01 | Observación (Sprint 1) | En el celular, la fila «Pagado S/ 80.00 con Yape · CP-…» de Mis inscripciones parte el texto. | Captura 11 de CAP-90. | Revisar en otra tarea. |

## 6. Decisión de aceptación

La toma Andree como Product Owner después de los casos manuales y de decidir D-01 y D-03. H-01 debe cerrarse (CAP-92) antes de usar pagos reales en producción.

| Fecha | Decisión | Observaciones |
|---|---|---|
| 18/11/2026 | Aceptada | M-01 a M-09 cumplen según la validación reportada por el equipo. M-10 queda pendiente por CAP-92. D-01: máximo 24 horas por verificar. D-03: 30 minutos para reenviar tras un rechazo. H-01 debe resolverse antes de producción. |
