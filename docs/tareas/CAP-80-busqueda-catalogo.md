# CAP-80 · HU-15 Ampliar catalogo_eventos con fecha, tipo y ubicación

**Documentación de la tarea** · Rol: Backend y base de datos (Carlos) · Sprint 2 · Cronograma: n.° 05

**Tarea:** HU-15 · Ampliar `catalogo_eventos` con fecha, tipo y ubicación · **Responsable:** Carlos (Backend y base de datos) · **Historia:** CAP-75 (HU-15 Búsqueda y filtro de eventos), criterios **CA-01 a CA-03 y CA-05**.

## Qué se entrega

Migración `20261118000001_busqueda_catalogo.sql`, que reemplaza `public.catalogo_eventos` sin cambiar su nombre ni su forma de uso:

| Parámetro | Criterio | Qué hace |
|---|---|---|
| `q` | CA-01 | Busca el tema en el nombre, la descripción, la institución y, ahora también, el nombre público del organizador (CAP-77). Los `%` y `_` que escribe la persona se buscan como texto, no como comodín. |
| `desde`, `hasta` | CA-02 | Fechas `AAAA-MM-DD` en hora de Lima. Lista los eventos que **inician** dentro del rango, con ambos días incluidos. Se puede usar solo uno. |
| `tipo` | CA-03 | `seminario`, `congreso`, `taller` o `curso`. |
| `ubicacion` | CA-03 | Parte del lugar, por ejemplo «Perayoc». |
| `modalidad: 'virtual'` | CA-03 | «Virtual» ya existía como modalidad; no se duplicó. |
| `modalidad`, `precio`, `incluir_pasados` | — | Siguen igual. |

- Todos los filtros son opcionales y se combinan.
- Un tipo inválido, una fecha mal escrita o una fecha final anterior a la inicial se rechazan con el código `CAMPOS` y el nombre del campo, para que la pantalla lo resalte.
- Solo se buscan eventos publicados.
- **CA-05:** la función es de solo lectura, no pide sesión y no guarda nada del visitante.

**Índices:** ya existía `eventos_estado_fecha_idx (estado, fecha_inicio)` para las fechas. Se agregó `eventos_publicados_tipo_fecha_idx (tipo, fecha_inicio)`, solo sobre los eventos publicados.

**Contrato para la pantalla:** el tipo `FiltrosCatalogo` en `src/lib/tipos.ts` documenta los parámetros. Lo usará Medaly en CAP-81 (filtros del catálogo y estado sin resultados).

**No incluye:** la pantalla de filtros ni el mensaje «No se encontraron eventos» (CAP-81, Medaly), ni las pruebas de aceptación (CAP-82, Andree).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261118000001_busqueda_catalogo.sql` | Nuevo: filtros por tipo, fechas y ubicación, y el índice por tipo |
| `src/lib/tipos.ts` | Modificado: tipo `FiltrosCatalogo` con los parámetros de la búsqueda |
| `src/lib/backend/migraciones.ts` | Modificado: migración de CAP-80 en el modo local |
| `tests/bd.ts` | Modificado: migración nueva en la base de pruebas |
| `tests/cap80-busqueda-catalogo.test.ts` | Nuevo: 16 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **OCP** (diap. 50–63) | La función se extiende con parámetros opcionales: las llamadas que ya hacía el catálogo devuelven lo mismo. Una prueba lo comprueba. |
| **SRP** (diap. 39–49) | `capa.filtros_catalogo` solo valida y normaliza los filtros; `catalogo_eventos` solo consulta. |
| **Evitar duplicación** (diap. 33) | `capa.patron_busqueda` arma el patrón de texto una sola vez, en lugar de repetir `'%' || … || '%'` en cada columna, y además escapa los comodines. |
| **DIP** (diap. 92–106) | La pantalla depende del contrato `FiltrosCatalogo`, no de cómo está escrita la consulta. |
| **Evitar sobreingeniería** (diap. 135–139) | `ILIKE` e índices B-tree bastan para el tamaño de un catálogo académico. No se agregaron búsqueda de texto completo ni extensiones nuevas. |
| **Refactorizar con pruebas** (diap. 140) | 16 pruebas fijan cada filtro, sus combinaciones y los errores. |

## Resultado de las pruebas

- Pruebas de CAP-80: **16 aprobadas**:
  - tema en el nombre, la descripción y el organizador; comodines escritos por la persona;
  - rango de fechas con ambos días incluidos; un día sin eventos; fecha final anterior; fecha mal escrita;
  - tipo, ubicación y «Virtual»; filtros combinados; tipo inválido;
  - solo publicados; sin sesión y sin guardar nada; las llamadas anteriores devuelven lo mismo; el índice nuevo existe.
- Todas las pruebas: **146 aprobadas** (con CAP-77, CAP-94, CAP-93 y CAP-78 incluidas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.

## Rendimiento (`rendimiento.json`, 30 repeticiones)

- Llamadas que ya existían: `catalogo_eventos` sin filtros pasó de 1,83 a 1,97 ms de mediana, y con `q` de 0,69 a 0,80 ms. Es el costo de validar los filtros, alrededor de 0,1 ms. El resto de funciones no cambió.
- Filtros nuevos con los datos de demostración: por tipo 0,74 ms, por rango de fechas 1,49 ms, por ubicación 1,22 ms, y los cuatro combinados 0,81 ms. Todos por debajo de 2 ms.

## Para la revisión del PR

- Andree (QA): CAP-82 prueba estos criterios desde la pantalla, cuando Medaly termine CAP-81.
- En Supabase, la función ya tenía permiso para visitantes sin sesión; al reemplazarla con el mismo nombre, el permiso se conserva.
