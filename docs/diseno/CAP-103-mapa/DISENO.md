# CAP-103 · Diseño del mapa del evento y del selector de ubicación (HU-19)

**Rol:** Diseño UI/UX (Medaly) · **Historia:** CAP-86 · HU-19 Mapa con la ubicación y la hora del evento · **Criterios:** CA-01 a CA-04

Este es el diseño que usará José en CAP-105. Los componentes están en `src/components/UbicacionEvento.tsx`:

| Componente | Para qué |
|---|---|
| `BloqueUbicacion` | Página del evento: el mapa con el punto, la dirección, la fecha y hora de inicio, y «Cómo llegar». |
| `SelectorUbicacion` | Formulario de crear y editar evento: buscar la dirección o tocar el mapa. |
| `MarcoMapa` | Marco común del mapa (proporción 16:10, bordes, instrucción encima). |
| `textoPunto` | Coordenadas legibles: «13,5208° S · 71,9584° O». |
| `TEXTOS_UBICACION` | Los textos en un solo lugar. |

**El mapa entra por un hueco.** Los componentes reciben el mapa en la prop `mapa` y no conocen Leaflet ni OpenStreetMap. CAP-105 pone ahí el mapa real, como propone la historia: Leaflet con OpenStreetMap, sin clave ni costo. Si mañana se cambia de proveedor, el diseño no se toca (DIP y Adapter, diap. 92–106 y 126–132).

## Dónde va cada cosa

| Pantalla | Ubicación |
|---|---|
| Página del evento (`EventoDetalle.tsx`) | En la columna lateral, debajo del panel de inscripción. En celular, después del panel. |
| Crear y editar evento (`EditorEvento.tsx`) | Reemplaza el campo «Lugar» cuando la modalidad es presencial o mixta. Con «Virtual» no aparece. |

## Estados

Las capturas son de un prototipo con un **mapa de ejemplo dibujado** (dice «Mapa de ejemplo» en la esquina). El mapa real lo pone CAP-105. Las coordenadas de las imágenes también son de ejemplo.

| # | Estado | Qué ve la persona | Imagen |
|---|---|---|---|
| 1 | Evento con punto | Mapa con el marcador, la dirección, «martes, 24 de noviembre de 2026, empieza a las 15:00 h» y el botón «Cómo llegar» (CA-02 y CA-03). | `1_evento_con_punto.png` |
| 2 | Evento sin punto marcado | La dirección y la fecha, sin mapa ni botón, con el aviso «El organizador todavía no marcó el lugar en el mapa.». | `2_evento_sin_punto.png` |
| 3 | Evento virtual | No aparece el bloque (CA-04). | `3_evento_virtual.png` |
| 4 | Formulario sin punto | Campo de lugar con lupa, la ayuda y, sobre el mapa, «Toca el mapa para marcar el lugar» (CA-01). | `4_form_sin_punto.png` |
| 5 | Sugerencias al escribir | Lista de direcciones debajo del campo; al elegir una se llena el texto y se marca el punto. | `5_form_sugerencias.png` |
| 6 | Dirección no encontrada | «No encontramos esa dirección. Prueba con el nombre del local o toca el mapa.» | `6_form_sin_resultados.png` |
| 7 | Punto marcado | Marcador en el mapa y la franja verde «Punto marcado: 13,5208° S · 71,9584° O» con «Quitar punto». | `7_form_punto_marcado.png` |
| 8 | Error del punto | Mapa con borde rojo y el mensaje debajo (por ejemplo, coordenadas fuera de rango, CA-05). | `8_form_error.png` |
| 9–11 | Celular (390 px) | El bloque del evento y el formulario ocupan el ancho; los nombres largos se cortan con «…». | `9_movil_evento.png`, `10_movil_sugerencias.png`, `11_movil_formulario.png` |

## Textos

| Situación | Texto |
|---|---|
| Ayuda del campo | Escribe la dirección y elige una sugerencia, o toca el mapa para marcar el punto exacto. |
| Instrucción sobre el mapa | Toca el mapa para marcar el lugar |
| Buscando | Buscando… |
| Sin resultados | No encontramos esa dirección. Prueba con el nombre del local o toca el mapa. |
| Punto marcado | Punto marcado: 13,5208° S · 71,9584° O |
| Quitar | Quitar punto |
| Evento sin punto | El organizador todavía no marcó el lugar en el mapa. |
| Botón | Cómo llegar |

## Decisiones

- **Un solo campo para escribir y buscar.** El texto del lugar es el mismo campo que busca, así la organizadora no llena dos cosas. Tocar el mapa mueve el punto sin borrar lo escrito: la dirección que ve el público es la que escribió.
- **Coordenadas con hemisferio.** «-13,5208, -71,9584» con coma decimal se confunde con cuatro números; «13,5208° S · 71,9584° O» no. Cuatro decimales equivalen a unos 11 m, suficiente para encontrar un auditorio.
- **Sin punto no hay botón.** «Cómo llegar» solo aparece si hay coordenadas; con solo una dirección escrita, Google Maps podría llevar a otro lugar con un nombre parecido.
- **La fecha va junto al lugar.** La historia pide saber dónde y a qué hora empieza antes de inscribirse; se repite aquí aunque esté en el panel, porque en celular el bloque queda lejos.
- **Evitar sobreingeniería** (diap. 135–139): un punto, una dirección y un botón. Sin rutas, capas, varios puntos ni estilos de mapa propios.

## Accesibilidad

- El campo de lugar es un `combobox` con su lista `listbox`; cada sugerencia es una `option` con un botón.
- La ayuda está unida al campo con `aria-describedby`; un error del lugar la reemplaza y se anuncia con `role="alert"`.
- «Buscando…» y «No encontramos…» se anuncian con `aria-live`.
- El error del punto se anuncia con `role="alert"` y marca el borde del mapa en rojo con un halo.
- «Cómo llegar» dice a dónde lleva y que abre otra pestaña («Cómo llegar a … (abre Google Maps en otra pestaña)»), con `rel="noreferrer"`.
- La instrucción sobre el mapa no capta los toques (`pointer-events: none`), para no tapar el punto que se quiere marcar.
- En celular no hay desplazamiento horizontal. Un `fieldset` no se encoge por debajo de su contenido, así que lleva `min-w-0`, y la lista de sugerencias lleva `contain: inline-size`.

## Qué no incluye

- El mapa real con Leaflet, buscar las direcciones y armar el enlace de Google Maps: CAP-105 (José).
- Guardar la latitud y la longitud y rechazar las que estén fuera de rango: CAP-104 (Carlos).

Estos componentes reciben el mapa, las sugerencias, el punto, el enlace y los errores, y solo los muestran.
