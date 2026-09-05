import { Navigate, Route, Routes } from 'react-router-dom';
import HalamanLogin from './pages/HalamanLogin.js';
import HalamanAntrian from './pages/HalamanAntrian.js';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<HalamanLogin />} />
      <Route path="/" element={<HalamanAntrian />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
