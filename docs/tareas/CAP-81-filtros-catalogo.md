# CAP-81 · HU-15 Filtros en el catálogo y estado sin resultados

**Documentación de la tarea** · Rol: Diseño UI/UX (Medaly) · Sprint 2 · Cronograma: n.° 08

**Tarea:** HU-15 · Filtros en el catálogo y estado sin resultados · **Responsable:** Medaly (Diseño UI/UX) · **Historia:** CAP-75 (HU-15 Búsqueda y filtro de eventos), criterios **CA-03 a CA-05**.

## Qué se entrega

1. **Panel de filtros del catálogo** (`/`), que funciona sin iniciar sesión:
   - fila 1: buscador de texto y modalidad (Todas, Presencial, Virtual, Mixta);
   - fila 2: tipo (seminario, congreso, taller o curso), precio, desde, hasta y ubicación, cada uno con su etiqueta visible;
   - «Incluir finalizados».
2. **Barra de fichas:** el total de eventos y una ficha por filtro activo, cada una con su «x». Con dos fichas o más aparece «Limpiar filtros» (CA-03: los filtros se combinan y se ven).
3. **Estado sin resultados (CA-04):** «No se encontraron eventos», con «Limpiar filtros» y, si los finalizados están ocultos, «Ver también finalizados». Sin filtros, el catálogo vacío dice «Todavía no hay eventos publicados».
4. **Rango de fechas al revés:** el campo «Hasta» se marca en rojo con «La fecha final no puede ser anterior a la inicial.» y no se consulta con esas fechas. Así no aparece el error general de la base de datos.
5. **Privacidad (CA-05):** los filtros se guardan solo en la dirección de la página (`/?tipo=taller&desde=…`). No se usa localStorage, cookies ni la base de datos. Además, el enlace se puede compartir y al volver del detalle de un evento el catálogo sigue filtrado.
6. **`FichaQuitable` en `ui.tsx`:** ficha con botón para quitarla, que sirve para cualquier lista filtrable.
7. **Ficha de diseño** (`docs/diseno/CAP-81-filtros-catalogo/DISENO.md`) con la estructura, los estados, los textos y las decisiones.

**No incluye:** la búsqueda en la base de datos (CAP-80, Carlos, ya preparada) ni las pruebas de aceptación de la historia (CAP-82, Andree).

## Archivos

| Archivo | Cambio |
|---|---|
| `src/lib/filtrosCatalogo.ts` | Nuevo: lógica de los filtros (parámetros, fichas, rango y dirección de la página) |
| `src/components/FiltrosCatalogo.tsx` | Nuevo: panel de filtros, barra de fichas y estado «No se encontraron eventos» |
| `src/components/ui.tsx` | Modificado: `FichaQuitable` nuevo |
| `src/pages/Catalogo.tsx` | Modificado: usa el panel nuevo y guarda los filtros en la dirección |
| `tests/cap81-filtros-catalogo.test.ts` | Nuevo: 19 pruebas |
| `docs/diseno/CAP-81-filtros-catalogo/DISENO.md` | Nuevo: ficha del diseño |
| `docs/diseno/CAP-81-filtros-catalogo/*.png` | Nuevas: 6 capturas de la app |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Separación de responsabilidades** (diap. 6 y 19) y **SRP** (diap. 39–49) | La lógica de los filtros está en `lib/filtrosCatalogo.ts`; los componentes solo dibujan. Por eso se prueba sin navegador. |
| **Cohesión** (diap. 26–28) | Las tres piezas de `FiltrosCatalogo.tsx` tratan solo de filtrar el catálogo. |
| **Bajo acoplamiento** (diap. 29–35) | Los componentes reciben el estado por props: no llaman a la API ni leen la dirección. |
| **Encapsulación** (diap. 20–24) | La pantalla no conoce los nombres que usa la dirección ni cómo se validan. |
| **Abstracción** (diap. 13–16) | `FichaQuitable` no sabe de eventos. |
| **Refactorizar con pruebas** (diap. 140) | 19 pruebas fijan cada comportamiento, también contra la búsqueda real de CAP-80. |

## Resultado de las pruebas

- Pruebas de esta tarea: **19 aprobadas**:
  - parámetros que se mandan a la búsqueda (vacíos, combinados, espacios y rango al revés);
  - texto de cada ficha y quitar una sola;
  - ida y vuelta por la dirección, enlace editado a mano y nada guardado en el navegador;
  - contra la base de datos: tipo + ubicación + modalidad combinados, búsqueda sin coincidencias, rango al revés y un visitante sin sesión que busca sin dejar filas nuevas;
  - pantalla: etiquetas, error del rango, fichas con su botón y el estado «No se encontraron eventos».
- Todas las pruebas: **202 aprobadas** (con CAP-77, 94, 93, 78, 80, 98, 97 y 95 incluidas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.

## Rendimiento (`rendimiento.json`)

- **Build:** 5,1 KB más de JS y 0,4 KB más de CSS que en CAP-95.
- **Consultas:** no cambian, porque esta tarea no toca la base de datos. Medianas de `catalogo_eventos` (sin filtros, con texto y con modalidad + precio): 2 / 0,76 / 0,65 ms en CAP-95 y 1,92 / 0,76 / 0,67 ms ahora.

## Capturas (`capturas/`, tomadas en la app real, modo local, sin iniciar sesión)

| Imagen | Qué muestra |
|---|---|
| `1_catalogo_panel.png` | Catálogo con el panel nuevo y el total |
| `2_filtros_combinados.png` | «inteligencia» + Seminario: dos fichas y 1 evento |
| `3_rango_invalido.png` | Rango de fechas al revés con el aviso en «Hasta» |
| `4_sin_resultados.png` | «No se encontraron eventos» con «Limpiar filtros» |
| `5_movil.png` | Vista en celular (390 px) filtrando por Curso |
| `6_tras_limpiar.png` | Después de «Limpiar filtros»: catálogo completo y dirección limpia |

Los eventos de demostración no traen tipo. Solo para las capturas se les puso uno según su nombre; ese cambio no está en los archivos entregados.

## Para la revisión del PR

- Andree (QA): CAP-82 prueba la HU-15. Las capturas muestran cada estado.
- Pendiente aparte: dar tipo a los eventos de demostración, para que el filtro «Tipo» se pueda probar en modo local.
