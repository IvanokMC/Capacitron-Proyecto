# CAP-90 · HU-16 Pantalla de pago real y verificación

**Documentación de la tarea** · Rol: Frontend (José) · Sprint 2 · Cronograma: n.° 24

> Las capturas que se mencionan están en el pull request de esta tarea; no se guardan en el repositorio para no agrandarlo.

**Tarea:** HU-16 · Frontend: pantalla de pago real y verificación en Administración · **Responsable:** José (Frontend) · **Historia:** CAP-83 (HU-16 Pago real con verificación manual), criterios **CA-01 a CA-04 y CA-06**.

## Qué se entrega

1. **Pantalla de pago propia** (`PagarInscripcion.tsx`, ruta `/mis-inscripciones/:id/pagar`), con los componentes de Medaly (CAP-88).
   - Muestra el total, la reserva y un selector de medio. Debajo va el panel de ese medio:
     - **Yape:** el QR y «Paga S/ 80.00 a …».
     - **Transferencia:** banco, cuenta, CCI y titular, con «Copiar».
     - **WhatsApp:** el mensaje preparado con el nombre, el evento y el monto, y el botón que abre wa.me (CA-01).
   - **Registrar el pago** (CA-02): número de operación y captura. La captura se valida con el módulo común (3 MB), se comprime (CAP-112) y se sube a `comprobantes/<id de la inscripción>/`. Después se llama a `registrar_pago_manual` (CAP-89).
   - **Estados:** «Pago por verificar» (CA-02), «Pago rechazado» con el motivo y «Volver a enviar» (CA-04), y «Pago aprobado» con «Descargar comprobante» (CA-03).
   - **Strategy:** un panel por medio en `PANELES`. Una prueba comprueba que cada medio de `MEDIOS_PAGO` tenga el suyo.
2. **Mis inscripciones:**
   - «Pagar» lleva a la pantalla de pago. El enlace del correo (`?pagar=`) también lleva ahí.
   - La tarjeta dice «Pago por verificar (operación …)» o «Pago rechazado: <motivo>», y el botón cambia a «Ver mi pago» o «Volver a enviar».
   - El archivo baja de 33,7 a 16,8 KB.
3. **Pasarela simulada:** salió de `MisInscripciones.tsx` a `PasarelaSimulada.tsx`, sin cambiar lo que hace. La pantalla de pago solo la ofrece en **modo demostración**; la API también lo exige desde el Sprint 1.
4. **Administración → Pagos** (`admin/Pagos.tsx`):
   - **Por verificar:** la bandeja con la captura, la persona, el evento, el monto, el medio y la operación. «Aprobar» confirma; «Rechazar» abre un diálogo con los motivos frecuentes (CA-03, CA-04).
   - **Configuración:** QR, titular de Yape, banco, titular, cuenta, CCI y WhatsApp (CA-06). Después de guardar se ve lo que quedó guardado (la API deja solo los dígitos).
5. **`lib/pagoManual.ts`:** la lógica sin pantalla, para probarla sin navegador. Tiene el estado visible del pago, el mensaje y el enlace de WhatsApp, la regla del número de operación (la misma que la API) y el registro del comprobante.
6. **Cambios pequeños en archivos existentes:**
   - `contrato.ts`: bucket «comprobantes».
   - `celular.ts`: `enlaceWa`, compartido con el contacto de CAP-100.
   - `formato.ts`: nombres de los medios nuevos.
   - `Admin.tsx`: la pestaña.
   - `App.tsx`: la ruta.

## Corrección D-02 (17/11, hallada por Andree en CAP-91)

- **El caso:** si una inscripción se cancela con su pago «por verificar», ese pago ahora sigue en la bandeja (lo devuelve CAP-89 con `inscripcion_vigente = false`).
- **En la pantalla:** la tarjeta lo dice junto al evento: «Inscripción cancelada: rechaza el pago y coordina la devolución si hubo cobro».
- **Cambios:** `pagoManual.ts` (el campo y el texto) y `admin/Pagos.tsx`, con 1 prueba nueva.

## Decisiones (para revisar con George en CAP-92)

- **Bucket «comprobantes»:** se agregó al módulo de almacenamiento solo lo que esta pantalla necesita (las reglas y la subida). George eligió hacerlo así el 17/11.
  - En Supabase falta crear el bucket **privado** y leer la captura con un enlace firmado. Como CAPACITRON no usa Supabase Auth, eso necesita una función en el servidor que compruebe la sesión. Es de CAP-92.
  - En modo local todo funciona.
- **QR de Yape:** se guarda en el bucket público «fotos», en la carpeta de la cuenta de administración. Así no hace falta otro bucket y funciona hoy en Supabase. La base guarda la ruta, o una dirección completa si alguien la pone.

## Hallazgos

- **H-01 (bajo, para CAP-92):** la ayuda del campo del QR dice «JPG, PNG o WEBP de hasta 3 MB», porque es el texto fijo de `CampoImagen` (CAP-108). Pero el bucket «fotos» admite 2 MB. Un QR de entre 2 y 3 MB se rechazaría con «El QR pesa … y el límite es 2 MB». Un QR real pesa mucho menos. Si George decide otro bucket para el QR, el texto queda bien.
- **O-01 (anterior a esta tarea, Sprint 1):** en el celular, la fila «Pagado S/ 80.00 con Yape · CP-2026-…» de Mis inscripciones (`FilaPago`) parte el texto y deja el «·» suelto (captura 11). No lo causó CAP-90 y no se tocó; se propone revisarlo en otra tarea.
- **Corregido al probar:** después de guardar la configuración, el formulario seguía mostrando lo escrito («000-0000000-0-00») y no lo guardado. Ahora muestra lo que devuelve la API.

