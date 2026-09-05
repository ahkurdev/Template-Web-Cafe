import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { CategoryWithItems, TableResolved } from '@cafe/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

/** Meja dari ?t=<qrToken>. Token disimpan di sessionStorage supaya reload tidak kehilangan meja. */
const KUNCI_QR = 'cafe-qr-token';

export const ambilQrToken = (): string | null => {
  const dariUrl = new URLSearchParams(location.search).get('t');
  if (dariUrl) {
    sessionStorage.setItem(KUNCI_QR, dariUrl);
    // Bersihkan URL: token tidak perlu terlihat / ikut ter-share.
    history.replaceState(null, '', location.pathname);
    return dariUrl;
  }
  return sessionStorage.getItem(KUNCI_QR);
};

export const useMeja = () => {
  const token = ambilQrToken();
  return useQuery<TableResolved | null>({
    queryKey: ['meja', token],
    enabled: token !== null,
    queryFn: () => api.get<TableResolved>(`/tables/resolve/${token}`),
    retry: false,
    staleTime: Infinity,
  });
};

export const useMenu = () => {
  const qc = useQueryClient();

  const q = useQuery<CategoryWithItems[]>({
    queryKey: ['menu'],
    queryFn: () => api.get<CategoryWithItems[]>('/menu'),
  });

  // Toggle habis dari kasir langsung tampil, tanpa refresh.
  useEffect(() => {
    const s = getSocket();

    const onAvail = ({ menuItemId, isAvailable }: { menuItemId: string; isAvailable: boolean }) => {
      qc.setQueryData<CategoryWithItems[]>(['menu'], (lama) =>
        lama?.map((k) => ({
          ...k,
          items: k.items.map((i) => (i.id === menuItemId ? { ...i, isAvailable } : i)),
        })),
      );
    };
    // Perubahan struktur (item baru / dihapus) tidak bisa di-patch; refetch.
    const onUpdated = () => void qc.invalidateQueries({ queryKey: ['menu'] });

    s.on('menu:availability', onAvail);
    s.on('menu:updated', onUpdated);
    return () => {
      s.off('menu:availability', onAvail);
      s.off('menu:updated', onUpdated);
    };
  }, [qc]);

  return q;
};

export const KUNCI_ORDER_TERAKHIR = 'cafe-order-terakhir';
