# CAP-89 · HU-16 Pagos manuales con verificación

**Documentación de la tarea** · Rol: Backend y base de datos (Carlos) · Sprint 2 · Cronograma: n.° 22

**Tarea:** HU-16 · Backend: pagos manuales con verificación de la administración · **Responsable:** Carlos (Backend y base de datos) · **Historia:** CAP-83 (HU-16 Pago real con verificación manual), criterios **CA-02 a CA-06**.

## Qué se entrega

Una migración, `20261122000001_pagos_manuales.sql`, que funciona igual en Supabase y en PGlite.

### 1. Configuración de pagos (CA-06)

`capa.config_pagos` es una sola fila con los datos de pago de la organización:

| Dato | Regla |
|---|---|
| QR de Yape (`yape_qr`) | Ruta o dirección de la imagen |
| Titular de Yape | Hasta 120 caracteres |
| Banco y titular de la cuenta | Hasta 120 caracteres |
| Número de cuenta | De 8 a 20 dígitos |
| CCI | 20 dígitos |
| WhatsApp | Misma regla que el celular de CAP-99 |

- Se pueden escribir con espacios o guiones («000-0000000-0-00», «+51 900 000 000»); se guardan solo los dígitos.
- `capa.medios_disponibles` decide qué medios se ofrecen. Yape necesita el QR y el titular. La transferencia necesita el banco, el titular y la cuenta o el CCI. WhatsApp necesita el número. **Un medio sin sus datos no se muestra ni se acepta.**
- Los nombres de los campos son los de `ConfigPagos` en el diseño de Medaly (CAP-88).

### 2. Cambios en `capa.pagos`

- Medios nuevos: «transferencia» y «whatsapp». «yape» ya existía.
- Estado nuevo: «por_verificar».
- Columnas nuevas: número de operación, ruta de la captura, motivo del rechazo, quién verificó y cuándo.
- Un solo pago «por verificar» a la vez por inscripción.
- Un mismo número de operación no sirve para dos pagos vigentes del mismo medio (evita reusar una constancia).

### 3. Funciones (una por operación, SRP)

| Función | Quién | Qué hace |
|---|---|---|
| `medios_pago` | Cualquiera, sin sesión | Los datos de pago y los medios disponibles (CA-01) |
| `registrar_pago_manual` | El asistente dueño de la inscripción | Medio, número de operación y captura → «por verificar» (CA-02) |
| `pagos_por_verificar` | Administración | La bandeja, con la persona, el evento, el monto, el medio, la operación y la captura |
| `aprobar_pago` | Administración | Confirma la inscripción, genera el comprobante y envía el correo (CA-03) |
| `rechazar_pago` | Administración | Guarda el motivo (de 5 a 300 caracteres), envía el correo y da 30 minutos para reenviar (CA-04) |
| `guardar_config_pagos` | Administración | Guarda la configuración (CA-06). Una clave ausente no se toca y una vacía se borra |

Cada aprobación, rechazo y cambio de configuración queda en la auditoría.

### 4. La reserva mientras se verifica (CA-02 y CA-05)

Hoy una reserva vence a los 30 minutos. Si la administración tarda más en revisar, la persona perdería su cupo aunque ya pagó.

- **Al registrar el pago**, `reserva_expira_en` queda en null. La tarea automática de vencimientos solo libera reservas con fecha, así que no toca esta. **No hubo que cambiar esa tarea** (del Sprint 1).
- **Al aprobar**, la inscripción pasa a confirmada.
- **Al rechazar**, la reserva vuelve a tener 30 minutos desde el rechazo, los mismos que al inscribirse, para reenviar el comprobante. Si no lo reenvía, el cupo se libera como siempre (CA-05).

### 5. Otras reglas

- **Inscripción ya no vigente:** si la persona canceló o se canceló el evento, el pago no se aprueba. Queda rechazado con «La inscripción ya no está vigente» y sale de la bandeja. La función lo informa sin error, para que ese cambio se guarde.
- **Privacidad (Ley N.° 29733):** la ruta de la captura solo sale en `pagos_por_verificar`, para la administración. `capa.pago_json` también lo usa el comprobante que ve el organizador, así que no la incluye. El asistente recibe en `mis_inscripciones` el número de operación, el motivo del rechazo y la fecha de verificación.
- **El comprobante** usa la misma secuencia y el mismo formato que la pasarela del Sprint 1 (CP-2026-001001).
- **`respuesta_pasarela`** no cambia: desde el Sprint 1 solo responde en modo demostración. Una prueba lo confirma.
- **La captura** debe estar en la carpeta de esa inscripción: `<id de la inscripción>/<archivo>.jpg|png|webp`.

## Corrección D-02 (17/11, hallada por Andree en CAP-91)

**El defecto.** Si la persona cancelaba su inscripción, o el organizador cancelaba el evento, mientras su pago estaba «por verificar», pasaban dos cosas:
- el pago quedaba colgado para siempre: no salía en la bandeja y nadie coordinaba la devolución;
- su número de operación quedaba bloqueado: al volver a inscribirse con el mismo pago, se rechazaba.

