// ABOUTME: Vite entry point — mounts the React Router app into #root; the overlay window renders only <Overlay />.
// ABOUTME: The main window applies saved map mod data before the first render, then refreshes game data from the server.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { Providers } from './providers';
import { Overlay } from './pages/Overlay';
import { QueryProvider } from '@/lib/query-provider';
import { isOverlayWindow } from '@/lib/platform';
import { loadCachedMapMods, startGameDataRefresh } from '@/lib/stores/game-data-store';
import { startAtlasRefresh } from '@/lib/atlas-data';
import './globals.css';

function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

const overlay = isOverlayWindow();
if (overlay) document.documentElement.classList.add('overlay-window');

// Saved data first, so the Regex page never renders on bundled data and then jumps.
if (!overlay) await loadCachedMapMods();

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    {overlay ? (
      <QueryProvider>
        <Overlay />
      </QueryProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>
);

if (!overlay) {
  startGameDataRefresh();
  startAtlasRefresh();
}
