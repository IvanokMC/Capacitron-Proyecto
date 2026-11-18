# HU-20 · Plan y resultado de pruebas

**Historia:** CAP-87 · HU-20 Flyer e imagen del lugar del evento · **Tarea:** CAP-111 · **Responsable:** Andree (Product Owner y QA)

> Como organizadora de eventos, quiero subir el flyer del evento y una imagen del lugar, para que los asistentes sepan de qué trata y dónde será antes de inscribirse.

## 1. Alcance

| Pieza | Tarea | Qué prueban sus pruebas |
|---|---|---|
| Diseño del flyer y de la imagen | CAP-108 (Medaly) | Variantes de la imagen, portada de la tarjeta y estados del campo de carga |
| Rutas y descripciones en la base de datos | CAP-109 (Carlos) | `guardar_imagenes_evento`: solo el dueño, carpeta del evento, quitar, evento cancelado |
| Bucket y compresión | CAP-112 (George) | Reglas del bucket «eventos» (3 MB, JPG/PNG/WEBP), políticas y compresión |
| Pantallas | CAP-110 (José) | Elegir, subir y mostrar en el formulario, el catálogo y la página del evento |
| Historia completa | CAP-111 (Andree) | CA-01 a CA-05 de punta a punta: elegir → subir → guardar la ruta → catálogo y página del visitante |

## 2. Entorno

- **Automáticas:** `npx vitest run`.
  - La base es PGlite con las mismas migraciones que Supabase.
  - El almacenamiento es el local, con la misma interfaz que Supabase Storage (CAP-97).
  - Las pantallas se dibujan con lo que devuelve la base, como las ve un visitante sin sesión.
  - La compresión (canvas) y el mapa (Leaflet) necesitan un navegador: en estas pruebas se reemplazan. La compresión se midió en Chrome en CAP-112.
- **Manuales:** `npm run dev` en computadora y en un **celular real**, con «Jorge Paredes» o «Carmen Valdivia» (organizadores) y una ventana sin sesión (visitante). Para M-09 hace falta Supabase con la migración del bucket ejecutada.

## 3. Matriz de trazabilidad

| Criterio | CAP-111 (aceptación) | También lo prueban | Resultado |
|---|---|---|---|
| **CA-01** El flyer JPG, PNG o WEBP de hasta 3 MB se guarda y se ve en el catálogo y en la página | 5 pruebas | CAP-108, CAP-109, CAP-110 | Cumple |
| **CA-02** La imagen del lugar se ve junto al mapa, si existe | 2 pruebas | CAP-108, CAP-110 | Cumple |
| **CA-03** El visitante sin sesión ve el flyer y la imagen antes del botón | 2 pruebas | CAP-109, CAP-110, CAP-112 | Cumple |
| **CA-04** Otro tipo o más de 3 MB se rechaza con el motivo | 3 pruebas | CAP-110, CAP-112 | Cumple (ver D-01) |
| **CA-05** Solo el organizador sube, cambia o quita | 4 pruebas | CAP-109 | Cumple |
| Un evento sin imágenes se ve bien | 1 prueba | CAP-108 | Cumple |

**Resultado automático del paquete (17/11/2026):** 17 pruebas de aceptación aprobadas. `npx tsc --noEmit` sin errores.

**Verificación de esta rama (18/11/2026):** la suite CAP-111 no pudo cargar y ejecutó 0 pruebas porque faltan `src/lib/imagenElegida` y `src/lib/imagenesEvento` de CAP-110. `npm test` terminó con 121 pruebas aprobadas y una suite fallida por esos módulos; `npx tsc --noEmit` reportó los mismos dos módulos ausentes.

## 4. Casos manuales

Los ejecuta Andree antes de aceptar la historia. **M-06 a M-08 van en un celular real.** Las capturas de CAP-110 muestran lo esperado.

