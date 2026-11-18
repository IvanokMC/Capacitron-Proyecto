# CAP-102 · Revisión de datos personales del celular, demo e integración de la HU-18

**Documentación de la tarea** · Rol: DevOps (George) · Historia: HU-18 Celular del asistente (CAP-85) · Sprint 2

## 1. Revisión: ¿dónde sale el celular?

Se revisaron las funciones que devuelven datos de personas, con las cuentas de la demo (todas con números de ejemplo). La prueba busca los números en la respuesta completa de cada función.

| Quién pregunta | Funciones revisadas | Resultado |
|---|---|---|
| Visitante sin sesión | `catalogo_eventos` (próximos y pasados), `detalle_evento` de cada evento, `verificar_certificado`, `instituciones_publicas`, `estado_sistema`, `medios_pago` | No sale ningún celular |
| Otro asistente | `mis_inscripciones`, `detalle_evento`, `sesion_actual` | Solo ve el suyo, en su propia sesión |
| Ponente | `eventos_ponente` | No ve los de los asistentes |
| Organizador de otra institución | `eventos_organizador`, `reporte_participacion`, `evento_gestion` de sus eventos | No ve celulares de quienes no están en sus eventos |
| Administración | `admin_usuarios`, `admin_resumen`, `admin_historial` | No ve celulares (no los necesita) |
| Organizador del evento | `asistencia_evento`, `certificados_evento`, `reporte_participacion` | No traen celulares |
| Organizador del evento | `evento_gestion` | **Sí:** el de quien dio permiso y está inscrito; no el de quien no lo dio (regla de CAP-99) |

**Conclusión:** el celular solo sale donde lo pide la historia (la lista de inscritos del organizador, con permiso). No hizo falta cambiar ninguna función.

## 2. Datos de demostración

`supabase/migrations/20261123000001_demo_celulares.sql`: la siembra del Sprint 1 queda como `capa.sembrar_demo_base` y la nueva `capa.sembrar_demo` la llama y agrega celulares de ejemplo (rango 900 000 1xx, no son de personas reales):

| Cuenta | Celular | Permiso |
|---|---|---|
| Ana Lucía (estudiante) | 900 000 101 | Sí |
| Diego | 900 000 102 | Sí |
| Luis Alberto | 900 000 104 | Sí |
| Valeria | 900 000 103 | No |
| Raúl (ponente) | 900 000 110 | No |

Las demás cuentas quedan sin celular, como las creadas antes de la HU-18. El modo local, las pruebas y `reiniciar_demo.sql` siguen llamando a `capa.sembrar_demo()`.

**Ajuste en una prueba de CAP-99 (Carlos):** decía que ninguna cuenta de la demo tiene celular. Ahora comprueba que solo las 5 de ejemplo lo tienen. La garantía de CAP-99 se mantiene: la migración no inventa celulares.

## 3. Tipos de TypeScript

Revisados: `Usuario` tiene `celular` y `comparte_celular` (CAP-99), y la lista de inscritos del organizador trae el celular solo cuando corresponde (CAP-100). No hizo falta cambiarlos.

## Teoría de Diseño de Software

| Principio | Dónde |
|---|---|
| Encapsulación (diap. 20–24) | El celular solo sale por `evento_gestion` y con permiso |
| ISP (diap. 80–91) | Cada función entrega solo lo que su pantalla necesita (la administración no recibe celulares) |
| OCP (diap. 50–63) | La siembra de la demo se extiende envolviéndola, sin reescribirla |
| Refactorizar con pruebas (diap. 140) | La revisión queda como prueba automática: si una función nueva filtra el celular, falla |

## Pruebas

`tests/cap102-privacidad-celular.test.ts`: 9 pruebas (datos de demo, visitante, otras personas con sesión, administración y organizador).

## Integración y pendiente

- Va después de CAP-99, CAP-100 y CAP-101 (HU-18), que suben el 21, 22 y 23/11.
- En Supabase (George, en el SQL Editor): ejecutar `20261119000001_celular_usuario.sql` (CAP-99) y después `20261123000001_demo_celulares.sql`.
