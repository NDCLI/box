import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import posthog from 'posthog-js';

// Initialize PostHog if key is present
if (import.meta.env.VITE_POSTHOG_KEY) {
  console.log("Initializing PostHog on Vercel...");
  let posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  if (!posthogHost.startsWith('http')) {
    posthogHost = 'https://' + posthogHost;
  }
  
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: posthogHost,
    loaded: (posthog) => {
      console.log("PostHog loaded successfully!");
    }
  });
} else {
  console.warn("VITE_POSTHOG_KEY is missing in environment variables!");
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
