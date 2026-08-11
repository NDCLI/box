import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const posthogKey = import.meta.env.VITE_POSTHOG_KEY;

// Analytics must never delay the application or file-processing workflow.
if (posthogKey) {
  let posthogHost = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com';
  if (!posthogHost.startsWith('http')) {
    posthogHost = 'https://' + posthogHost;
  }

  void import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(posthogKey, { api_host: posthogHost });
    })
    .catch((error: unknown) => {
      console.warn('Không thể khởi tạo analytics:', error);
    });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
