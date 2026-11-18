# CAP-82 · HU-15 Pruebas de CA-01 a CA-05

**Documentación de la tarea** · Rol: QA y pruebas (Andree) · Sprint 2 · Cronograma: n.° 09

**Tarea:** HU-15 · Pruebas de los criterios de aceptación · **Responsable:** Andree (Product Owner y QA) · **Historia:** CAP-75 (HU-15 Búsqueda y filtro de eventos), criterios **CA-01 a CA-05**.

## Qué se entrega

1. **Pruebas de aceptación** (`tests/cap82-aceptacion-hu15.test.ts`): 21 pruebas escritas como «Dado… cuando… entonces…», una sección por criterio.
   - Miran la historia como la usa una persona: arman los filtros con la misma función que la pantalla (`paramsCatalogo`, CAP-81) y consultan la búsqueda real (`catalogo_eventos`, CAP-80).
   - Usan un catálogo de prueba de 7 eventos con casos de borde que las pruebas de CAP-80 y CAP-81 no cubrían:
     - un evento a las 23:30 de Lima, que en UTC ya es el día siguiente;
     - otro a las 00:30 del día siguiente;
     - uno que empezó antes del rango y sigue durante él (no debe salir, porque el criterio habla del inicio);
     - un borrador y uno cancelado que cumplen todos los filtros (no deben salir).
   - CA-05 se prueba de cuatro formas: buscar no cambia ninguna tabla, un token inventado se ignora, la consulta solo lleva filtros y el resultado público no trae datos de inscritos.
2. **Plan de pruebas** (`docs/pruebas/HU-15/PLAN_DE_PRUEBAS.md`; también suelto en esta carpeta):
   - alcance y entorno;
   - datos de prueba;
   - matriz de trazabilidad: qué prueba de CAP-80, CAP-81 y CAP-82 cubre cada criterio;
   - **10 casos manuales** para ejecutar en el navegador (M-01 a M-10);
   - hallazgos;
   - la tabla para tu decisión de aceptación.

**No incluye** la ejecución de los casos manuales ni la decisión de aceptar la historia: eso lo haces tú como Product Owner (paso 5 de la guía).

## Hallazgos

| N.° | Hallazgo | Propuesta |
|---|---|---|
| **H-01** | La búsqueda distingue tildes: «robotica» no encuentra «Robótica» y «pabellon» no encuentra «Pabellón». Se confirmó con una consulta de prueba. No rompe los criterios, pero mucha gente escribe sin tildes en el celular. | Tarea de backend para el Sprint 3. Queda como prueba pendiente (`it.todo`) para activarla cuando se corrija. |
| **H-02** | Los eventos de demostración no tienen tipo: en modo local el filtro «Tipo» siempre da «No se encontraron eventos». | Darles tipo en `capa.sembrar_demo()`. |

## Archivos

| Archivo | Cambio |
|---|---|
| `tests/cap82-aceptacion-hu15.test.ts` | Nuevo: 21 pruebas de aceptación de CA-01 a CA-05 y 1 pendiente (H-01) |
| `docs/pruebas/HU-15/PLAN_DE_PRUEBAS.md` | Nuevo: plan, datos de prueba, matriz, casos manuales, hallazgos y decisión de aceptación |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Refactorizar con pruebas** (diap. 140) | Si alguien cambia la búsqueda o el panel, estas pruebas dicen qué criterio se rompió. |
| **Separación de responsabilidades** (diap. 6 y 19) | Las pruebas unitarias son de cada pieza (CAP-80 de la base de datos, CAP-81 de la pantalla); las de aceptación son de la historia completa. No se repiten. |
| **Encapsulación** (diap. 20–24) | Las pruebas usan las funciones públicas (`paramsCatalogo`, `catalogo_eventos`, `SinResultados`), no los detalles internos. Así no se rompen si cambia cómo está hecho por dentro. |

## Resultado de las pruebas

- Pruebas de aceptación: **21 aprobadas y 1 pendiente** (H-01).
- Todas las pruebas: **223 aprobadas y 1 pendiente** (con CAP-77, 94, 93, 78, 80, 98, 97, 95 y 81 incluidas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.

## Rendimiento (`rendimiento.json`)

- **Build:** no cambia: esta tarea solo agrega pruebas y documentación.
- **Consultas:** iguales. Medianas de `catalogo_eventos` (sin filtros, con texto y con modalidad + precio): 1,92 / 0,76 / 0,67 ms en CAP-81 y 1,86 / 0,73 / 0,64 ms ahora.
