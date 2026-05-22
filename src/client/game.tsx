import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './firewatch/app';

const root = document.getElementById('root');
if (!root) throw new Error('Missing Firewatch root element');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>
);
