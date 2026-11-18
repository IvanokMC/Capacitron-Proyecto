# CAP-104 · HU-19 Latitud y longitud del evento

**Documentación de la tarea** · Rol: Backend y base de datos (Carlos) · Sprint 2 · Cronograma: n.° 14

**Tarea:** HU-19 · Backend: latitud y longitud del evento · **Responsable:** Carlos (Backend y base de datos) · **Historia:** CAP-86 (HU-19 Mapa con la ubicación y la hora del evento), criterios **CA-01, CA-04 y CA-05**.

## Qué se entrega

**Migración `20261120000001_coordenadas_evento.sql`:**

1. **Columnas `latitud` y `longitud`** en `capa.eventos`:
   - con `check` (-90 a 90 y -180 a 180);
   - siempre en pareja: no puede haber solo una;
   - redondeadas a 6 decimales, unos 11 cm.
2. **`capa.coordenadas_evento`** valida lo que llega (CA-05):
   - un número mal escrito, fuera de rango o solo una de las dos se rechaza con `CAMPOS`, nombrando el campo;
   - el texto es «Las coordenadas están fuera de rango. Vuelve a marcar el punto en el mapa.», el mismo de la ficha de Medaly (CAP-103).
3. **Regla de publicación:** `capa.campos_faltantes_publicacion` (la regla única de CAP-77) ahora devuelve `ubicacion` si un evento presencial o mixto no tiene punto (CA-01).
   - Publicar lo exige.
   - `evento_gestion` lo muestra en «falta para publicar».
   - Un borrador se sigue guardando incompleto.
4. **`guardar_evento`:**
   - guarda las coordenadas;
   - en un evento virtual las deja vacías (CA-04);
   - al editar, si la llamada no las trae, las conserva.
5. **Ajuste a la corrección D-01:** al editar un evento publicado solo se impide **quitar** lo que ya tenía.
   - Un evento publicado antes de la HU-19, sin punto, se puede seguir editando sin marcarlo.
   - Pero no se le puede borrar el contacto, y a uno con punto no se le puede borrar el punto.
6. **`evento_json`:** devuelve `latitud` y `longitud`, así las tienen `detalle_evento` y `catalogo_eventos` (CA-02).

**También:** el evento de prueba de `tests/bd.ts` trae un punto.
- Las pruebas de George (CAP-79) se ajustaron en su PR #3 para mandar el punto.
- Las demás pruebas del proyecto no cambian.

**No incluye** el mapa ni el selector en pantalla: eso es CAP-105 (José), con el diseño de CAP-103 (Medaly).

**Integración:** desde aquí publicar un evento presencial exige el punto, y el formulario lo envía recién con CAP-105. George debe integrar las dos juntas.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261120000001_coordenadas_evento.sql` | Nuevo: columnas latitud y longitud, validación, regla de publicación y datos públicos |
| `src/lib/backend/migraciones.ts` | Modificado: migración de CAP-104 en el modo local |
| `tests/bd.ts` | Modificado: migración nueva y punto en el evento de prueba |
| `tests/cap104-coordenadas-evento.test.ts` | Nuevo: 19 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Encapsulación** (diap. 20–24) | Las coordenadas solo entran validadas por `capa.coordenadas_evento`, y la tabla las vuelve a revisar con `check`. |
| **Code smells: duplicación** (diap. 33) | «Presencial o mixto lleva ubicación» está en una sola función, que usan publicar, editar un publicado y `evento_gestion`. |
| **LSP** (diap. 64–79) | Crear y editar siguen cumpliendo la misma regla. Al editar solo se impide empeorar, así los eventos antiguos no quedan bloqueados. |
| **Evitar sobreingeniería** (diap. 135–139) | Dos columnas numéricas y un `check`; sin PostGIS, porque solo se guarda y se muestra un punto. |
| **Refactorizar con pruebas** (diap. 140) | 19 pruebas fijan cada criterio; las anteriores siguen en verde. |

## Resultado de las pruebas

- Pruebas de esta tarea: **19 aprobadas**.
- En la etapa de la tarea (después de CAP-99): **192 aprobadas**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: 331 aprobadas y 2 pendientes. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **Consultas:** iguales o algo más rápidas. Por ejemplo, `catalogo_eventos` sin filtros pasó de 2,46 a 1,97 ms y `detalle_evento` de 0,92 a 0,77 ms.
- **Build:** 16,7 KB más de JS, por el SQL de la migración que lleva el modo local.
