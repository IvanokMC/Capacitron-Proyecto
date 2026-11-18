# CAP-106 · HU-19 Pruebas del mapa y las coordenadas

**Documentación de la tarea** · Rol: QA y pruebas (Andree) · Sprint 2 · Cronograma: n.° 18

**Tarea:** HU-19 · QA: pruebas del mapa y de las coordenadas · **Responsable:** Andree (Product Owner y QA) · **Historia:** CAP-86 (HU-19), criterios **CA-01 a CA-05**.

## Qué se entrega

1. **Pruebas de aceptación** (`tests/cap106-aceptacion-hu19.test.ts`): 14 pruebas escritas como «Dado… cuando… entonces…».
   - **Recorrido:**
     1. La organizadora busca la dirección. Se usa un servicio falso que responde como Nominatim, con los datos reales de la UNSAAC.
     2. Guarda el punto como lo envía el formulario y publica.
     3. El visitante abre la página y pulsa «Cómo llegar».
   - **Comprueban:**
     - presencial y mixto sin punto no se publican (pantalla y API);
     - la hora sale en hora de Lima;
     - un evento antiguo sin punto muestra la dirección sin mapa;
     - el enlace lleva **exactamente** al punto elegido y cambia si se mueve el punto;
     - virtual y «pasar a virtual» no muestran mapa;
     - tres coordenadas fuera de rango se rechazan sin guardar nada.
2. **Plan de pruebas** (`docs/pruebas/HU-19/PLAN_DE_PRUEBAS.md`; también suelto en esta carpeta): matriz, **10 casos manuales, 4 de ellos en celular real** (lo pide la tarea), hallazgos y la tabla para tu decisión.

El mapa real (Leaflet) necesita un navegador. Por eso en las pruebas automáticas se reemplaza el adaptador, y el mapa se prueba a mano en los casos manuales.

## Hallazgos

| N.° | Hallazgo | Propuesta |
|---|---|---|
| **H-01** | Si se arrastra el mapa del formulario más allá del borde del mundo (Leaflet lo repite a los lados) y se toca, la longitud sale fuera de -180..180. La API la rechaza «fuera de rango», aunque el lugar sea válido. | En CAP-105 (José), normalizar la longitud con `ev.latlng.wrap()`. Es una línea. Queda como prueba pendiente. |
| **O-01** | El mapa y la búsqueda necesitan internet. Sin conexión siguen funcionando la dirección y «Cómo llegar». | Aceptable; anotarlo en la guía de usuario. |

## Archivos

| Archivo | Cambio |
|---|---|
| `tests/cap106-aceptacion-hu19.test.ts` | Nuevo: 14 pruebas de aceptación de CA-01 a CA-05 y 1 pendiente (H-01) |
| `docs/pruebas/HU-19/PLAN_DE_PRUEBAS.md` | Nuevo: plan, matriz, 10 casos manuales (4 en celular), hallazgos y decisión de aceptación |

## Teoría

**Refactorizar con pruebas** (diap. 140): si alguien cambia la API de coordenadas, la búsqueda o el bloque de ubicación, estas pruebas dicen qué criterio se rompió.

## Resultado de las pruebas

- Pruebas de aceptación: **14 aprobadas y 1 pendiente** (H-01).
- En la etapa de la tarea (después de CAP-105): **280 aprobadas y 1 pendiente**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: 391 aprobadas y 3 pendientes. Ver `pruebas.txt`.

## Rendimiento

La app no cambia: solo se agregan pruebas y documentación. `rendimiento.json` es la medición de CAP-108, que tiene el mismo código de la app.
