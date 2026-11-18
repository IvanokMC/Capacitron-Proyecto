# CAP-88 · HU-16 Diseño del flujo de pago real

**Documentación de la tarea** · Rol: Diseño UI/UX (Medaly) · Sprint 2 · Cronograma: n.° 20

**Tarea:** HU-16 · Diseño del flujo de pago real y de la bandeja de verificación · **Responsable:** Medaly (Diseño UI/UX) · **Historia:** CAP-83 (HU-16), criterios **CA-01 a CA-04 y CA-06**.

## Qué se entrega

1. **Prototipo de 12 estados** en `docs/diseno/CAP-88-pago-real/` (también en `capturas/`):
   - Yape, transferencia y WhatsApp;
   - registrar el pago, y el error al registrar;
   - los tres estados del pago;
   - la bandeja de la administración, el rechazo con motivo y la configuración;
   - tres vistas en celular.

   **El QR, el comprobante y los datos de la cuenta son de ejemplo.** El QR lo generó la librería `qrcode` con un texto que dice que no es real. **El número de WhatsApp de la organización aún no está definido** (lo define el equipo en CAP-92).
2. **Ficha de diseño** (`DISENO.md`): dónde va cada cosa, estados, textos, decisiones y accesibilidad.
3. **Componentes en `src/components/PagoReal.tsx`**, listos para CAP-90 (José):
   - **`MEDIOS_PAGO`** y un panel por medio (Strategy, OCP): sumar un medio es agregar una entrada.
     - `PanelYape`: el QR, el monto y el titular.
     - `PanelTransferencia`: banco, cuenta, CCI y titular, con «Copiar».
     - `PanelWhatsapp`: muestra el mensaje preparado antes de abrir WhatsApp.
     - Si un medio no está configurado, lo dice.
   - **`SelectorMedioPago`:** tarjetas accesibles (grupo de radio).
   - **`FormComprobante`:** número de operación y captura del comprobante, con el `CampoImagen` de tu CAP-108, sin descripción pública porque es privada.
   - **`EstadoPago`:** por verificar (ámbar), aprobado (verde) y rechazado (rojo) con el motivo y «Volver a enviar».
   - **`BandejaPagos`** y **`FormRechazo`:** la administración ve la captura, aprueba o rechaza con un motivo, con tres motivos frecuentes para elegir con un toque.
   - **`FormConfigPagos`:** QR, titular de Yape, banco, titular, cuenta, CCI y WhatsApp.
4. **`CampoImagen`** (tu CAP-108) acepta `conDescripcion` para imágenes privadas.

**No incluye:**
- Guardar, aprobar y rechazar el pago, y los correos: CAP-89 (Carlos).
- Las pantallas, el enlace de WhatsApp y copiar al portapapeles: CAP-90 (José).
- El bucket privado de comprobantes y el número de WhatsApp: CAP-92 (George).

## Archivos

| Archivo | Cambio |
|---|---|
| `src/components/PagoReal.tsx` | Nuevo: medios de pago, paneles, registro del pago, estados, bandeja, rechazo y configuración |
| `src/components/ImagenEvento.tsx` | Modificado (tu CAP-108): `CampoImagen` acepta `conDescripcion` para imágenes privadas |
| `tests/cap88-pago-diseno.test.ts` | Nuevo: 12 pruebas de los estados del diseño |
| `docs/diseno/CAP-88-pago-real/DISENO.md` | Nuevo: ficha del diseño |
| `docs/diseno/CAP-88-pago-real/*.png` | Nuevas: 12 capturas del prototipo |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Separación de responsabilidades** (diap. 6 y 19) | El pago es una pantalla propia, separada de la lista de inscripciones. Es lo que pide la tarea. |
| **OCP y Strategy** (diap. 50–63 y 117–125) | Los medios están en `MEDIOS_PAGO` y cada uno tiene su panel. Agregar Plin no toca el selector ni la pantalla. |
| **Cohesión** (diap. 26–28) | Piezas visuales reutilizables; la captura usa el mismo `CampoImagen` del flyer. |
| **SRP** (diap. 39–49) | Los componentes solo muestran; la lógica del pago es de CAP-89 y CAP-90. |
| **Refactorizar con pruebas** (diap. 140) | 12 pruebas fijan cada estado. |

## Resultado de las pruebas

- Pruebas del diseño: **12 aprobadas**.
- Sobre `main` con tus CAP-103 y CAP-108: **120 aprobadas**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: 423 aprobadas y 3 pendientes. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **JS:** 0,0 KB, sin cambio: los componentes aún no se usan en ninguna pantalla.
- **CSS:** 1,2 KB más, por las clases nuevas.
- **Consultas:** sin cambios.
