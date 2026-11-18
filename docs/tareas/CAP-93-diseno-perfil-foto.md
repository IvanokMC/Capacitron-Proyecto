# CAP-93 · HU-17 Diseño del perfil con foto

**Documentación de la tarea** · Rol: Diseño UI/UX (Medaly) · Sprint 2 · Cronograma: n.° 03

**Tarea:** HU-17 · Diseño del perfil con foto y estados de la carga · **Responsable:** Medaly (Diseño UI/UX) · **Historia:** CAP-84 (HU-17 Perfil con foto), criterios **CA-01 a CA-04**.

## Qué se entrega

1. **Prototipo de los 8 estados**, con capturas en `docs/diseno/CAP-93-perfil-foto/` y la vista completa en `prototipo_completo.png`:
   - sin foto;
   - con foto;
   - vista previa;
   - subiendo;
   - archivo rechazado;
   - error al subir;
   - avatar en el menú superior;
   - avatar en la lista de inscritos.
2. **Ficha de diseño** (`docs/diseno/CAP-93-perfil-foto/DISENO.md`): dónde va cada cosa en «Mi perfil», qué ve la persona en cada estado, los textos exactos y las reglas de accesibilidad.
3. **Componentes en `src/components/ui.tsx`**, listos para que José los use en CAP-95:
   - **`Avatar` mejorado**, compatible con el anterior. Se usa igual en el perfil, el menú, los inscritos y los ponentes. Si la foto no carga, vuelve a las iniciales. Tiene una variante `tono="oscuro"` para el fondo granate del menú y texto alternativo cuando la foto importa.
   - **`SelectorFoto` nuevo**: el avatar con «Subir foto», «Cambiar foto» y «Quitar foto», más la ayuda de formatos y tamaño y los estados de vista previa, subiendo y error.

**No incluye:** leer, validar o subir el archivo. Eso es de CAP-95 (José) y CAP-97 (George). `SelectorFoto` solo muestra lo que le indiquen: el estado y el mensaje de error.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/components/ui.tsx` | `Avatar` mejorado y `SelectorFoto` nuevo, con comentarios de la teoría aplicada. |
| `tests/cap93-avatar-selector.test.ts` | **Nuevo.** 10 pruebas de los estados del diseño. |
| `docs/diseno/CAP-93-perfil-foto/DISENO.md` | **Nuevo.** Ficha del diseño. |
| `docs/diseno/CAP-93-perfil-foto/*.png` | **Nuevas.** Las 8 capturas del prototipo. |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Cohesión** (diap. 26–28) | Un solo `Avatar` para el perfil, el menú, los inscritos y los ponentes. Cambiar cómo se ve una persona se hace en un único lugar. |
| **Separación de responsabilidades y SRP** (diap. 6, 19 y 39–49) | `SelectorFoto` solo muestra y avisa; subir y validar es de otras tareas. Por eso recibe el estado y el error desde afuera. |
| **Abstracción** (diap. 13–16) | Las pantallas piden «el avatar de esta persona» sin preocuparse de si hay foto, si falló la carga o si van las iniciales. |
| **Refactorizar con pruebas** (diap. 140) | Las 10 pruebas fijan cada estado del prototipo, así un cambio posterior no rompe el diseño sin que se note. |

## Resultado de las pruebas

- Pruebas del diseño: **10 aprobadas**.
- Todas las pruebas: **117 aprobadas** (con CAP-77 y CAP-94 incluidas). Ver `pruebas.txt`.
- `npx tsc --noEmit`: sin errores.
- **Rendimiento:** el build crece menos de 8 KB, que corresponden sobre todo a la migración de CAP-94 incluida en el modo local. Los componentes nuevos casi no pesan.

## Para la revisión del PR

- Andree (Product Owner) aprueba el prototipo revisando las capturas de `docs/diseno/`.
- El `Avatar` sigue funcionando igual en las pantallas de ponentes, que ya lo usaban.
