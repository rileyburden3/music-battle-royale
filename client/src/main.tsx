import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { App } from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#1a1a25',
            color: '#fff',
            border: '1px solid #2d2d3d',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
          },
          success: {
            iconTheme: { primary: '#00ffff', secondary: '#0a0a0f' },
          },
          error: {
            iconTheme: { primary: '#ff0040', secondary: '#0a0a0f' },
          },
        }}
      />
    </BrowserRouter>
  </React.StrictMode>
);
