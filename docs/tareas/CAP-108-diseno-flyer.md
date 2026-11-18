# CAP-108 · HU-20 Diseño del flyer y la imagen del lugar

**Documentación de la tarea** · Rol: Diseño UI/UX (Medaly) · Sprint 2 · Cronograma: n.° 17

**Tarea:** HU-20 · Diseño de cómo se ven el flyer y la imagen del lugar · **Responsable:** Medaly (Diseño UI/UX) · **Historia:** CAP-87 (HU-20 Flyer e imagen del lugar del evento), criterios **CA-01 a CA-03**.

## Qué se entrega

1. **Prototipo de 11 estados** en `docs/diseno/CAP-108-flyer/` (también en `capturas/`):
   - catálogo con y sin flyer;
   - página del evento con el flyer antes del panel de inscripción;
   - ubicación con mapa e imagen, y con la imagen sola;
   - formulario vacío, con vista previa, con archivo rechazado y subiendo;
   - tres vistas en celular.
   El flyer y la foto del lugar son **dibujos de ejemplo** hechos para el prototipo, no fotos reales.
2. **Ficha de diseño** (`DISENO.md`): dónde va cada cosa, estados, textos, decisiones y accesibilidad.
3. **Componentes en `src/components/ImagenEvento.tsx`**, listos para CAP-110 (José):
   - **`ImagenEvento`:** un mismo componente para todo (cohesión). El flyer se ve entero sobre fondo neutro (tiene texto); la foto del lugar se recorta (es una escena). Proporciones fijas (4:5 y 16:9) y carga diferida.
   - **`PortadaTarjeta`:** en el catálogo, la miniatura del flyer con el día encima y del mismo ancho que el bloque de fecha; sin flyer, el bloque de fecha de siempre.
   - **`FlyerEvento`:** en la página del evento, antes del panel de inscripción (CA-03), con «Ver flyer completo». Sin flyer no muestra nada.
   - **`ImagenLugar`:** la foto del lugar para el bloque de ubicación (CA-02).
   - **`CampoImagen`:** carga con vista previa, «Cambiar», «Quitar», el motivo del rechazo, «Subiendo…» y el campo de descripción (texto alternativo).
4. **`BloqueUbicacion`** (tu CAP-103) recibe la prop opcional `imagen`, que va debajo del mapa o sola si no hay punto.

**No incluye:**
- Subir el archivo, validar tipo y tamaño (3 MB) y guardar la ruta: CAP-109 (Carlos).
- Conectar los componentes en las pantallas: CAP-110 (José).

## Archivos

| Archivo | Cambio |
|---|---|
| `src/components/ImagenEvento.tsx` | Nuevo: `ImagenEvento`, `PortadaTarjeta`, `FlyerEvento`, `ImagenLugar`, `CampoImagen` y `TEXTOS_IMAGEN` |
| `src/components/UbicacionEvento.tsx` | Modificado (tu CAP-103): prop opcional `imagen` en `BloqueUbicacion` |
| `tests/cap108-flyer-diseno.test.ts` | Nuevo: 14 pruebas de los estados del diseño |
| `docs/diseno/CAP-108-flyer/DISENO.md` | Nuevo: ficha del diseño |
| `docs/diseno/CAP-108-flyer/*.png` | Nuevas: 11 capturas del prototipo |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Cohesión** (diap. 26–28) | Un solo `ImagenEvento` para el catálogo, la página del evento y el lugar; solo cambia la variante. Es lo que pide la tarea. |
| **SRP** (diap. 39–49) | Los componentes solo muestran; validar y subir es de otras tareas, y les llega como props. |
| **Evitar sobreingeniería** (diap. 135–139) | Sin editor ni recorte de imágenes: el flyer se muestra entero. |
| **Refactorizar con pruebas** (diap. 140) | 14 pruebas fijan cada estado. |

## Resultado de las pruebas

- Pruebas del diseño: **14 aprobadas**.
- Sobre `main` con tu CAP-103: **108 aprobadas**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: 377 aprobadas y 2 pendientes. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **JS:** 0,1 KB, prácticamente sin cambio: los componentes aún no se usan en ninguna pantalla.
- **CSS:** 1,3 KB más, por las clases nuevas.
- **Consultas:** sin cambios.

## Corregido al probar

La miniatura del flyer medía 68 px y el bloque de fecha 56 px, así que los títulos del catálogo no quedaban alineados. Ahora miden lo mismo.
