# CAP-88 · Diseño del pago real y de la bandeja de verificación (HU-16)

**Rol:** Diseño UI/UX (Medaly) · **Historia:** CAP-83 · HU-16 Pago real con verificación manual · **Criterios:** CA-01 a CA-04 y CA-06

Este es el diseño que usará José en CAP-90. Los componentes están en `src/components/PagoReal.tsx`, hechos con los de `ui.tsx`:

| Componente | Para qué |
|---|---|
| `MEDIOS_PAGO` | Los tres medios en un solo lugar (OCP): sumar Plin sería agregar una entrada. |
| `SelectorMedioPago` | Tarjetas para elegir Yape, Transferencia o WhatsApp (CA-01). |
| `PanelYape`, `PanelTransferencia`, `PanelWhatsapp` | Un panel por medio (Strategy). |
| `FormComprobante` | Número de operación y captura del comprobante (CA-02). Usa el `CampoImagen` de CAP-108, sin descripción pública porque la captura es privada. |
| `EstadoPago` | Por verificar, aprobado y rechazado con su motivo (CA-02 a CA-04). |
| `BandejaPagos` | Pagos por verificar en Administración, con aprobar y rechazar (CA-03, CA-04 y CA-06). |
| `FormRechazo` | Motivo del rechazo con motivos frecuentes (va dentro del `Dialogo` de `ui.tsx`). |
| `FormConfigPagos` | QR de Yape, cuenta, CCI, titular y WhatsApp (CA-06). |
| `TEXTOS_PAGO` | Los textos en un solo lugar. |

A `CampoImagen` (CAP-108) se le agregó `conDescripcion`: es verdadera por defecto y falsa para imágenes privadas.

## Dónde va cada cosa

| Pantalla | Ubicación |
|---|---|
| Mis inscripciones | Una inscripción «pendiente de pago» abre la pantalla de pago propia (separada de la lista): la reserva, el selector, el panel del medio y debajo el registro del pago. Después del envío se ve `EstadoPago`. |
| Administración → pestaña «Pagos» | `BandejaPagos`; «Rechazar» abre un `Dialogo` con `FormRechazo`. |
| Administración → «Pagos» → «Configuración» | `FormConfigPagos`. |

## Estados

Las capturas son de un prototipo. **El QR, el comprobante y los datos de la cuenta son de ejemplo:** el QR lo generó la librería `qrcode` con un texto que dice que no es real, y la cuenta usa ceros. **El número de WhatsApp de la organización aún no está definido** (lo define el equipo en CAP-92).

| # | Estado | Qué ve la persona | Imagen |
|---|---|---|---|
| 1 | Yape | Reserva vigente, selector con Yape marcado, el QR y «Paga S/ 80.00 a …». | `1_medio_yape.png` |
| 2 | Transferencia | Banco, número de cuenta, CCI y titular, con «Copiar». | `2_medio_transferencia.png` |
| 3 | WhatsApp | El mensaje preparado (nombre, evento y monto) y el botón verde «Escribir por WhatsApp». | `3_medio_whatsapp.png` |
| 4 | Registrar el pago | Número de operación, captura con vista previa y «Enviar para verificar». | `4_registrar_pago.png` |
| 5 | Error al registrar | Falta el número y la captura: los dos en rojo con su motivo. | `5_registrar_error.png` |
| 6 | Estados del pago | Por verificar (ámbar), aprobado (verde) y rechazado (rojo) con el motivo y «Volver a enviar». | `6_estados_del_pago.png` |
| 7 | Bandeja de la administración | Una tarjeta por pago con la captura, la persona, el evento, el monto, el medio, la operación, aprobar y rechazar. | `7_admin_bandeja.png` |
| 8 | Rechazar | Motivo con tres motivos frecuentes para elegir con un toque. | `8_admin_rechazo.png` |
| 9 | Configuración | QR, titular de Yape, banco, titular, cuenta, CCI y WhatsApp. | `9_admin_configuracion.png` |
| 10–12 | Celular (390 px) | Yape, registrar el pago y la bandeja, sin desplazamiento horizontal. | `10_movil_yape.png`, `11_movil_registrar.png`, `12_movil_bandeja.png` |

## Textos

| Situación | Texto |
|---|---|
| Título | Paga tu inscripción |
| Reserva | Tu cupo está reservado hasta las 18:40 h. |
| Número de operación | Aparece en la constancia de Yape o de tu banco. |
| Captura | Solo la ven tú y la administración. |
| Botón | Enviar para verificar |
| Por verificar | La administración revisará tu comprobante. Te avisaremos por correo; tu cupo sigue reservado. |
| Aprobado | Tu inscripción está confirmada. Te enviamos el comprobante por correo. |
| Rechazado | Puedes volver a enviar el comprobante mientras dure la reserva. |
| Medio sin configurar | La organización todavía no configuró este medio de pago. |
| Motivos frecuentes | El monto no coincide con el costo del evento. · No encontramos la operación en nuestra cuenta. · La captura no se lee bien. |

## Decisiones

- **El pago es una pantalla propia** (separación de responsabilidades, diap. 6 y 19): ya no vive dentro de la lista de inscripciones.
- **La reserva siempre a la vista:** «Tu cupo está reservado hasta las …», porque al vencer se libera (CA-05).
- **El monto y el titular en cada medio**, para que la persona compruebe a quién paga antes de hacerlo.
- **«Copiar»** en la cuenta y el CCI: en el celular nadie quiere tipear 20 dígitos.
- **WhatsApp muestra el mensaje antes de abrirlo**, para que la persona sepa qué se enviará.
- **Rechazo con motivos frecuentes:** la administración responde rápido y con textos claros; el motivo lo ve la persona (CA-04).
- **Colores de estado del sistema:** ámbar = esperando, verde = listo, rojo = hay que hacer algo.

## Accesibilidad

- El selector es un grupo de radio (`role="radiogroup"`, `aria-checked`).
- El QR lleva descripción («Código QR de Yape de …»).
- Los botones «Copiar» dicen qué copian.
- `EstadoPago` es `role="status"`: se anuncia al cambiar.
- Los errores se anuncian con `role="alert"`.
- En la bandeja, la miniatura del comprobante es un enlace con nombre («Ver comprobante de …»).

## Qué no incluye

- Guardar el pago, aprobarlo, rechazarlo, los correos y la configuración: CAP-89 (Carlos).
- Conectar las pantallas, armar el enlace de WhatsApp y copiar al portapapeles: CAP-90 (José).
- El bucket privado de comprobantes y el número de WhatsApp: CAP-92 (George).
- El límite de la captura (el texto dice 3 MB, como el flyer): confirmarlo en CAP-92.
