import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import { OptionsApp } from './OptionsApp'

// Apply saved theme before first render to prevent flash
;(function () {
  const t = localStorage.getItem('theme') || 'system'
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  if (t === 'dark' || (t === 'system' && prefersDark)) {
    document.documentElement.setAttribute('data-mode', 'dark')
  }
})()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OptionsApp />
  </StrictMode>,
)
