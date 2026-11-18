# CAP-99 · HU-18 Celular y consentimiento en la base de datos

**Documentación de la tarea** · Rol: Backend y base de datos (Carlos) · Sprint 2 · Cronograma: n.° 10

**Tarea:** HU-18 · Backend: celular y consentimiento del usuario · **Responsable:** Carlos (Backend y base de datos) · **Historia:** CAP-85 (HU-18 Celular del asistente), criterios **CA-01 a CA-04**.

## Qué se entrega

1. **Migración `20261119000001_celular_usuario.sql`:**
   - **Columnas nuevas en `capa.usuarios`:**
     - `celular`: 9 dígitos que empiezan con 9. Una restricción `check` lo impide en la tabla misma, aunque alguien escriba directo.
     - `comparte_celular`: el consentimiento. Es falso por defecto y no puede ser verdadero sin celular.
     - `celular_consentido_en`: cuándo se dio el consentimiento vigente. Se borra al retirarlo; es la evidencia que pide la Ley N.° 29733.
   - **`registrar_usuario` (CA-01 y CA-02):**
     - Exige el celular. Si falta, lo nombra junto a los demás campos que faltan; si está mal, responde «El celular debe tener 9 dígitos y empezar con 9.».
     - Quita espacios, guiones y el prefijo +51.
     - Guarda el consentimiento solo si se marcó.
   - **`actualizar_perfil` (CA-03):**
     - Cambia el celular y da o retira el consentimiento.
     - Si la llamada no trae esos campos, no los toca.
     - Quien ya tiene celular no lo puede borrar: para ocultarlo, retira el consentimiento.
     - Una cuenta antigua sin celular sigue funcionando y lo completa cuando quiera.
   - **`evento_gestion` (CA-02 y CA-04):** el celular de cada inscrito sale solo para el organizador del evento (lo exige `evento_del_organizador`), solo con consentimiento y solo si la inscripción está activa. Si no, llega `null`. La lista de espera no lo trae.
   - **`usuario_json`:** devuelve el celular y el consentimiento de la propia cuenta. Esta función solo responde a la propia sesión (registro, sesión y perfil).
2. **`tipos.ts`:** `celular` y `comparte_celular` en `Usuario`, para que José los use en CAP-100.
3. **Pruebas que registraban cuentas:** ahora mandan un celular, porque es obligatorio. Son `tests/bd.ts`, `hu01-02`, `reinicio-demo` y el script `verificar-supabase.mjs`.

**No incluye** el formulario, la validación en pantalla ni el botón de WhatsApp: eso es CAP-100 (José), con los componentes de CAP-98 (Medaly).

**Integración:** desde aquí el registro exige el celular, y el formulario lo envía recién en CAP-100. George debe integrar CAP-99 y CAP-100 juntos.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/migrations/20261119000001_celular_usuario.sql` | Nuevo: columnas del celular y del consentimiento; registro, perfil e inscritos con el celular |
| `src/lib/backend/migraciones.ts` | Modificado: migración de CAP-99 en el modo local |
| `src/lib/tipos.ts` | Modificado: `celular` y `comparte_celular` en `Usuario` |
| `tests/bd.ts` | Modificado: migración nueva y celular en las cuentas de prueba |
| `tests/cap99-celular-usuario.test.ts` | Nuevo: 27 pruebas |
| `tests/hu01-02-cuentas-eventos.test.ts` | Modificado: el registro de prueba trae celular (ahora es obligatorio) |
| `tests/reinicio-demo.test.ts` | Modificado: el registro de prueba trae celular |
| `tests/supabase/verificar-supabase.mjs` | Modificado: la verificación contra Supabase registra cuentas con celular |

## Teoría de Diseño de Software aplicada (diapositivas del curso)

| Principio | Dónde se aplica |
|---|---|
| **Encapsulación y ocultamiento de información** (diap. 20–24) | El celular sale solo por `evento_gestion` (dueño del evento y consentimiento) y por `usuario_json` (la propia cuenta). Las funciones públicas nunca lo tocan, y una prueba lo comprueba. |
| **ISP** (diap. 80–91) | Cada respuesta trae solo lo que su pantalla necesita: la lista de espera y las vistas públicas no reciben el celular. |
| **Code smells: duplicación** (diap. 33) | El formato vive en `capa.celular_valido`, que usan la restricción de la columna, el registro y el perfil. El mensaje vive en `capa.mensaje_celular`. |
| **Evitar sobreingeniería** (diap. 135–139) | Un texto con `check` basta; no se creó una tabla de teléfonos ni una librería de validación. |
| **Refactorizar con pruebas** (diap. 140) | 27 pruebas fijan cada criterio y las anteriores confirman que el resto sigue igual. |

Postgres no permite extender una función sin volver a declararla. Por eso `registrar_usuario` (Sprint 1) y `usuario_json`, `actualizar_perfil` y `evento_gestion` (tu CAP-94) se copiaron completas, con lo nuevo marcado «CAP-99».

## Resultado de las pruebas

- Pruebas de esta tarea: **27 aprobadas**:
  - celular obligatorio, formatos válidos e inválidos, normalización y la restricción en la tabla;
  - consentimiento falso por defecto y con fecha al darlo;
  - el organizador lo ve solo con consentimiento;
  - cambiarlo, retirarlo y volver a darlo;
  - cuentas antiguas;
  - otro organizador o un asistente no pueden ver la lista;
  - inscripción cancelada y lista de espera sin celular;
  - ninguna función pública lo devuelve.
- En la etapa de la tarea (después de CAP-80): **173 aprobadas**, y `tsc` sin errores.
- Con todo lo preparado del Sprint 2: **265 aprobadas y 1 pendiente** (H-01 de la HU-15). Ver `pruebas.txt`.

## Rendimiento (`rendimiento.json`)

- **Consultas:** iguales. La versión anterior y CAP-99 se midieron una tras otra; por ejemplo, `evento_gestion` pasó de 1,6 a 1,52 ms.
- **Build:** 17,1 KB más de JS, por el SQL de la migración que lleva el modo local.
