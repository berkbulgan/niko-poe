// ABOUTME: Vite entry point — mounts the React Router app into #root.
// ABOUTME: Shows a loading screen while fetching bulk price data from poe.watch on startup.

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { Providers } from './providers';
import { fetchAllPrices } from './lib/ipc';
import './globals.css';

function App() {
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState('Loading price data...');

  useEffect(() => {
    async function init() {
      try {
        setStatus('Fetching prices from poe.watch...');
        const count = await fetchAllPrices('Mirage');
        setStatus(`Loaded ${count.toLocaleString()} items`);
      } catch {
        setStatus('Price fetch failed — continuing without prices');
      }
      // Brief pause so user sees the result
      await new Promise((r) => setTimeout(r, 400));
      setReady(true);
    }
    void init();
  }, []);

  if (!ready) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-4 bg-poe-bg">
        <h1 className="text-2xl font-bold tracking-wider text-poe-gold">N.I.K.O.</h1>
        <p className="text-sm text-poe-text-muted">{status}</p>
        <div className="h-1 w-48 overflow-hidden rounded bg-poe-panel-light">
          <div className="h-full animate-pulse rounded bg-poe-gold/60" style={{ width: '60%' }} />
        </div>
      </div>
    );
  }

  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
