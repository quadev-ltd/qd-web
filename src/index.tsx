import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/dm-sans';
import '@fontsource-variable/sora';

import './styles/global.css';
import App from './app/App';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
