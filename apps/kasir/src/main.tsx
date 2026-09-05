import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 15_000, retry: 1 } },
});

const root = document.getElementById('root');
if (!root) throw new Error('#root tidak ditemukan');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* basename wajib cocok dengan base Vite dan handle Caddy */}
      <BrowserRouter basename="/kasir">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
