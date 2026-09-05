import { Navigate, Route, Routes } from 'react-router-dom';
import { ButuhLogin, Layout } from './components/Layout.js';
import HalamanLogin from './pages/HalamanLogin.js';
import HalamanOrderAktif from './pages/HalamanOrderAktif.js';
import HalamanKasirManual from './pages/HalamanKasirManual.js';
import HalamanMenu from './pages/HalamanMenu.js';
import HalamanMeja from './pages/HalamanMeja.js';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<HalamanLogin />} />

      <Route element={<Layout />}>
        <Route
          index
          element={
            <ButuhLogin roles={['kasir', 'admin']}>
              <HalamanOrderAktif />
            </ButuhLogin>
          }
        />
        <Route
          path="manual"
          element={
            <ButuhLogin roles={['kasir', 'admin']}>
              <HalamanKasirManual />
            </ButuhLogin>
          }
        />
        <Route
          path="menu"
          element={
            <ButuhLogin roles={['admin']}>
              <HalamanMenu />
            </ButuhLogin>
          }
        />
        <Route
          path="meja"
          element={
            <ButuhLogin roles={['admin']}>
              <HalamanMeja />
            </ButuhLogin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
