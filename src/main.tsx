import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {initBotId} from 'botid/client/core';
import App from './App.tsx';
import './index.css';

// Initialize Vercel BotID invisible protection for sensitive API routes
try {
  initBotId({
    protect: [
      {
        path: '/api/payment/create-order',
        method: 'POST',
      },
    ],
  });
} catch {
  // Ignore in local environments if BotID script is unavailable
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
