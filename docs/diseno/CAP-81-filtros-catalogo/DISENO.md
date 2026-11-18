# CAP-81 · Filtros del catálogo y estado sin resultados (HU-15)

**Rol:** Diseño UI/UX (Medaly) · **Historia:** CAP-75 · HU-15 Búsqueda y filtro de eventos · **Criterios:** CA-03 a CA-05

Panel de búsqueda del catálogo público (`/`). La búsqueda la hace la función `catalogo_eventos` de CAP-80 (Carlos). Esta tarea agrega los controles, las fichas de los filtros activos y el estado vacío.

| Archivo | Qué hace |
|---|---|
| `src/lib/filtrosCatalogo.ts` | Lógica sin pantalla: parámetros para la API, fichas activas, validación del rango y lectura y escritura en la dirección. |
| `src/components/FiltrosCatalogo.tsx` | `PanelFiltros`, `BarraFiltros` y `SinResultados`. |
| `src/components/ui.tsx` | `FichaQuitable` (nuevo): ficha con su botón «x», sirve para cualquier lista filtrable. |
| `src/pages/Catalogo.tsx` | Une las piezas y consulta la API. |

## Estructura del panel

| Fila | Contenido | Por qué |
|---|---|---|
| 1 | Buscador de texto y modalidad (Todas, Presencial, Virtual, Mixta) | Es lo que más se usa. «Virtual» del CA-03 es la modalidad. |
| 2 | Tipo, Precio, Desde, Hasta, Ubicación | Filtros finos. Cada uno tiene su etiqueta visible: un campo de fecha sin etiqueta no dice si es «desde» o «hasta». |
| 3 | «Incluir finalizados» | Amplía la lista en vez de acotarla, por eso va aparte y no genera ficha. |
| Debajo | Total de eventos, una ficha por filtro y «Limpiar filtros» | Muestra que los filtros se combinan (CA-03) y deja quitar uno solo. |

En celular (390 px) la fila 2 pasa a dos columnas y la ubicación ocupa el ancho completo. No hay desplazamiento horizontal.

## Estados

| # | Estado | Qué ve la persona | Imagen |
|---|---|---|---|
| 1 | Sin filtros | Panel vacío y el total («5 eventos»). Sin iniciar sesión. | `1_catalogo_panel.png` |
| 2 | Filtros combinados | Texto «inteligencia» y tipo Seminario: fichas ««inteligencia»» y «Seminario», «1 evento» y «Limpiar filtros». La dirección queda `/?q=inteligencia&tipo=seminario`. | `2_filtros_combinados.png` |
| 3 | Rango al revés | «Hasta» en rojo con «La fecha final no puede ser anterior a la inicial.». No se consulta con esas fechas. | `3_rango_invalido.png` |
| 4 | Sin resultados (CA-04) | «No se encontraron eventos», «Limpiar filtros» y, si los finalizados están ocultos, «Ver también finalizados». | `4_sin_resultados.png` |
| 5 | Celular | Panel en dos columnas, ficha «Curso» y la lista. | `5_movil.png` |
| 6 | Después de «Limpiar filtros» | Vuelve el catálogo completo y la dirección queda en `/`. | `6_tras_limpiar.png` |

Las capturas son de la app en modo local, como visitante sin sesión. Los eventos de demostración no traen tipo, así que solo para las capturas se les puso uno según su nombre (Taller → taller, Curso o Webinar → curso, el resto → seminario). Ese cambio no está en el código entregado.

## Textos

| Situación | Texto |
|---|---|
| Buscador | Buscar por tema u organizador |
| Ubicación | Auditorio, pabellón o ciudad |
| Rango al revés | La fecha final no puede ser anterior a la inicial. |
| Sin resultados (título) | No se encontraron eventos |
| Sin resultados (detalle) | Ningún evento publicado cumple todos los filtros a la vez. Prueba con otra palabra o quita alguno. |
| Catálogo vacío sin filtros | Todavía no hay eventos publicados |
| Fichas | «texto», Seminario, Virtual, De pago, Del 20/11/2026 al 05/12/2026, Desde el 20/11/2026, En Perayoc |
| Botón de cada ficha (lector de pantalla) | Quitar filtro: Seminario |

## Decisiones

- **Los filtros viven en la dirección (CA-05).** No se usa localStorage, cookies ni la base de datos: buscar no deja rastro del visitante. A cambio, el enlace se puede compartir y al volver del detalle de un evento el catálogo sigue filtrado. Un valor inventado en la dirección (`?tipo=fiesta`) se ignora.
- **El rango se valida antes de consultar.** CAP-80 rechaza el rango al revés. Aquí se avisa junto al campo y se sigue mostrando el último resultado válido, en vez de un error general.
- **Solo lo escrito espera.** El buscador y la ubicación esperan 250 ms a que la persona termine; los selectores y las fechas consultan al instante.
- **«Limpiar filtros» aparece con dos fichas o más.** Con una sola basta su «x». En el estado vacío siempre aparece, porque es la salida principal (CA-04).
- **Accesibilidad.** El panel tiene `role="search"`, el total se anuncia con `aria-live="polite"`, cada «x» dice qué quita y el campo con error queda con `aria-invalid`.

## Teoría aplicada

| Principio | Dónde |
|---|---|
| Separación de responsabilidades (diap. 6, 19) y SRP (diap. 39–49) | La lógica está en `lib/filtrosCatalogo.ts`; los componentes solo dibujan. |
| Cohesión (diap. 26–28) | Las tres piezas de `FiltrosCatalogo.tsx` tratan solo de filtrar el catálogo. |
| Bajo acoplamiento (diap. 29–35) | Los componentes reciben el estado por props; no llaman a la API ni leen la dirección. |
| Encapsulación (diap. 20–24) | La pantalla no conoce los nombres de la dirección ni cómo se validan. |
| Abstracción (diap. 13–16) | `FichaQuitable` no sabe de eventos. |
| Refactorizar con pruebas (diap. 140) | `tests/cap81-filtros-catalogo.test.ts`, 19 pruebas. |
