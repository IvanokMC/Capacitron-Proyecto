# CAP-92 · CI con tsc y pruebas en cada pull request

**Documentación de la tarea** · Rol: DevOps (George) · Historia: HU-16 (CAP-83) · Sprint 2 · PR #5

## Qué hace

`.github/workflows/ci.yml` corre en cada push a `main` y en cada pull request hacia `main`:

1. `npm ci` con Node 22;
2. `npx tsc --noEmit` (tipos);
3. `npm test` (toda la suite con PGlite, sin servicios externos ni secretos).

Así cada PR del Sprint 2 muestra si rompe algo antes de integrarlo.

## Por qué va primero

Se sube antes que el resto de CAP-92 para que corra en los PR de todo el equipo. El resto (bucket privado de comprobantes, Edge Function que firma enlaces y revisión de diseño de la HU-16) va en otro PR, después de CAP-89 y CAP-90.

## Teoría de Diseño de Software

- Refactorizar con pruebas (diap. 140): ningún PR se integra sin que la suite pase.
- Mantenibilidad (diap. 137): las pruebas corren igual en cualquier máquina, sin configurar servicios.

## Verificación

En una copia limpia de `main`, con `npm ci` desde cero: `tsc` sin errores y 82 pruebas aprobadas.
