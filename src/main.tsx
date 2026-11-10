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

const rootEl = document.getElementById('root');
if (rootEl) {
  try {
    const root = createRoot(rootEl);
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  } catch (err: any) {
    console.error('[FoodFax Mount Error]', err);
    rootEl.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #F8F9FA; font-family: sans-serif; padding: 24px;">
        <div style="background: white; border: 1px solid #E2E8F0; border-radius: 20px; padding: 28px; max-width: 440px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.08);">
          <div style="font-size: 40px; margin-bottom: 12px;">⚠️</div>
          <h2 style="font-size: 18px; font-weight: 800; color: #0F172A; margin: 0 0 8px 0;">Application Startup Error</h2>
          <p style="font-size: 13px; color: #64748B; margin: 0 0 18px 0; line-height: 1.5;">${err?.message || 'Failed to start the application.'}</p>
          <button onclick="window.location.reload()" style="background: #EA580C; color: white; border: none; padding: 10px 22px; border-radius: 12px; font-weight: 700; cursor: pointer;">Reload Application</button>
        </div>
      </div>
    `;
  }
}
