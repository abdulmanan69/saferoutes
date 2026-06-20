import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA: register the service worker (production only — it interferes with dev HMR).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      // Update flow: when a new version is ready, offer a one-tap reload.
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) {
            if (window.confirm('A new version of SafeRoute is available. Reload now?')) {
              sw.postMessage('SKIP_WAITING')
            }
          }
        })
      })
      let refreshed = false
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshed) { refreshed = true; window.location.reload() }
      })
    } catch { /* offline support unavailable */ }
  })
}