## Capturas (`capturas/`, en la app real, modo local)

| Imagen | Qué muestra |
|---|---|
| `1_admin_configuracion.png` | Administración → Pagos → Configuración, guardada: QR, cuenta y CCI solo con dígitos, «Medios disponibles: 3 de 3» |
| `2_pago_yape.png` | Pantalla de pago con Yape: total, reserva, selector, QR y el formulario |
| `3_pago_transferencia.png` | Banco, cuenta, CCI y titular con «Copiar» |
| `4_pago_whatsapp.png` | El mensaje preparado y «Escribir por WhatsApp» |
| `4b_movil_pago.png` | La pantalla de pago en celular (390 px), sin desplazamiento horizontal |
| `5_registrar_errores.png` | «Enviar para verificar» sin datos: el número de operación y la captura en rojo |
| `6_por_verificar.png` | Después de enviar: «Pago por verificar» |
| `7_admin_bandeja.png` | La bandeja con la captura, la persona, el monto, Yape y la operación |
| `8_admin_rechazo.png` | El diálogo de rechazo con un motivo frecuente elegido |
| `9_rechazado.png` | La persona ve el motivo y «Volver a enviar» |
| `10_aprobado.png` | Después de reenviar y aprobar: «Pago aprobado» con «Descargar comprobante» |
| `11_movil_mis_inscripciones.png` | Mis inscripciones en celular |

- **El QR, la cuenta y el comprobante son de ejemplo:**
  - el QR dice «EJEMPLO — no es un Yape real»;
  - la cuenta y el CCI son ceros;
  - el WhatsApp es 900 000 000;
  - la captura dice «COMPROBANTE DE EJEMPLO — no es una operación real».
- Se usaron las cuentas de demostración «Lucía Mamani» y «Ana Lucía Huamán», solo en localhost.
- El enlace de WhatsApp verificado fue `https://wa.me/51900000000?text=Hola, soy Ana Lucía Huamán Cusi. Quiero pagar mi inscripción en «Curso: Desarrollo web con React y Supabase» (S/ 80.00). …`.

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **SRP** (diap. 39–49) | El pago dejó de vivir dentro de la lista de inscripciones: tiene su pantalla, su lógica (`pagoManual.ts`) y la demostración aparte (`PasarelaSimulada.tsx`). La pestaña de Administración está en su propio archivo. |
| **Strategy y OCP** (diap. 117–125 y 50–63) | Un panel por medio en `PANELES`. Sumar Plin sería una entrada en `MEDIOS_PAGO` y otra en `PANELES`; el resto de la pantalla no cambia. |
| **DIP** (diap. 92–106) | `registrarPagoManual` recibe la API, el almacenamiento y la compresión como contratos. Las pantallas no importan Supabase. |
| **Code smells / duplicación** (diap. 33) | La captura usa el mismo estado de imagen que el perfil y el flyer (`imagenElegida.ts`). El enlace de WhatsApp sale de `enlaceWa` (CAP-100). El número de operación tiene la misma regla que la API. |
| **Adapter** (diap. 126–132) | `PasarelaSimulada.tsx` es el punto donde entraría una pasarela externa. |

## Pruebas (18 nuevas, `tests/cap90-pago-real.test.ts`)

- **Lógica:**
  - estado visible del pago (por verificar, aprobado, rechazado; un intento de la demostración no cuenta);
  - mensaje y enlace de WhatsApp;
  - regla del número de operación;
  - textos vacíos para los paneles.
- **Registrar:**
  - sin datos no llama a la API;
  - una captura de más de 3 MB se rechaza diciendo cuánto pesa;
  - comprime después de validar, sube a la carpeta de la inscripción y manda lo que pide la API.
- **De punta a punta con la base de datos:**
  - registrar, ver en la bandeja y aprobar;
  - rechazar, ver el motivo y reenviar;
  - la pantalla de pago con los datos reales.
- **Pantallas:**
  - cada medio tiene su panel;
  - estado por verificar sin formulario;
  - rechazado con el motivo;
  - la pasarela simulada solo en modo demostración;
  - la lista lleva a la pantalla de pago;
  - la bandeja de Administración;
  - un pago de una inscripción cancelada se ve marcado (D-02).

**Etapa de la tarea** (CAP-89 con la corrección D-02, tu CAP-110 y lo anterior, más solo los archivos de `archivos/`): 493 aprobadas y 3 pendientes. **Cadena completa** (todas las tareas preparadas, hasta CAP-91): 527 aprobadas y 4 pendientes. **`tsc`:** sin errores.

## Rendimiento (`rendimiento.json`)

- **Lo que se descarga al entrar** crece 1,0 KB (3,4 KB con gzip), porque el empaquetador volvió a separar el archivo «ui», que ya se cargaba al inicio.
- **La pantalla de pago** (unos 40 KB con los componentes de CAP-88) solo se descarga al pagar.
- **Mis inscripciones** baja de 33,7 a 16,8 KB.
- **En el celular (390 px)** no hay desplazamiento horizontal.
