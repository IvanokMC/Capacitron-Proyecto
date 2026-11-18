# CAP-103 · HU-19 Diseño del mapa y del selector de ubicación

**Documentación de la tarea** · Rol: Diseño UI/UX (Medaly) · Sprint 2 · Cronograma: n.° 11

**Tarea:** HU-19 · Diseño del mapa del evento y del selector de ubicación · **Responsable:** Medaly (Diseño UI/UX) · **Historia:** CAP-86 (HU-19 Mapa con la ubicación y la hora del evento), criterios **CA-01 a CA-04**.

## Qué se entrega

1. **Prototipo de 11 estados** en `docs/diseno/CAP-103-mapa/` (también en `capturas/`):
   - página del evento con punto, sin punto y evento virtual;
   - formulario sin punto, con sugerencias, con dirección no encontrada, con punto marcado y con error;
   - tres vistas en celular (390 px).
2. **Ficha de diseño** (`DISENO.md`): dónde va cada cosa, los estados, los textos exactos, las decisiones y la accesibilidad.
3. **Componentes en `src/components/UbicacionEvento.tsx`**, listos para que José los use en CAP-105:
   - **`BloqueUbicacion`**: mapa, dirección, «martes, 24 de noviembre de 2026, empieza a las 15:00 h» y «Cómo llegar» (CA-02 y CA-03). Con un evento virtual no muestra nada (CA-04). Sin coordenadas muestra la dirección con un aviso y sin botón.
   - **`SelectorUbicacion`**: el campo «Lugar» también sirve para buscar (sugerencias, «Buscando…», «No encontramos esa dirección…»). Debajo va el mapa con «Toca el mapa para marcar el lugar» y, al marcar, «Punto marcado: 13,5208° S · 71,9584° O» con «Quitar punto». También muestra los errores del lugar y del punto (CA-01 y CA-05).
   - **`MarcoMapa`**, **`textoPunto`** y **`TEXTOS_UBICACION`**: el marco común, las coordenadas legibles y los textos en un solo lugar.

**El mapa de las capturas es un dibujo de ejemplo**, y así lo dice en la esquina. El mapa real (Leaflet con OpenStreetMap, como propone la historia) lo conecta José en CAP-105 por la prop `mapa`. Las coordenadas de las imágenes también son de ejemplo.

**No incluye:**
- El mapa real, la búsqueda de direcciones ni el enlace de Google Maps (CAP-105, José).
- Guardar y validar la latitud y la longitud (CAP-104, Carlos).

## Archivos

| Archivo | Cambio |
|---|---|
| `src/components/UbicacionEvento.tsx` | Nuevo: `BloqueUbicacion`, `SelectorUbicacion`, `MarcoMapa`, `textoPunto` y `TEXTOS_UBICACION` |
| `tests/cap103-mapa-diseno.test.ts` | Nuevo: 12 pruebas de los estados del diseño |
| `docs/diseno/CAP-103-mapa/DISENO.md` | Nuevo: ficha del diseño |
| `docs/diseno/CAP-103-mapa/*.png` | Nuevas: 11 capturas del prototipo |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **DIP y Adapter** (diap. 92–106 y 126–132) | Los componentes no conocen el proveedor del mapa: lo reciben por la prop `mapa`. Cambiar a Google Maps no toca el diseño. |
| **SRP** (diap. 39–49) | Solo muestran. Buscar, armar el enlace y guardar son de otras tareas, y llegan como props. |
| **Evitar sobreingeniería** (diap. 135–139) | Un punto, una dirección y un botón, como pide la tarea. Sin rutas, capas ni varios puntos. |
| **Cohesión** (diap. 26–28) | Todo lo de la ubicación del evento está en un solo archivo, con sus textos en `TEXTOS_UBICACION`. |
| **Refactorizar con pruebas** (diap. 140) | 12 pruebas fijan cada estado del prototipo. |

## Cosas que se corrigieron al probar en celular

- **El formulario se ensanchaba a 453 px en un celular de 390 px.** Un `fieldset` no se encoge por debajo de su contenido y las sugerencias largas lo empujaban. Se corrigió con `min-w-0` en el `fieldset` y `contain: inline-size` en la lista; ahora los nombres largos se cortan con «…». Una prueba lo fija.
- **El borde rojo del mapa en el estado de error no se veía**, porque dos clases de color competían. Ahora `MarcoMapa` recibe `invalido` y usa un solo color, con un halo.

## Resultado de las pruebas

- Pruebas del diseño: **12 aprobadas**.
- Sobre `main` solo: **94 aprobadas**, y `tsc` sin errores. Con todo lo preparado del Sprint 2: 277 aprobadas y 1 pendiente. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **JS:** 0,0 KB de diferencia frente a CAP-99. Los componentes aún no se usan en ninguna pantalla; los conecta CAP-105.
- **CSS:** 1,2 KB más, por las clases nuevas.
- **Consultas:** sin cambios; esta tarea no toca la base de datos.

## Corrección del 17/11/2026

La captura `9_movil_evento.png` salía vacía: el script de capturas ocultaba también el panel del bloque, que es una `section` como los estados del prototipo. Se volvió a tomar con el script corregido; las otras 10 capturas salieron idénticas. Se reemplazó en `capturas/` y en `archivos/docs/diseno/CAP-103-mapa/`, y se rehízo el zip.
