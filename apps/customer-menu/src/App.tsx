import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { pasangReconnect } from './lib/socket.js';
import HalamanMenu from './pages/HalamanMenu.js';
import HalamanKeranjang from './pages/HalamanKeranjang.js';
import HalamanStatus from './pages/HalamanStatus.js';

export default function App() {
  const qc = useQueryClient();
  const [offline, setOffline] = useState(false);

  // Socket untuk kecepatan, HTTP untuk kebenaran: refetch saat reconnect
  // supaya event yang terlewat selama offline tersusul.
  useEffect(() => pasangReconnect(qc, setOffline), [qc]);

  return (
    <>
      {offline && (
        <p
          role="status"
          className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900"
        >
          Koneksi terputus — status mungkin tidak terbaru
        </p>
      )}
      <Routes>
        <Route path="/" element={<HalamanMenu />} />
        <Route path="/keranjang" element={<HalamanKeranjang />} />
        <Route path="/status/:orderCode" element={<HalamanStatus />} />
        <Route path="*" element={<HalamanMenu />} />
      </Routes>
    </>
  );
}