| N.° | Criterio | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|
| M-01 | CA-01 | Como organizador, editar un evento, elegir en «Flyer del evento» un JPG o PNG de menos de 3 MB, escribir la descripción y guardar. | Se ve la vista previa; al guardar, el flyer aparece en la fila del catálogo con el día encima y en la página del evento. | Cumple |
| M-02 | CA-04 | Elegir una foto de más de 3 MB. | «El flyer pesa … MB y el límite es 3 MB.» en rojo; no se pierde lo elegido antes. | Cumple |
| M-03 | CA-04 | Elegir un GIF o un PDF. | «El flyer debe ser una imagen JPG, PNG o WEBP.» | Cumple |
| M-04 | CA-02 | Subir una imagen del lugar en un evento con punto en el mapa. | En la página, la imagen queda debajo del mapa y antes de «Cómo llegar». | Cumple |
| M-05 | CA-03 | Cerrar la sesión y abrir el catálogo y la página del evento. | El flyer y la imagen se ven; el flyer está antes de «Ingresa para inscribirte». | Cumple |
| M-06 | Celular | Abrir el catálogo y la página del evento en el celular. | Sin desplazamiento horizontal; el día se lee sobre la miniatura; «Ver flyer completo» abre la imagen para hacer zoom. | Cumple |
| M-07 | CA-01 (celular) | Desde el celular, subir como flyer una foto tomada con la cámara (si pesa menos de 3 MB). | Se acepta, y al guardar pesa mucho menos (WEBP). Anotar el tamaño original y el guardado. | Cumple |
| M-08 | Accesibilidad (celular) | Con el lector de pantalla del celular (TalkBack o VoiceOver), recorrer la página del evento. | Lee la descripción del flyer y de la imagen del lugar; si no hay, «Flyer de <nombre del evento>». | Cumple |
| M-09 | CA-01 y CA-03 (Supabase) | Con Supabase y la migración del bucket ejecutada, subir un flyer y abrir la página sin sesión desde otra computadora. | La imagen carga desde `…/storage/v1/object/public/eventos/<id del evento>/…`. | Cumple |
| M-10 | CA-05 | Como otro organizador, abrir la edición del evento de Jorge por su dirección (`/organizador/eventos/<id>/editar`). | No puede editarlo ni cambiar sus imágenes. | Cumple |

**Nota:** M-01 a M-10 se registran según la validación manual reportada por el equipo. El detalle de evidencias se mantiene en otras ramas y no se replica aquí, según indicación.

## 5. Hallazgos y decisiones

| N.° | Tipo | Hallazgo | Evidencia | Propuesta |
|---|---|---|---|---|
| D-01 | Decisión del PO | Se mantiene el CA-04 tal como está escrito: los archivos de más de 3 MB se rechazan; no se cambia a aceptar y reducir fotos más pesadas. | Prueba de CA-04 «3 MB y 1 byte»; `imagenesEvento.ts`. | Mantener el rechazo antes de subir/comprimir. |
| H-01 | Resuelto en CAP-110 | En la fila del catálogo, el día de `PortadaTarjeta` (CAP-108) quedaba debajo de la miniatura (escritorio) o a lo ancho de la fila (celular). | Visto en las capturas de CAP-110. | Ya corregido en `Catalogo.tsx`. Se propone a Medaly moverlo dentro del componente. |
| O-01 | Observación | Al cambiar o quitar un flyer, el archivo anterior queda en el bucket: no hay borrado, a propósito, para que nadie altere una imagen ya publicada. | Prueba «el anterior no se reemplaza». | Aceptable para la historia. Limpiar archivos sin uso queda como mejora (CAP-112 ya lo anota). |
| O-02 | Observación | El bucket deja subir archivos sueltos a la carpeta de cualquier evento, porque CAPACITRON no usa Supabase Auth. No se muestran en ningún lado: qué imagen se ve lo decide `guardar_imagenes_evento`, que exige ser el dueño. | Migración de CAP-112, riesgo documentado. | Aceptable; revisar si se activa Supabase Auth. |
| O-03 | Observación | Si al crear un evento **nuevo** falla la subida de la imagen, el evento queda guardado y se abre su edición, pero hay que volver a elegir la imagen. | `EditorEvento.tsx` (CAP-110), con aviso «El evento se guardó, pero no las imágenes». | Aceptable; el aviso lo explica. |

## 6. Decisión de aceptación

La toma Andree como Product Owner después de los casos manuales y de decidir D-01.

| Fecha | Decisión | Observaciones |
|---|---|---|
| 18/11/2026 | Aceptada | M-01 a M-10 cumplen según la validación manual reportada por el equipo. Se mantiene D-01: se rechazan archivos mayores a 3 MB. |
