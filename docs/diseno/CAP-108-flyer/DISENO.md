# CAP-108 · Diseño del flyer y de la imagen del lugar (HU-20)

**Rol:** Diseño UI/UX (Medaly) · **Historia:** CAP-87 · HU-20 Flyer e imagen del lugar del evento · **Criterios:** CA-01 a CA-03

Este es el diseño que usará José en CAP-110. Los componentes están en `src/components/ImagenEvento.tsx`:

| Componente | Para qué |
|---|---|
| `ImagenEvento` | La imagen en sí, con tres variantes: `tarjeta`, `cabecera` y `lugar`. Es la misma para todo el sistema (cohesión, diap. 26–28). |
| `PortadaTarjeta` | Portada de la fila del catálogo: miniatura del flyer con el día encima, o el bloque de fecha si no hay flyer. |
| `FlyerEvento` | Flyer en la página del evento, arriba del panel de inscripción, con «Ver flyer completo». |
| `ImagenLugar` | Foto del lugar para el hueco `imagen` del bloque de ubicación (CAP-103). |
| `CampoImagen` | Carga en el formulario: vacío, vista previa, cambiar, quitar, error, subiendo y texto alternativo. |
| `TEXTOS_IMAGEN` | Los textos en un solo lugar. |

También se agregó a `BloqueUbicacion` (CAP-103) la prop opcional `imagen`, debajo del mapa.

## Dónde va cada cosa

| Pantalla | Ubicación |
|---|---|
| Catálogo (`Catalogo.tsx`, fila del evento) | `PortadaTarjeta` en lugar de `BloqueFecha`. |
| Página del evento (`EventoDetalle.tsx`) | `FlyerEvento` como primer elemento de la columna lateral, antes del panel de inscripción (CA-03: el visitante lo ve antes del botón). En celular queda arriba del panel. |
| Página del evento, ubicación | `imagen={<ImagenLugar … />}` en `BloqueUbicacion`, debajo del mapa (CA-02). |
| Crear y editar evento (`EditorEvento.tsx`) | Dos `CampoImagen`: «Flyer del evento» después de la descripción y «Imagen del lugar» debajo del selector de ubicación. |

## Estados

Las capturas son de un prototipo. **El flyer y la foto del lugar son dibujos de ejemplo** hechos para el prototipo, y el mapa también es de ejemplo. No son fotos reales.

| # | Estado | Qué ve la persona | Imagen |
|---|---|---|---|
| 1 | Catálogo con y sin flyer | Con flyer: miniatura con «28 nov» encima. Sin flyer: el bloque de fecha de siempre. Los títulos quedan alineados. | `1_catalogo_con_y_sin_flyer.png` |
| 2 | Página del evento | El flyer entero en un panel con «Ver flyer completo», y debajo el panel de inscripción. | `2_evento_flyer_antes_de_inscribirse.png` |
| 3 | Ubicación con mapa e imagen | Mapa, debajo la foto del lugar y después la dirección, la hora y «Cómo llegar». | `3_ubicacion_mapa_e_imagen.png` |
| 4 | Ubicación sin punto | La foto del lugar sola, sin mapa. | `4_ubicacion_imagen_sin_punto.png` |
| 5 | Formulario sin flyer | Recuadro punteado, «Subir imagen», la ayuda y «JPG, PNG o WEBP de hasta 3 MB.». | `5_form_sin_flyer.png` |
| 6 | Vista previa | Miniatura, «Cambiar», «Quitar», el aviso de guardar y el campo de descripción. | `6_form_vista_previa.png` |
| 7 | Archivo rechazado | Recuadro y borde en rojo con el motivo («El flyer pesa 4,2 MB y el límite es 3 MB.»). | `7_form_rechazado.png` |
| 8 | Subiendo (imagen del lugar) | Miniatura 16:9 con «Subiendo…» y las acciones desactivadas. | `8_form_lugar_subiendo.png` |
| 9–11 | Celular (390 px) | Catálogo, página del evento y formulario, sin desplazamiento horizontal. | `9_movil_catalogo.png`, `10_movil_evento.png`, `11_movil_formulario.png` |

## Textos

| Situación | Texto |
|---|---|
| Formatos | JPG, PNG o WEBP de hasta 3 MB. |
| Ayuda del flyer | Se muestra en el catálogo y en la página del evento. Se ve entero, sin recortes. |
| Ayuda de la imagen del lugar | Una foto del auditorio o de la entrada ayuda a llegar. Se muestra junto al mapa. |
| Descripción | Descripción para quien no puede ver la imagen |
| Ejemplo de descripción (flyer) | Por ejemplo: Afiche del taller con el título, la fecha y los ponentes |
| Ejemplo de descripción (lugar) | Por ejemplo: Entrada del auditorio de Ingeniería, junto al estacionamiento |
| Vista previa | Vista previa: se guarda al guardar el evento. |
| Página del evento | Ver flyer completo |

## Decisiones

- **El flyer se ve entero.** Un flyer tiene texto, así que se usa `object-contain` sobre un fondo neutro; recortarlo podría dejar fuera la fecha o el lugar. La foto del lugar sí se recorta (`object-cover`), porque es una escena.
- **Sin imagen no se inventa una.** En el catálogo queda el bloque de fecha de siempre. En la página del evento, sin flyer no se muestra nada, y sin foto del lugar el bloque de ubicación queda como en CAP-103.
- **La fecha no se pierde en el catálogo.** La miniatura lleva el día encima y mide lo mismo que el bloque de fecha, así las filas siguen alineadas.
- **El flyer va antes del botón de inscripción** (CA-03). Es lo primero de la columna lateral; en celular, lo primero después del título.
- **Proporciones fijas:** 4:5 para el flyer y 16:9 para el lugar. La página no salta mientras carga la imagen, que se carga en diferido (`loading="lazy"`).

## Accesibilidad

- Cada imagen lleva texto alternativo. El formulario pide la descripción en cuanto hay imagen, con un ejemplo. Si la organizadora no escribe nada, se usa el nombre («Flyer del evento», «Imagen del lugar»); nunca queda vacío.
- La miniatura del formulario es decorativa (`alt=""`): la descripción está en el campo de al lado.
- El botón de subir es un `<label>` con el `input type="file"` dentro, así funciona con teclado y lector de pantalla. La ayuda y el error están unidos al campo con `aria-describedby`, y el error se anuncia con `role="alert"`.
- Mientras sube, el grupo queda `aria-busy` y el campo de archivo se desactiva.
- «Ver flyer completo» abre la imagen en otra pestaña (`rel="noreferrer"`) para hacer zoom en el celular.

## Qué no incluye

- Subir el archivo, validar tipo y tamaño (3 MB) y guardar la ruta: CAP-109 (Carlos) con el módulo de almacenamiento de CAP-97.
- Conectar los componentes en las pantallas: CAP-110 (José).

Estos componentes reciben la dirección de la imagen, lo elegido, el error y la descripción, y solo los muestran.
