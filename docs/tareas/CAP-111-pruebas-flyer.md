# CAP-111 · HU-20 Pruebas del flyer y la imagen

**Documentación de la tarea** · Rol: QA y pruebas (Andree) · Sprint 2 · Cronograma: n.° 23

**Tarea:** HU-20 · QA: pruebas del flyer y de la imagen del lugar · **Responsable:** Andree (Product Owner y QA) · **Historia:** CAP-87 (HU-20 Flyer e imagen del lugar del evento), criterios **CA-01 a CA-05**.

## Qué se entrega

1. **`tests/cap111-aceptacion-hu20.test.ts`:** 17 pruebas de aceptación, escritas como «dado…, cuando…, entonces…». Recorren la historia con las piezas reales:
   1. la organizadora elige la imagen, con las reglas de CAP-110 y del módulo de almacenamiento de CAP-112;
   2. se sube al almacenamiento local, que cumple la misma interfaz que Supabase Storage;
   3. se guarda la ruta con `guardar_imagenes_evento` (CAP-109);
   4. un visitante **sin sesión** abre el catálogo y la página del evento, con las pantallas de CAP-110 y el diseño de CAP-108.
2. **`docs/pruebas/HU-20/PLAN_DE_PRUEBAS.md`:** alcance, entorno, matriz de trazabilidad, 10 casos manuales (3 en celular), hallazgos, la decisión D-01 y la tabla de aceptación.

## Qué prueba cada criterio

| Criterio | Pruebas | Qué comprueban |
|---|---|---|
| CA-01 | 5 | El flyer subido aparece en la fila del catálogo (con su descripción) y en la página. JPG, PNG y WEBP de exactamente 3 MB se aceptan. Al cambiarlo se ve el nuevo. |
| CA-02 | 2 | En la página, la imagen del lugar va dentro del bloque «Ubicación»: el mapa, debajo la imagen y después «Cómo llegar». Sin punto en el mapa, la imagen se ve sola con la dirección. |
| CA-03 | 2 | Sin sesión, el flyer está antes de «Ingresa para inscribirte». El bucket «eventos» es de lectura pública. |
| CA-04 | 3 | GIF, PDF y SVG se rechazan con el motivo. 3 MB y 1 byte muestra «pesa 3,1 MB y el límite es 3 MB» sin perder lo elegido. Si alguien saltara la pantalla, el módulo de almacenamiento y la base de datos también lo rechazan. |
| CA-05 | 4 | Otro organizador, un asistente o un visitante no pueden poner imágenes. El organizador sí puede quitar el flyer: desaparece con su descripción. Un evento cancelado ya no se edita. |
| Sin imágenes | 1 | El catálogo muestra el bloque de fecha y la página no tiene huecos ni imágenes vacías. |

## Hallazgos y decisiones (detalle en el plan)

- **D-01 (decide Andree):**
  - George propuso aceptar fotos de más de 3 MB y reducirlas al subirlas.
  - José respetó el CA-04 tal como está escrito: se rechazan.
  - Decisión: se mantiene el CA-04; los archivos mayores a 3 MB se rechazan.
- **H-01 (resuelto en CAP-110):** el día de la miniatura del catálogo quedaba fuera de lugar. Ya está corregido; se propone a Medaly moverlo al componente.
- **O-01:** los archivos anteriores quedan en el bucket. Es a propósito, para que nadie altere una imagen publicada.
- **O-02:** se pueden subir archivos sueltos al bucket, pero no se muestran en ninguna parte.
- **O-03:** si falla la subida al crear un evento nuevo, hay que volver a elegir la imagen. Un aviso lo explica.

El material de CAP-111 no reporta defectos nuevos en la historia. La ejecución automatizada de esta rama quedó bloqueada por la ausencia de módulos de CAP-110, como se detalla en «Pruebas».

## Por qué así

- **Piezas reales en vez de simulaciones:** solo se reemplazan lo que necesita un navegador (Leaflet y la compresión con canvas) y la sesión del visitante. La base, el almacenamiento, las reglas y las pantallas son las mismas que usa la app. Si alguien rompe la historia, una de estas pruebas falla (mantenibilidad, diap. 137).
- **Orden en la página:** CA-02 y CA-03 hablan de «junto al mapa» y «antes del botón». Por eso las pruebas comparan posiciones en la página y no solo que el texto exista.
- **Defensa en profundidad para CA-04:** además de la pantalla, se prueba que el módulo y la base rechazan un archivo que no cumple.

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Refactorizar con pruebas** (diap. 140) | Cada criterio queda cubierto por una prueba automática. Quien cambie el flyer, el bucket o las pantallas lo sabrá si rompe la historia. |
| **Mantenibilidad** (diap. 137) | Las pruebas usan las mismas piezas que la app y la matriz dice qué tarea prueba cada criterio. Así se sabe dónde mirar si algo falla. |
| **DIP** (diap. 92–106) | Como las pantallas dependen del contrato de almacenamiento y no de Supabase, la historia se prueba completa con el almacenamiento local. |

## Pruebas

- **Resultado reportado en el paquete (17/11/2026):** archivo de la tarea, 17 aprobadas; etapa con CAP-110, 471 aprobadas y 3 pendientes; cadena completa, 490 aprobadas y 3 pendientes; `tsc` sin errores.
- **Verificación de esta rama (18/11/2026):** la suite CAP-111 no pudo cargar y ejecutó 0 pruebas porque faltan `src/lib/imagenElegida` y `src/lib/imagenesEvento` de CAP-110. `npm test` terminó con 121 pruebas aprobadas y una suite fallida por esos módulos; `npx tsc --noEmit` reportó los mismos dos módulos ausentes.
- **Manuales:** M-01 a M-10 cumplen según la validación reportada por el equipo; el detalle de evidencias se mantiene en otras ramas y no se replica aquí.

## Rendimiento

CAP-111 no cambia la app, así que no hay medición nueva. La de la historia está en CAP-110 (carga inicial +12,4 KB, +0,3 KB con gzip) y en CAP-112 (una foto de 4871 KB queda en 133 KB).
