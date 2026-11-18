# CAP-107 · Proveedor de mapas: elección, encapsulamiento y cabeceras

**Documentación de la tarea** · Rol: DevOps (George) · Historia: HU-19 Mapa con la ubicación y la hora del evento (CAP-86) · Sprint 2

## 1. Proveedor elegido: Leaflet + OpenStreetMap

| Criterio | Leaflet + OpenStreetMap | Google Maps |
|---|---|---|
| Clave y facturación | No necesita clave ni tarjeta | Necesita clave de API y una cuenta con facturación |
| Costo para el volumen de CAPACITRON | Gratis, con la política de uso justo de OpenStreetMap | Gratis hasta un cupo mensual; después se cobra |
| Búsqueda de direcciones | Nominatim (gratis, máximo 1 pedido por segundo) | Places API (con costo) |
| Peso en el navegador | Leaflet: 146,8 KB (42,7 KB con gzip), en un archivo aparte | El script de Google se descarga desde sus servidores en cada visita |
| Riesgo | Hay que respetar la atribución y no abusar de los servidores públicos | Clave expuesta en el navegador y costo si alguien la abusa |

**Decisión:** Leaflet + OpenStreetMap. Cumple la HU-19 sin costo ni claves. Si el tráfico creciera mucho, se cambia a un proveedor de mosaicos con clave (por ejemplo, uno que sirva los mismos mosaicos de OpenStreetMap) **tocando un solo archivo**.

## 2. Encapsulamiento (Adapter)

El proveedor queda detrás de un componente propio, que hizo José en CAP-105:

- `src/components/MapaEvento.tsx`: lo único que usan las pantallas (mostrar un punto o elegirlo).
- `src/components/MapaLeaflet.tsx`: el adaptador; es el **único archivo que importa Leaflet**. Una prueba de CAP-105 lo comprueba.
- `src/lib/mapa.ts`: «Cómo llegar» (Google Maps por enlace, sin clave) y la búsqueda con Nominatim.

Cambiar de proveedor = escribir otro adaptador con las mismas props y cambiar una línea en `MapaEvento.tsx`.

## 3. Peso y carga solo donde se usa

Medido en el build de producción con todas las tareas del Sprint 2 preparadas (17/11):

| Archivo | Tamaño | Cuándo se descarga |
|---|---|---|
| `MapaLeaflet-*.js` | 146,8 KB (42,7 KB con gzip) | Solo cuando una página muestra el mapa (`React.lazy`) |
| `MapaLeaflet-*.css` | 14,8 KB | Junto con el anterior |
| Archivo principal (`index-*.js`) | No incluye código de Leaflet | Al entrar a la app |

Las páginas sin mapa (catálogo, perfil, administración, etc.) no descargan Leaflet. Mientras se carga, el bloque dice «Cargando mapa…».

## 4. Cabeceras de `vercel.json`

| Revisión | Resultado |
|---|---|
| ¿Hay una política de contenido (CSP) que bloquee los mosaicos o la búsqueda? | No hay CSP; los mosaicos (`tile.openstreetmap.org`) y Nominatim cargan. Una prueba avisa si alguien agrega una CSP sin esos dominios. |
| ¿Se envía el origen del sitio? | **Se agregó `Referrer-Policy: strict-origin-when-cross-origin`** a todas las páginas. La política de uso de OpenStreetMap y de Nominatim pide identificar el sitio que hace los pedidos; antes dependía del valor por defecto de cada navegador. |
| ¿Se rompió algo de lo anterior? | No: se mantienen `Permissions-Policy: camera=(self)` (escáner de QR) y la caché de `/assets/`. |

## 5. Uso responsable de los servicios públicos

- La atribución «© OpenStreetMap» se muestra en cada mapa (lo exige la licencia).
- La búsqueda espera 600 ms después de que la persona deja de escribir y solo busca con 3 letras o más, para no pasar de 1 pedido por segundo.
- El mapa del visitante no hace zoom con la rueda del ratón, para no pedir mosaicos de más al desplazarse por la página.

## Teoría de Diseño de Software

| Principio | Dónde |
|---|---|
| Adapter (diap. 126–132) | `MapaLeaflet` traduce las props propias a Leaflet |
| Mantenibilidad (diap. 137) | Cambiar de proveedor toca un archivo; las pruebas de `vercel.json` cuidan que el mapa cargue en producción |
| Evitar sobreingeniería (diap. 135–139) | Sin clave, sin servidor de mosaicos propio y sin librerías extra |

## Pruebas

`tests/cap107-proveedor-mapas.test.ts`: la `Referrer-Policy`, que una CSP futura no bloquee el mapa y que se mantengan las cabeceras anteriores.

## Pendiente

- Al integrar la HU-19, abrir la vista previa de Vercel y comprobar que el mapa y la búsqueda funcionan.
