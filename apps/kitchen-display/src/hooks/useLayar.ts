import { useEffect, useRef, useState } from 'react';

/**
 * Cegah layar dapur tidur. `wakeLock` belum ada di semua browser (Safari lama,
 * Firefox) — gagal diabaikan, tidak boleh menjatuhkan layar. Lock dilepas OS
 * saat tab tersembunyi, jadi diminta ulang saat tab terlihat lagi.
 */
export const useWakeLock = (): boolean => {
  const [aktif, setAktif] = useState(false);
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    let dibuang = false;

    const minta = async () => {
      if (document.visibilityState !== 'visible' || lock.current) return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (dibuang) {
          void s.release();
          return;
        }
        lock.current = s;
        setAktif(true);
        s.addEventListener('release', () => {
          lock.current = null;
          setAktif(false);
        });
      } catch {
        // Ditolak (baterai lemah / kebijakan browser). Bukan alasan gagal.
        setAktif(false);
      }
    };

    void minta();
    document.addEventListener('visibilitychange', () => void minta());

    return () => {
      dibuang = true;
      void lock.current?.release();
      lock.current = null;
    };
  }, []);

  return aktif;
};

/**
 * Jam dinding lokal untuk menghitung umur kartu. Bukan polling data — tidak ada
 * request ke server di sini; data order tetap datang lewat socket. Tanpa tick
 * ini, timer di kartu berhenti sampai render berikutnya.
 */
export const useDetik = (): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
};
