import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { WarningCircle } from '@phosphor-icons/react'
import { useApp } from './lib/app'
import type { Rol } from './lib/tipos'
import { Shell } from './components/Shell'
import { CargandoLista, Vacio, BotonEnlace } from './components/ui'
import { Catalogo } from './pages/Catalogo'
import { EventoDetalle } from './pages/EventoDetalle'
import { Ingresar, Registro, Confirmar } from './pages/Cuenta'
import { Verificar } from './pages/Verificar'

const MisInscripciones = lazy(() => import('./pages/MisInscripciones'))
const Encuesta = lazy(() => import('./pages/Encuesta'))
const Bandeja = lazy(() => import('./pages/Bandeja'))
const CorreoDemo = lazy(() => import('./pages/CorreoDemo'))
const Perfil = lazy(() => import('./pages/Perfil'))
const MisEventos = lazy(() => import('./pages/organizador/MisEventos'))
const EditorEvento = lazy(() => import('./pages/organizador/EditorEvento'))
const GestionEvento = lazy(() => import('./pages/organizador/GestionEvento'))
const Reportes = lazy(() => import('./pages/organizador/Reportes'))
const Ponente = lazy(() => import('./pages/Ponente'))
const Admin = lazy(() => import('./pages/admin/Admin'))

const PLURAL: Record<Rol, string> = {
  asistente: 'asistentes', organizador: 'organizadores', ponente: 'ponentes', admin: 'la administración',
}

function Requiere({ roles, children }: { roles?: Rol[]; children: ReactNode }) {
  const { usuario, listo } = useApp()
  const loc = useLocation()
  if (!listo) return <CargandoLista />
  if (!usuario) return <Navigate to={`/ingresar?volver=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (roles && !roles.includes(usuario.rol)) {
    return (
      <Vacio icono={<WarningCircle className="size-6" />} titulo="No tienes acceso a esta sección"
        accion={<BotonEnlace to="/">Ir a eventos</BotonEnlace>}>
        Esta página es solo para {roles.map((r) => PLURAL[r]).join(' o ')}.
      </Vacio>
    )
  }
  return <>{children}</>
}

function Arriba() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export function App() {
  const { listo, errorInicio } = useApp()

  if (errorInicio) {
    return (
      <Shell>
        <Vacio icono={<WarningCircle className="size-6" />} titulo="No se pudo iniciar CAPACITRON">
          {errorInicio} Recarga la página; si el problema sigue, prueba en otra pestaña o navegador.
        </Vacio>
      </Shell>
    )
  }

  return (
    <Shell>
      <Arriba />
      {!listo ? (
        <div className="space-y-4">
          <p className="text-sm text-tinta-3">Preparando la base de datos…</p>
          <CargandoLista />
        </div>
      ) : (
        <Suspense fallback={<CargandoLista />}>
          <Routes>
            <Route path="/" element={<Catalogo />} />
            <Route path="/eventos/:id" element={<EventoDetalle />} />
            <Route path="/ingresar" element={<Ingresar />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/confirmar/:token" element={<Confirmar />} />
            <Route path="/verificar" element={<Verificar />} />
            <Route path="/verificar/:codigo" element={<Verificar />} />
            <Route path="/correo-demo" element={<CorreoDemo />} />
            <Route path="/mis-inscripciones" element={<Requiere><MisInscripciones /></Requiere>} />
            <Route path="/encuestas/:id" element={<Requiere><Encuesta /></Requiere>} />
            <Route path="/bandeja" element={<Requiere><Bandeja /></Requiere>} />
            <Route path="/perfil" element={<Requiere><Perfil /></Requiere>} />
            <Route path="/organizador" element={<Requiere roles={['organizador']}><MisEventos /></Requiere>} />
            <Route path="/organizador/eventos/nuevo" element={<Requiere roles={['organizador']}><EditorEvento /></Requiere>} />
            <Route path="/organizador/eventos/:id/editar" element={<Requiere roles={['organizador']}><EditorEvento /></Requiere>} />
            <Route path="/organizador/eventos/:id" element={<Requiere roles={['organizador']}><GestionEvento /></Requiere>} />
            <Route path="/organizador/reportes" element={<Requiere roles={['organizador']}><Reportes /></Requiere>} />
            <Route path="/ponente" element={<Requiere roles={['ponente']}><Ponente /></Requiere>} />
            <Route path="/admin" element={<Requiere roles={['admin']}><Admin /></Requiere>} />
            <Route path="*" element={
              <Vacio titulo="Página no encontrada" accion={<BotonEnlace to="/">Ir a eventos</BotonEnlace>}>
                El enlace puede estar incompleto o la página ya no existe.
              </Vacio>
            } />
          </Routes>
        </Suspense>
      )}
    </Shell>
  )
}
