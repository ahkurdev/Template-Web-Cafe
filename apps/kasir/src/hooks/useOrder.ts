import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Order, OrderEvent, OrderStatus, PaymentMethod } from '@cafe/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';
import { bunyiOrderBaru } from '../lib/bunyi.js';

export type OrderDetail = Order & { events: OrderEvent[] };

export const KUNCI_AKTIF = ['orders', 'active'] as const;

export const useOrderAktif = () =>
  useQuery<Order[]>({
    queryKey: KUNCI_AKTIF,
    queryFn: () => api.get<Order[]>('/orders/active'),
  });

export const useOrderDetail = (id: string | null) =>
  useQuery<OrderDetail>({
    queryKey: ['orders', id],
    enabled: id !== null,
    queryFn: () => api.get<OrderDetail>(`/orders/${id}`),
  });

/**
 * Listener socket global untuk daftar order. Dipasang sekali di layout, bukan
 * per halaman: dua listener 'order:new' berarti bunyi notifikasi dobel.
 */
export const usePantauOrder = (): void => {
  const qc = useQueryClient();

  useEffect(() => {
    const s = getSocket();

    const segarkan = () => {
      void qc.invalidateQueries({ queryKey: ['orders'] });
    };
    const onBaru = () => {
      bunyiOrderBaru();
      segarkan();
    };

    s.on('order:new', onBaru);
    s.on('order:updated', segarkan);
    s.on('order:paid', segarkan);
    s.on('order:cancelled', segarkan);

    return () => {
      s.off('order:new', onBaru);
      s.off('order:updated', segarkan);
      s.off('order:paid', segarkan);
      s.off('order:cancelled', segarkan);
    };
  }, [qc]);
};

const invalidasiOrder = (qc: ReturnType<typeof useQueryClient>) => () => {
  void qc.invalidateQueries({ queryKey: ['orders'] });
};

export const useUbahStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) =>
      api.patch<Order>(`/orders/${id}/status`, { status }),
    onSuccess: invalidasiOrder(qc),
  });
};

export const useBayar = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      paymentMethod,
      paidAmount,
    }: {
      id: string;
      paymentMethod: PaymentMethod;
      paidAmount?: number;
    }) => api.patch<Order>(`/orders/${id}/payment`, { paymentMethod, paidAmount }),
    onSuccess: invalidasiOrder(qc),
  });
};

export const useBatalkan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<Order>(`/orders/${id}/cancel`, { reason }),
    onSuccess: invalidasiOrder(qc),
  });
};

export const useDiskon = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, discountAmount }: { id: string; discountAmount: number }) =>
      api.patch<Order>(`/orders/${id}/discount`, { discountAmount }),
    onSuccess: invalidasiOrder(qc),
  });
};
