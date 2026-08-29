import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles.css'
import { NewTabApp } from './NewTabApp'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NewTabApp />
  </StrictMode>,
)
