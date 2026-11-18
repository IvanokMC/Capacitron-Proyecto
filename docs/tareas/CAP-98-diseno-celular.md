# CAP-98 · HU-18 Diseño del campo de celular y consentimiento

**Documentación de la tarea** · Rol: Diseño UI/UX (Medaly) · Sprint 2 · Cronograma: n.° 06

**Tarea:** HU-18 · Diseño del campo de celular, el consentimiento y el contacto desde la lista de inscritos · **Responsable:** Medaly (Diseño UI/UX) · **Historia:** CAP-85 (HU-18 Celular del asistente), criterios **CA-01 a CA-03 y CA-05**.

## Qué se entrega

1. **Prototipo de 7 estados**, con capturas en `docs/diseno/CAP-98-celular/` y la vista completa en `prototipo_completo.png`:
   - registro sin llenar;
   - celular inválido;
   - válido y con permiso;
   - «Mi perfil» con permiso;
   - «Mi perfil» retirando el permiso;
   - lista de inscritos del organizador;
   - vista en celular (375 px).
2. **Ficha de diseño** (`docs/diseno/CAP-98-celular/DISENO.md`): dónde va cada cosa, qué ve la persona en cada estado, los textos exactos, las decisiones y las reglas de accesibilidad.
3. **Componentes en `src/components/ui.tsx`**, listos para que José los use en CAP-100:
   - **`CampoCelular`**: prefijo +51, solo deja escribir dígitos (hasta 9), muestra la ayuda o el error, y debajo la casilla de consentimiento con su explicación, en el mismo grupo. Si la persona ya había dado permiso y lo quita, avisa: «Al guardar, los organizadores dejarán de ver tu celular».
   - **`CeldaCelular`**: con número, lo muestra en grupos de tres y agrega el botón «WhatsApp». Sin número, muestra un candado y «No compartido».
   - **`TEXTOS_CELULAR`**: los textos en un solo lugar, para que el registro y el perfil digan lo mismo.
4. **`celular()` en `src/lib/formato.ts`**: convierte «984123456» en «984 123 456».

**No incluye:** validar el formato del celular ni armar el enlace de WhatsApp (CAP-100, José), ni guardar el celular y decidir quién lo ve (CAP-99, Carlos). Los componentes reciben el error, el número ya filtrado y el enlace, y solo los muestran.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/components/ui.tsx` | Modificado: `CampoCelular`, `CeldaCelular` y `TEXTOS_CELULAR` nuevos |
| `src/lib/formato.ts` | Modificado: `celular()` muestra el número en grupos de tres |
| `tests/cap98-celular-diseno.test.ts` | Nuevo: 9 pruebas de los estados del diseño |
| `docs/diseno/CAP-98-celular/DISENO.md` | Nuevo: ficha del diseño |
| `docs/diseno/CAP-98-celular/*.png` | Nuevas: 7 capturas del prototipo |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Separación de responsabilidades** (diap. 6 y 19) | El consentimiento va en el mismo grupo que el celular que protege; quien escribe su número ve para qué se usa y cómo retirarlo. Es lo que pide la tarea en Jira. |
| **SRP** (diap. 39–49) | Los componentes solo muestran. Validar y decidir quién ve el dato son tareas de otros (CAP-100 y CAP-99). |
| **Encapsulación** (diap. 20–24) | `CeldaCelular` no distingue entre «no dio permiso» y «no tiene celular»: si la API no entrega el número, la pantalla no tiene forma de deducirlo. |
| **Cohesión** (diap. 26–28) | Un solo `CampoCelular` y un solo juego de textos para el registro y el perfil. |
| **Refactorizar con pruebas** (diap. 140) | 9 pruebas fijan cada estado, así un cambio posterior no rompe el diseño sin que se note. |

## Resultado de las pruebas

- Pruebas del diseño: **9 aprobadas**:
  - campo numérico de 9 dígitos con +51 y la ayuda;
  - el error resalta el campo y se anuncia;
  - el permiso va en el mismo grupo que el dato y cita la Ley N.° 29733;
  - la casilla empieza sin marcar;
  - el aviso al retirar el permiso;
  - el número y el botón de WhatsApp con permiso;
  - «No compartido» sin ningún enlace;
  - sin enlace, solo el número;
  - el formato en grupos de tres.
- Todas las pruebas: **155 aprobadas** (con CAP-77, 94, 93, 78 y 80 incluidas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.

## Rendimiento (`rendimiento.json`)

- Las consultas no cambian, porque esta tarea no toca la base de datos.
- El build pesa 19,7 KB más que en CAP-93, pero esa diferencia incluye CAP-78 y CAP-80. Unos 11 KB son sus migraciones dentro del modo local, y otra parte es el formulario de contacto de CAP-78. Los componentes de CAP-98 son una fracción pequeña.

## Para la revisión del PR

- Andree (Product Owner) aprueba el prototipo revisando las capturas de `docs/diseno/CAP-98-celular/`.
- En la lista de inscritos del prototipo, los nombres y correos son cuentas de los datos de demostración; los números son de ejemplo.
