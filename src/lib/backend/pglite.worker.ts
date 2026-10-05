// Worker compartido: una sola instancia de Postgres (PGlite) para todas las
// pestañas abiertas. La pestaña líder la ejecuta; las demás le delegan consultas.
// Sin «relaxedDurability»: cada cambio se guarda en IndexedDB antes de responder,
// para no perder datos si la pestaña se recarga o se cierra enseguida.
import { PGlite } from '@electric-sql/pglite'
import { worker } from '@electric-sql/pglite/worker'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { live } from '@electric-sql/pglite/live'
import { migrar } from './migraciones'

worker({
  async init() {
    const db = await PGlite.create('idb://capacitron', { extensions: { pgcrypto, live } })
    await migrar(db)
    return db
  },
})
