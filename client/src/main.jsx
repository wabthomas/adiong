import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { SiteProvider } from './hooks/useSite.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <SiteProvider>
        <App />
      </SiteProvider>
    </BrowserRouter>
  </React.StrictMode>
);
