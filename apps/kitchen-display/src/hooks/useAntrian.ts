import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueueOrder } from '@cafe/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';
import { bunyiOrderBaru } from '../lib/bunyi.js';

export const KUNCI_ANTRIAN = ['kitchen', 'queue'] as const;

/** Status yang boleh dikirim dapur. Selain ini ditolak server (403/409). */
export type StatusDapur = 'dikonfirmasi' | 'diproses' | 'selesai';

export const useAntrian = () => {
  const qc = useQueryClient();

  const q = useQuery<QueueOrder[]>({
    queryKey: KUNCI_ANTRIAN,
    queryFn: () => api.get<QueueOrder[]>('/kitchen/queue'),
  });

  useEffect(() => {
    const s = getSocket();

    const segarkan = () => void qc.invalidateQueries({ queryKey: ['kitchen'] });
    const onBaru = () => {
      bunyiOrderBaru();
      segarkan();
    };

    s.on('order:new', onBaru);
    s.on('order:updated', segarkan);
    s.on('order:cancelled', segarkan);

    return () => {
      s.off('order:new', onBaru);
      s.off('order:updated', segarkan);
      s.off('order:cancelled', segarkan);
    };
  }, [qc]);

  return q;
};

/**
 * Ubah status. Optimistic: dapur menekan tombol lalu langsung lanjut kerja —
 * kartu yang baru bergeser setelah roundtrip membuat mereka menekan dua kali.
 */
export const useUbahStatusDapur = () => {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: StatusDapur }) =>
      api.patch(`/kitchen/orders/${id}/status`, { status }),

    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: KUNCI_ANTRIAN });
      const sebelum = qc.getQueryData<QueueOrder[]>(KUNCI_ANTRIAN);
      qc.setQueryData<QueueOrder[]>(KUNCI_ANTRIAN, (lama) =>
        lama?.map((o) => (o.id === id ? { ...o, status } : o)),
      );
      return { sebelum };
    },

    onError: (_e, _v, ctx) => {
      if (ctx?.sebelum) qc.setQueryData(KUNCI_ANTRIAN, ctx.sebelum);
    },

    onSettled: () => void qc.invalidateQueries({ queryKey: ['kitchen'] }),
  });
};
