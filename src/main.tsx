import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary'
import { registerSW } from 'virtual:pwa-register'

console.log('🚀 main.tsx script started')

registerSW({ immediate: true })

// Get root element
const rootElement = document.getElementById('root')

if (!rootElement) {
  document.body.innerHTML = '<h1 style="color: red; padding: 20px;">ERROR: Root element not found!</h1>'
} else {
  try {
    console.log('Step 1: Clearing root element...')
    // Clear any existing content before React takes over
    rootElement.innerHTML = ''
    
    console.log('Step 2: Creating React root...')
    const root = createRoot(rootElement)
    
    console.log('Step 3: Rendering app...')
    root.render(
      <StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </StrictMode>
    )
    
    console.log('✅ App rendered successfully!')
  } catch (error) {
    console.error('❌ Failed to render:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : ''
    
    // Only set innerHTML if React failed to render
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; max-width: 800px; margin: 50px auto;">
        <h1 style="color: red; margin-bottom: 20px;">❌ Failed to Load Application</h1>
        <div style="background: #fee; border: 1px solid #fcc; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
          <strong>Error:</strong> ${errorMsg}
        </div>
        <details style="margin-bottom: 20px;">
          <summary style="cursor: pointer; color: #2563eb; font-weight: bold;">Show Full Error</summary>
          <pre style="background: #f5f5f5; padding: 15px; border-radius: 8px; overflow: auto; font-size: 11px; margin-top: 10px;">
${errorStack}
          </pre>
        </details>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px;">
          🔄 Reload Page
        </button>
        <p style="margin-top: 15px; color: #666; font-size: 14px;">
          Open browser console (F12) for more details.
        </p>
      </div>
    `
  }
}
