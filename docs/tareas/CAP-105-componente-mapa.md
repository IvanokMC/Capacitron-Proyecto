# CAP-105 · HU-19 Componente de mapa

**Documentación de la tarea** · Rol: Frontend (José) · Sprint 2 · Cronograma: n.° 16

> Las capturas que se mencionan están en el pull request de esta tarea; no se guardan en el repositorio para no agrandarlo.

**Tarea:** HU-19 · Frontend: componente de mapa para mostrar y elegir la ubicación · **Responsable:** José (Frontend) · **Historia:** CAP-86 (HU-19 Mapa con la ubicación y la hora del evento), criterios **CA-01 a CA-04**.

## Qué se entrega

1. **`MapaEvento`** (componente propio): dos modos.
   - **Mostrar** un punto: página del evento, CA-02.
   - **Elegir** un punto: formulario, CA-01. Cada toque avisa el punto con `onElegir`.
   - Las pantallas solo conocen este componente.
2. **`MapaLeaflet`** (adaptador): el único archivo que importa Leaflet, con teselas de OpenStreetMap (sin clave ni costo).
   - Se carga aparte con `React.lazy`: las páginas sin mapa no lo descargan.
   - El marcador es propio, en SVG con el color del sistema. El de Leaflet depende de imágenes que el empaquetador no encuentra.
   - En modo «mostrar» la rueda del ratón no hace zoom, para no secuestrar el desplazamiento de la página.
   - Al marcar el primer punto, el mapa se centra y se acerca.
3. **`lib/mapa.ts`:**
   - `enlaceComoLlegar`: indicaciones de Google Maps, CA-03.
   - `puntoDe` y `redondear`: 6 decimales, como la base de datos.
   - `buscarDirecciones` y `useBusquedaDirecciones`: Nominatim, solo en Perú y en español, con espera de 600 ms. El texto que se envía es la dirección pública del evento.
4. **`EventoDetalle.tsx`:** debajo del panel de inscripción va el bloque de Medaly (CAP-103) con el mapa, la dirección, «martes, 17 de noviembre de 2026, empieza a las 17:00 h» y «Cómo llegar». En un evento virtual no aparece (CA-04).
5. **`EditorEvento.tsx`:**
   - El campo «Lugar» es el selector de CAP-103: escribir busca direcciones, y elegir una sugerencia o tocar el mapa marca el punto.
   - Envía `latitud` y `longitud`, que van vacías en virtual.
   - Si la API rechaza las coordenadas, el error aparece en el mapa.
6. **`validacionEvento.ts`:** publicar exige el punto en presencial o mixto, con el mismo campo (`ubicacion`) y el mismo orden que la API (CAP-104). Una prueba lo compara.
7. **`package.json`:** `leaflet` 1.9.4 y `@types/leaflet`.

## Capturas (`capturas/`, en la app real, modo local, con el mapa real)

| Imagen | Qué muestra |
|---|---|
| `1_editor_sin_punto.png` | Formulario de un evento sin punto: el mapa con «Toca el mapa para marcar el lugar» |
| `2_editor_sugerencias.png` | Al escribir el nombre de la universidad aparece la sugerencia de OpenStreetMap |
| `3_editor_punto_marcado.png` | Punto marcado en el campus, con «13,5218° S · 71,9588° O» y «Quitar punto» |
| `4_detalle_con_mapa.png` | Página pública: mapa con el punto, la dirección, la hora de inicio y «Cómo llegar» |
| `5_evento_virtual_sin_mapa.png` | Evento virtual: no hay bloque de ubicación |
| `6_movil_detalle.png` | La página pública en celular (390 px), sin desplazamiento horizontal |

Se usó la cuenta de demostración «Carmen Valdivia», solo en localhost. El punto salió de la búsqueda real en OpenStreetMap. El enlace verificado es `https://www.google.com/maps/dir/?api=1&destination=-13.521786,-71.958762`.

## Archivos

| Archivo | Cambio |
|---|---|
| `src/components/MapaEvento.tsx` | Nuevo: componente propio de mapa (mostrar y elegir un punto); carga Leaflet aparte |
| `src/components/MapaLeaflet.tsx` | Nuevo: adaptador de Leaflet + OpenStreetMap; el único archivo que importa Leaflet |
| `src/lib/mapa.ts` | Nuevo: «Cómo llegar», lectura del punto y búsqueda de direcciones (Nominatim) |
| `src/pages/EventoDetalle.tsx` | Modificado: bloque de ubicación con el mapa en la página del evento |
| `src/pages/organizador/EditorEvento.tsx` | Modificado: selector de ubicación con búsqueda y mapa; envía latitud y longitud |
| `src/lib/validacionEvento.ts` | Modificado: publicar exige el punto en presencial o mixto (misma regla que la API) |
| `src/lib/tipos.ts` | Modificado: `latitud` y `longitud` en `Evento` |
| `package.json` | Modificado: dependencias `leaflet` y `@types/leaflet` |
| `package-lock.json` | Modificado: versiones exactas de esas dependencias |
| `tests/cap105-mapa.test.ts` | Nuevo: 13 pruebas |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Adapter** (diap. 126–132) | `MapaLeaflet` traduce la interfaz propia (`PropsMapa`) a la de Leaflet. Cambiar a Google Maps sería escribir otro adaptador con las mismas props. Una prueba comprueba que ningún otro archivo importa Leaflet. |
| **DIP** (diap. 92–106) | Las pantallas dependen de `MapaEvento`, no de la librería. La búsqueda recibe `fetch` por parámetro, y las pruebas le pasan uno falso. |
| **SRP** (diap. 39–49) | El diseño (CAP-103) muestra, el adaptador dibuja el mapa, `lib/mapa.ts` arma enlaces y busca, y las páginas solo conectan. |
| **Evitar sobreingeniería** (diap. 135–139) | Un punto y una búsqueda; sin rutas, capas ni geolocalización del visitante. |
| **Refactorizar con pruebas** (diap. 140) | 13 pruebas. Leaflet necesita un navegador, así que en las pruebas se reemplaza el adaptador y el mapa real se revisó en las capturas. |

## Resultado de las pruebas

- Pruebas de esta tarea: **13 aprobadas**.
- En la etapa de la tarea (CAP-100 + CAP-103 + CAP-104): **266 aprobadas**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: 363 aprobadas y 2 pendientes. Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **Leaflet va en un archivo aparte:** `MapaLeaflet-*.js` de 146,7 KB, más su CSS de 14,8 KB. Solo se descarga en la página del evento y en el formulario.
- **JS total del build:** 162,2 KB más; fuera de ese archivo, unos 15 KB.
- **Consultas:** sin cambios.

## Cosas que se corrigieron al probar en el navegador

- Al elegir una sugerencia, el punto aparecía pero el mapa seguía lejos. Ahora el primer punto centra y acerca el mapa; moverlo después solo desplaza si sale de la vista.
- La sugerencia mostraba «…del Cusco, 733» (el número de la calle pegado al nombre). Ahora usa el nombre del lugar y deja la dirección en la segunda línea, sin números sueltos.

## Notas

- **Uso de OpenStreetMap:** las teselas y Nominatim son gratuitos con límites (una búsqueda por segundo, uso moderado). Para un proyecto académico alcanzan. La búsqueda espera 600 ms entre teclas, y el mapa muestra la atribución «© OpenStreetMap», que es obligatoria.
- **`npm audit`** reporta 9 vulnerabilidades que ya existían antes de esta tarea; Leaflet no agrega ninguna.
