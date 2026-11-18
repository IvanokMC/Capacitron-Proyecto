# HU-19 · Plan y resultado de pruebas

**Historia:** CAP-86 · HU-19 Mapa con la ubicación y la hora del evento · **Tarea:** CAP-106 · **Responsable:** Andree (Product Owner y QA)

> Como asistente, quiero ver en un mapa dónde se realiza el evento y a qué hora empieza, para saber cómo llegar antes de inscribirme.

## 1. Alcance

| Pieza | Tarea | Qué prueban sus pruebas |
|---|---|---|
| Diseño del bloque y del selector | CAP-103 (Medaly) | Estados del bloque de ubicación y del selector |
| Coordenadas en la base de datos | CAP-104 (Carlos) | Rango, pareja, regla de publicación, editar y eventos antiguos |
| Mapa en la pantalla | CAP-105 (José) | Enlace «Cómo llegar», búsqueda, regla del formulario y que solo el adaptador conozca Leaflet |
| Historia completa | CAP-106 (Andree) | CA-01 a CA-05 de punta a punta: buscar → guardar → publicar → página del visitante → «Cómo llegar» |

## 2. Entorno

- **Automáticas:** `npx vitest run`.
  - La búsqueda usa un servicio falso que responde como Nominatim, con los datos reales de la UNSAAC tomados el 17/11/2026.
  - El mapa real (Leaflet) necesita un navegador, así que en las pruebas se reemplaza el adaptador.
- **Manuales:** `npm run dev` con internet (teselas de OpenStreetMap y búsqueda), en computadora y en un **celular real**, con «Carmen Valdivia» (organizadora) y una ventana sin sesión (visitante).

## 3. Matriz de trazabilidad

| Criterio | CAP-106 (aceptación) | También lo prueban | Resultado |
|---|---|---|---|
| **CA-01** Marcar la ubicación y guardar latitud y longitud | 4 pruebas | CAP-104, CAP-105 | Cumple |
| **CA-02** Mapa, dirección y hora de inicio en la página | 3 pruebas | CAP-103, CAP-105 | Cumple |
| **CA-03** «Cómo llegar» al punto correcto | 2 pruebas | CAP-105 | Cumple |
| **CA-04** Un evento virtual no muestra mapa | 2 pruebas | CAP-103, CAP-104 | Cumple |
| **CA-05** Coordenadas fuera de rango se rechazan | 3 pruebas + 1 pendiente (H-01) | CAP-104 | Cumple en la API; ver H-01 |

**Resultado automático reportado en el paquete (17/11/2026):** 14 pruebas de aceptación aprobadas y 1 pendiente (H-01). `npx tsc --noEmit` sin errores.

**Verificación de esta rama (18/11/2026):** la prueba de CAP-106 no pudo cargarse porque faltan `src/lib/mapa`, `src/lib/validacionEvento`, `src/components/UbicacionEvento` y `src/components/MapaEvento`. `npm test` terminó con 121 pruebas aprobadas y una suite fallida; TypeScript reportó esos módulos faltantes.

## 4. Casos manuales

Los ejecuta Andree antes de aceptar la historia. **M-05 a M-08 van en un celular real** (lo pide la tarea). Las capturas de CAP-105 muestran lo esperado.

| N.° | Criterio | Pasos | Resultado esperado | Resultado |
|---|---|---|---|---|
| M-01 | CA-01 | Como Carmen, crear un evento presencial, escribir «Universidad Nacional de San Antonio Abad del Cusco» en «Lugar» y elegir la sugerencia. | El mapa se acerca al campus y aparece «Punto marcado: 13,52… S · 71,95… O». | Cumple |
| M-02 | CA-01 | Tocar otro punto del mapa. | El marcador se mueve y cambian las coordenadas. | Cumple |
| M-03 | CA-01 | Pulsar «Quitar punto» e intentar publicar. | No se publica; el mapa queda marcado en rojo. | Cumple |
| M-04 | CA-02 | Marcar el punto, publicar y abrir la página del evento sin sesión. | Mapa con el punto, la dirección, la fecha y «empieza a las …». | Cumple |
| M-05 | CA-03 (celular) | En el celular, abrir la página y pulsar «Cómo llegar». | Se abre Google Maps (la app o la web) con las indicaciones hasta el campus. | Cumple |
| M-06 | CA-02 (celular) | Mover el mapa con el dedo y hacer zoom con dos dedos. | El mapa responde y la página no se desplaza por error. | Cumple |
| M-07 | CA-01 (celular) | Crear un evento desde el celular y marcar el punto tocando el mapa. | El punto queda donde se tocó. | Cumple |
| M-08 | Celular | Revisar la página del evento a lo ancho. | Sin desplazamiento horizontal; el botón se lee completo. | Cumple |
| M-09 | CA-04 | Abrir un evento virtual. | No hay mapa ni «Cómo llegar». | Cumple |
| M-10 | CA-05 / H-01 | En el formulario, arrastrar el mapa varias veces hacia un lado, hasta pasar el borde del mundo, y tocar. Guardar. | Debería guardarse; hoy sale «Las coordenadas están fuera de rango» (H-01). | No cumple: H-01 conocido; la longitud se sale del rango al tocar tras arrastrar el mapa más allá del borde del mundo. |

**Nota:** M-01 a M-09 se registran como cumplidos según la validación manual reportada por el equipo; no se reejecutaron en esta rama. M-10 corresponde al hallazgo H-01 ya documentado.

## 5. Hallazgos

| N.° | Gravedad | Hallazgo | Evidencia | Propuesta |
|---|---|---|---|---|
| H-01 | Baja (caso raro) | Si la organizadora arrastra el mapa del formulario más allá del borde del mundo (Leaflet repite el mapa a los lados) y toca, la longitud sale fuera de -180..180 (por ejemplo, -431,97). La API la rechaza como «fuera de rango» aunque el lugar sea válido. | El adaptador `MapaLeaflet.tsx` (CAP-105) envía `ev.latlng` sin normalizar. La API la rechaza (prueba de CA-05 con -431,97). Queda como `it.todo`. | En CAP-105, normalizar la longitud antes de avisar el punto (`ev.latlng.wrap()` de Leaflet), o limitar el arrastre con `maxBounds`. Es una línea. |
| O-01 | Observación | El mapa y la búsqueda necesitan internet (OpenStreetMap). Sin conexión, el bloque muestra «Cargando mapa…» y el formulario no sugiere direcciones; la dirección escrita y «Cómo llegar» siguen funcionando. | Diseño de CAP-105. | Aceptable para la historia; anotarlo en la guía de usuario. |

## 6. Decisión de aceptación

La toma Andree como Product Owner después de los casos manuales, sobre todo los de celular.

| Fecha | Decisión | Observaciones |
|---|---|---|
| 18/11/2026 | Aceptada | M-01 a M-09 cumplen según la validación manual reportada; M-10 reproduce el H-01 conocido, de baja gravedad y pendiente de corrección en CAP-105. La ejecución automática en esta rama queda bloqueada por la ausencia de esas dependencias. |
