
import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import App from './App';
import { logger } from './utils/logger';

const rootElement = document.getElementById('root');
if (!rootElement) {
  logger.critical('FRONTEND', 'No root element found for mounting');
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  logger.info('FRONTEND', 'App mounted successfully');
} catch (err) {
  logger.error('FRONTEND', 'Error mounting app', err);
}
