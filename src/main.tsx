import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { checkSupabaseConnection } from './lib/supabase'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('找不到應用程式根節點')
}

void checkSupabaseConnection()

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
