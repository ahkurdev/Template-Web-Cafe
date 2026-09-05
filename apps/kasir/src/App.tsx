import { Navigate, Route, Routes } from 'react-router-dom';
import { ButuhLogin, Layout } from './components/Layout.js';
import HalamanLogin from './pages/HalamanLogin.js';
import HalamanOrderAktif from './pages/HalamanOrderAktif.js';
import HalamanKasirManual from './pages/HalamanKasirManual.js';
import HalamanLaporan from './pages/HalamanLaporan.js';
import HalamanMenu from './pages/HalamanMenu.js';
import HalamanMeja from './pages/HalamanMeja.js';
import HalamanPengguna from './pages/HalamanPengguna.js';
import HalamanPengaturan from './pages/HalamanPengaturan.js';

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
        <Route
          path="laporan"
          element={
            <ButuhLogin roles={['kasir', 'admin']}>
              <HalamanLaporan />
            </ButuhLogin>
          }
        />
        <Route
          path="pengguna"
          element={
            <ButuhLogin roles={['admin']}>
              <HalamanPengguna />
            </ButuhLogin>
          }
        />
        <Route
          path="pengaturan"
          element={
            <ButuhLogin roles={['admin']}>
              <HalamanPengaturan />
            </ButuhLogin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
