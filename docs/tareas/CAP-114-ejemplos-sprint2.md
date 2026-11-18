# CAP-114 · Ejemplos del Sprint 2 y despliegue completo en Supabase

**Responsable:** George Iván Muñoz Castillo (Scrum Master · DevOps, integración y calidad de diseño)
**Historias:** HU-02 y HU-15 a HU-20
**Fecha:** 18/11/2026

## Qué se hizo

1. **Supabase al día.** Se aplicaron en el proyecto `bdjftrlubrnterncjuft` las 10 migraciones del Sprint 2 que faltaban, en el orden del README, y se desplegó la Edge Function `url-comprobante`.
2. **Un ejemplo de cada función nueva.** La función `capa.sembrar_ejemplos()` (migración `20261124000001_ejemplos_sprint2.sql`) completa la demostración:

| Historia | Ejemplo | Dónde se ve |
|---|---|---|
| HU-02 | Tipo, organizador y contacto en todos los eventos de la demo | Catálogo y detalle del evento |
| HU-15 | 4 eventos próximos: congreso, taller, seminario mixto y curso virtual | Catálogo, filtros por tipo, precio, fechas y ubicación |
| HU-16 | QR de Yape, cuenta y WhatsApp de ejemplo; 2 pagos por verificar (Ana Lucía y Paola) y 1 aprobado (Kevin) en el congreso | Mis inscripciones → Pagar; Administración → Pagos |
| HU-17 | Foto de perfil (ilustración) de Ana Lucía, Diego, Valeria, Raúl y Carmen | Menú, Mi perfil, lista de inscritos |
| HU-18 | Celulares de ejemplo; en el seminario, unos comparten el celular y otros no | Organizador → Gestión del seminario → Inscritos (botón de WhatsApp) |
| HU-19 | Punto en el mapa en los presenciales y en el mixto; el virtual no tiene mapa | Detalle del evento y «Cómo llegar» |
| HU-20 | Flyer en 10 eventos e imagen del lugar en los presenciales | Catálogo y detalle del evento |

3. **Imágenes de ejemplo** en `public/ejemplos/`: flyers, imágenes del lugar, avatares ilustrados (no son fotos de personas), un QR que no recibe pagos y constancias con la marca «EJEMPLO · NO ES UN PAGO REAL». Las mismas están subidas a Supabase Storage, en la ruta que exige cada bucket. En modo local, `almacenamiento/local.ts` las sirve desde `public/ejemplos` (función `rutaEjemplo`).

## Reglas que se cumplen

- **Todo dice que es de ejemplo:** operaciones `EJEMPLO-100x`, celulares 900 000 1xx, «Banco de ejemplo», archivos `ejemplo-….png` y la frase «Evento de ejemplo para mostrar CAPACITRON».
- **Idempotente:** se puede ejecutar varias veces; solo llena lo vacío y no repite eventos, inscripciones ni pagos.
- **No toca** cuentas ni eventos que no sean de la demostración (las cuentas reales del equipo quedan igual), ni datos que ya tengan valor.
- **No cambia las pruebas de los compañeros:** `capa.sembrar_demo` sigue igual. Los ejemplos los siembran la app en modo local (`migraciones.ts`), `supabase/reiniciar_demo.sql` y la propia migración (para la base de Supabase).

## Teoría de Diseño de Software

- **OCP (diap. 50–63):** la siembra existente no se reescribe; se agrega una función que la complementa.
- **Encapsulación (diap. 20–24):** los ejemplos pasan por las mismas restricciones que los datos reales (rutas válidas, celulares válidos, pagos con su inscripción).
- **LSP (diap. 64–79):** el almacenamiento local sigue devolviendo `null` para cualquier ruta sin archivo que no sea un ejemplo, como promete el contrato.
- **Mantenibilidad y pruebas (diap. 137 y 140):** `tests/cap114-ejemplos.test.ts` comprueba cada ejemplo con la API real y que repetir la siembra no duplica nada.

## Comprobación

- `npx tsc --noEmit` sin errores.
- `npm test`: 561 pruebas en verde (4 pendientes marcadas a propósito).
- En https://capacitron.vercel.app: el catálogo muestra los 5 eventos próximos con flyer; el congreso muestra el flyer, el mapa con el punto en la UNSAAC, el precio y los cupos.