**La corrección:**
- `pagos_por_verificar` también devuelve esos pagos, con `inscripcion_vigente = false`. Al aprobarlos o rechazarlos quedan rechazados con «La inscripción ya no está vigente».
- Si la **misma persona** reenvía ese número de operación en una inscripción nueva, el pago anterior queda rechazado («Se reenvió en una nueva inscripción.») y se acepta el nuevo. Otra persona sigue sin poder usar ese número.
- **Pruebas:** 2 nuevas (cancelar el evento y reinscribirse), y la de «el asistente canceló» se actualizó.

## Decisiones para revisar con el equipo

- **Andree (Product Owner):** al rechazar se dan 30 minutos nuevos para reenviar. El CA-04 dice «mientras dure la reserva», pero si la verificación tardó más de 30 minutos no quedaría tiempo. Si prefiere otro plazo, es una línea en `rechazar_pago`.
- **George (CAP-92):** la captura va en un bucket privado con rutas `<id de la inscripción>/<archivo>`, la forma que valida `capa.ruta_comprobante_valida`. El número de WhatsApp de la organización sigue sin definirse; la administración lo carga con `guardar_config_pagos`.
- **José (CAP-90):**
  - `mis_inscripciones` y `evento_gestion` ahora pueden devolver el estado de pago «por_verificar», que la pantalla debe mostrar.
  - Mientras se verifica, `reserva_expira_en` llega en null.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261122000001_pagos_manuales.sql` | Nuevo: configuración de pagos, columnas de verificación y las 6 funciones |
| `src/lib/backend/migraciones.ts` | Modificado: el modo local ejecuta la migración nueva |
| `tests/bd.ts` | Modificado: la base de pruebas la ejecuta |
| `src/lib/tipos.ts` | Modificado: `MedioPagoManual`, `MediosPago` y campos nuevos de `Pago` |
| `tests/cap89-pagos-manuales.test.ts` | Nuevo: 21 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Encapsulación** (diap. 20–24) | El pago solo pasa a «confirmado» o «rechazado» por `aprobar_pago` y `rechazar_pago`, que exigen ser administración y que el pago esté «por verificar». La configuración solo cambia por `guardar_config_pagos`. |
| **OCP** (diap. 50–63) | Los medios manuales y cuándo está disponible cada uno están en un solo lugar (`capa.medios_disponibles`). Sumar Plin sería una línea ahí y otra en el check de `metodo`. |
| **SRP** (diap. 39–49) | Una función por operación. Validar el pago que se va a revisar (`capa.pago_por_verificar`) y el caso de inscripción no vigente son funciones aparte, usadas por aprobar y rechazar. |
| **Code smells / duplicación** (diap. 33) | El WhatsApp usa la regla y el mensaje del celular de CAP-99. El número de comprobante sale de una sola función con el formato del Sprint 1. |
| **Refactorizar con pruebas** (diap. 140) | Las pruebas del Sprint 1 sobre pagos, cupos y vencimientos siguen pasando sin cambios. |

## Pruebas (21 nuevas, `tests/cap89-pagos-manuales.test.ts`)

- **Configuración:**
  - la administración la guarda y se normaliza;
  - nadie más puede;
  - un CCI, una cuenta o un WhatsApp con otra forma se rechaza diciendo cuál;
  - un medio sin datos no se ofrece;
  - los medios se ven sin sesión.
- **Registrar el pago:**
  - queda «por verificar» y el cupo sigue reservado;
  - el vencimiento automático no lo libera;
  - pide los tres datos y dice cuáles faltan;
  - la captura debe estar en la carpeta de la inscripción;
  - no hay dos pagos por verificar a la vez ni un número de operación repetido;
  - no sirve para la inscripción de otra persona ni para una reserva vencida.
- **Verificar:**
  - la bandeja es solo de la administración;
  - aprobar confirma, genera el comprobante y envía el correo;
  - rechazar guarda el motivo, envía el correo y permite reenviar;
  - si no reenvía en 30 minutos, el cupo se libera;
  - el motivo es obligatorio;
  - un pago revisado no se revisa de nuevo;
  - una inscripción cancelada no se aprueba, pero su pago sigue en la bandeja marcado (D-02), también si se cancela el evento;
  - quien se reinscribe puede reenviar el mismo pago (D-02).
- **Privacidad y demostración:**
  - el organizador no recibe la ruta de la captura;
  - con el modo demostración apagado, la pasarela simulada no confirma pagos.

Los datos de pago de las pruebas son de ejemplo: cuentas con ceros y números de operación inventados.

## Rendimiento (`rendimiento.json`)

- **Consultas existentes:** sin cambios. Se midieron antes y después, una tras otra, con 30 repeticiones; las diferencias son de ±0,2 ms, dentro del ruido.
- **Funciones nuevas, con 200 pagos por verificar:**

  | Función | Mediana |
  |---|---|
  | `pagos_por_verificar` | 18,5 ms |
  | `aprobar_pago` | 2,7 ms |
  | `rechazar_pago` | 2,7 ms |
  | `medios_pago` | 0,8 ms |

  Si la bandeja llegara a miles de pagos, convendría paginarla.
- **Build:** +22,5 KB de JS. Es el texto SQL que el modo local incluye para crear la base en el navegador; en producción con Supabase no se usa.

## Lo que queda pendiente

- **George:** ejecutar la migración en Supabase. Va en el SQL Editor después de la de CAP-109.
- **José (CAP-90):** las pantallas de pago y la bandeja.
- **Andree (CAP-91):** pruebas de aceptación de la HU-16 y la decisión sobre el plazo para reenviar.
