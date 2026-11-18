# CAP-101 · HU-18 Pruebas del celular y del consentimiento

**Documentación de la tarea** · Rol: QA y pruebas (Andree) · Sprint 2 · Cronograma: n.° 15

**Tarea:** HU-18 · QA: pruebas del celular y del consentimiento · **Responsable:** Andree (Product Owner y QA) · **Historia:** CAP-85 (HU-18 Celular del asistente), criterios **CA-01 a CA-05**.

## Qué se entrega

1. **Pruebas de aceptación** (`tests/cap101-aceptacion-hu18.test.ts`): 19 pruebas escritas como «Dado… cuando… entonces…».
   - **Escenario:** Carmen y Jorge (organizadores de instituciones distintas), Rosa (comparte su celular e inscrita en los dos eventos), Luis (no lo comparte) y una cuenta antigua sin celular.
   - **Cómo se recorren:** las personas se registran y cambian su perfil con la misma regla de la pantalla (CAP-100). La organizadora ve la lista con la API real (CAP-99), dibujada con la tabla de inscritos.
   - **Casos nuevos:**
     - la pantalla y la API rechazan con el mismo motivo;
     - retirar el permiso lo oculta en **todos** los eventos;
     - dar el permiso después también funciona;
     - un número nuevo se ve de inmediato;
     - otro organizador no abre la lista ajena;
     - cancelar en un evento oculta el número solo en ese;
     - el celular no aparece en 9 funciones (catálogo, página del evento, «Mis inscripciones», asistencia, certificados, reportes, «Mis eventos» y la lista del administrador).
2. **Plan de pruebas** (`docs/pruebas/HU-18/PLAN_DE_PRUEBAS.md`; también suelto en esta carpeta): datos de prueba, matriz de trazabilidad, **10 casos manuales**, hallazgos y la tabla para tu decisión.

Antes de escribir las pruebas se revisó que ninguna función de la base de datos devuelva la fila completa del usuario (`to_jsonb`), porque eso filtraría el celular sin que nadie lo note. No hay ninguna.

**No incluye** la ejecución de los casos manuales ni la decisión de aceptación: eso lo haces tú.

## Hallazgos

| N.° | Hallazgo | Propuesta |
|---|---|---|
| **H-01** | En la explicación del permiso, «Ley N.° 29733» se corta entre líneas («Ley N.» al final de una, «° 29733» al inicio de la siguiente). Se ve en la captura del registro de CAP-100. | Envolver «N.° 29733» para que no se corte. Es un cambio de una línea en el componente de Medaly (CAP-98). |
| **O-01** | El permiso vale para todos los eventos donde la persona se inscribe, no evento por evento. | Así lo define la historia; si se quiere por evento, sería una historia nueva. |

## Archivos

| Archivo | Cambio |
|---|---|
| `tests/cap101-aceptacion-hu18.test.ts` | Nuevo: 19 pruebas de aceptación de CA-01 a CA-05 |
| `docs/pruebas/HU-18/PLAN_DE_PRUEBAS.md` | Nuevo: plan, datos, matriz, 10 casos manuales, hallazgos y decisión de aceptación |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Refactorizar con pruebas** (diap. 140) | Si alguien cambia la API del celular, la pantalla o la tabla, estas pruebas dicen qué criterio se rompió. |
| **Encapsulación** (diap. 20–24) | Se comprueba que el celular solo sale por `evento_gestion`, del dueño del evento y con permiso, y por ninguna otra de las 9 funciones revisadas. |

## Resultado de las pruebas

- Pruebas de aceptación: **19 aprobadas**.
- En la etapa de la tarea (después de CAP-100): **241 aprobadas**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: 350 aprobadas y 2 pendientes. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **Build:** no cambia: solo se agregan pruebas y documentación.
- **Consultas:** iguales o algo más rápidas que en CAP-104.
