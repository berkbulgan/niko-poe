// ABOUTME: Vite entry point — mounts the React Router app into #root.
// ABOUTME: The overlay window renders only <Overlay />; prices are fetched on league selection, not at startup.

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { Providers } from './providers';
import { Overlay } from './pages/Overlay';
import { QueryProvider } from '@/lib/query-provider';
import { isOverlayWindow } from '@/lib/platform';
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
