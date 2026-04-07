// ABOUTME: React Router v6 route definitions using HashRouter for Tauri compatibility.
// ABOUTME: HashRouter avoids Tauri production-build routing issues (no server to handle HTML5 history).

import { createHashRouter } from 'react-router-dom';
import { AppLayout } from './pages/AppLayout';
import { Dashboard } from './pages/Dashboard';
import { Filters } from './pages/Filters';
import { Strategies } from './pages/Strategies';
import { AtlasTree } from './pages/AtlasTree';
import { Stash } from './pages/Stash';
import { Settings } from './pages/Settings';

export const router = createHashRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'filters', element: <Filters /> },
      { path: 'strategies', element: <Strategies /> },
      { path: 'atlas-tree', element: <AtlasTree /> },
      { path: 'stash', element: <Stash /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);
