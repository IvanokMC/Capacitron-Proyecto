# CAP-79 · Pruebas de aceptación de la HU-02 (CA-06 a CA-08)

**Documentación de la tarea** · Rol: DevOps y calidad de diseño (George) · Historia: HU-02 Crear evento · Sprint 2 · PR #3

## Qué hace

| Archivo | Qué es |
|---|---|
| `tests/cap79-aceptacion-hu02.test.ts` | Pruebas de punta a punta: borrador → publicar o editar → página del visitante, con las funciones de la pantalla sobre la respuesta real de la API |
| `docs/pruebas/HU-02/PLAN_DE_PRUEBAS.md` | Matriz de trazabilidad, casos manuales, hallazgo D-01 y tabla de decisión |

El formulario de prueba también manda el punto en el mapa (latitud y longitud), porque desde CAP-104 publicar un evento presencial lo exige.

## Hallazgo D-01 (corregido en CAP-77 y CAP-78)

- **Defecto:** un evento publicado se podía editar y quedarse sin tipo, organizador ni contacto, y seguía publicado.
- **Causa:** `guardar_evento` solo validaba esos datos al publicar y, al editar, un campo no enviado quedaba vacío. Tres pruebas del Sprint 1 reenviaban la vista pública, que no trae el contacto privado, y lo borraban.
- **Corrección:** al editar, un campo no enviado conserva su valor; si el evento está publicado se vuelve a aplicar `capa.campos_faltantes_publicacion` (CAP-77). Las pruebas del Sprint 1 editan con `evento_gestion`, como el editor real (CAP-78).

## Teoría de Diseño de Software

| Principio | Dónde |
|---|---|
| Refactorizar con pruebas (diap. 140) | Cada criterio queda fijado por una prueba automática |
| LSP (diap. 64–79) | Crear y editar cumplen la misma regla de publicación |
| Code smells / duplicación (diap. 33) | La regla de publicación vive en una sola función |

## Integración

Se integra después de CAP-76, CAP-77 y CAP-78: la prueba usa sus columnas y funciones.
