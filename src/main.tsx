import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles.css'
import { App } from './App'
import { AppProvider } from './lib/app'
import { ProveedorNotificaciones } from './components/notificaciones'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppProvider>
        <ProveedorNotificaciones>
          <App />
        </ProveedorNotificaciones>
      </AppProvider>
    </BrowserRouter>
  </StrictMode>,
)
