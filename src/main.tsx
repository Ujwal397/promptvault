import './zodJitless'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './ui/styles/fonts.css'
import './ui/styles/shell.css'
import './ui/styles/controls.css'
import './ui/styles/write.css'
import './ui/styles/motion.css'
import App from './App.tsx'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element in index.html')

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
