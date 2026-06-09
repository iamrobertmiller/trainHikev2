import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import './index.css'
import App from './App.tsx'

posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
  api_host: import.meta.env.VITE_POSTHOG_HOST ?? 'https://us.i.posthog.com',
  autocapture: true,
  capture_pageview: true,
  capture_pageleave: true,
  session_recording: {
    maskAllInputs: false,
  },
  loaded: (ph) => {
    if (import.meta.env.DEV) ph.debug()
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
