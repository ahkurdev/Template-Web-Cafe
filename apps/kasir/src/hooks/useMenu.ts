import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CafeTable, Category, CategoryWithItems, MenuItem, Settings } from '@cafe/shared';
import { api } from '../lib/api.js';
import { getSocket } from '../lib/socket.js';

export const useKategori = () =>
  useQuery<Category[]>({
    queryKey: ['menu', 'categories'],
    queryFn: () => api.get<Category[]>('/menu/categories'),
  });

/** Katalog publik: satu request berisi kategori + item, dipakai layar kasir manual. */
export const useKatalog = () => {
  const qc = useQueryClient();

  const q = useQuery<CategoryWithItems[]>({
    queryKey: ['menu', 'katalog'],
    queryFn: () => api.get<CategoryWithItems[]>('/menu'),
  });

  useEffect(() => {
    const s = getSocket();
    const onAvail = ({ menuItemId, isAvailable }: { menuItemId: string; isAvailable: boolean }) => {
      qc.setQueryData<CategoryWithItems[]>(['menu', 'katalog'], (lama) =>
        lama?.map((k) => ({
          ...k,
          items: k.items.map((i) => (i.id === menuItemId ? { ...i, isAvailable } : i)),
        })),
      );
    };
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

export const useItem = () =>
  useQuery<MenuItem[]>({
    queryKey: ['menu', 'items'],
    queryFn: () => api.get<MenuItem[]>('/menu/items'),
  });

const invalidasiMenu = (qc: ReturnType<typeof useQueryClient>) => () => {
  void qc.invalidateQueries({ queryKey: ['menu'] });
};

/**
 * Toggle habis/tersedia. Optimistic: ini aksi paling sering dipakai saat ramai,
 * menunggu roundtrip membuat barista mengetuk dua kali.
 */
export const useToggleKetersediaan = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) =>
      api.patch<MenuItem>(`/menu/items/${id}/availability`, { isAvailable }),
    onMutate: async ({ id, isAvailable }) => {
      await qc.cancelQueries({ queryKey: ['menu'] });
      const sebelum = qc.getQueryData<MenuItem[]>(['menu', 'items']);
      qc.setQueryData<MenuItem[]>(['menu', 'items'], (lama) =>
        lama?.map((i) => (i.id === id ? { ...i, isAvailable } : i)),
      );
      return { sebelum };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.sebelum) qc.setQueryData(['menu', 'items'], ctx.sebelum);
    },
    onSettled: invalidasiMenu(qc),
  });
};

export const useSimpanKategori = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; sortOrder: number }) =>
      id
        ? api.patch<Category>(`/menu/categories/${id}`, body)
        : api.post<Category>('/menu/categories', body),
    onSuccess: invalidasiMenu(qc),
  });
};

export const useHapusKategori = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/menu/categories/${id}`),
    onSuccess: invalidasiMenu(qc),
  });
};

export interface ItemForm {
  id?: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  sortOrder: number;
}

export const useSimpanItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: ItemForm) =>
      id ? api.patch<MenuItem>(`/menu/items/${id}`, body) : api.post<MenuItem>('/menu/items', body),
    onSuccess: invalidasiMenu(qc),
  });
};

export const useHapusItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/menu/items/${id}`),
    onSuccess: invalidasiMenu(qc),
  });
};

export const useUploadFoto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('file', file);
      return api.upload<MenuItem>(`/menu/items/${id}/image`, form);
    },
    onSuccess: invalidasiMenu(qc),
  });
};

// ---------- meja ----------

export const useMeja = () =>
  useQuery<CafeTable[]>({ queryKey: ['tables'], queryFn: () => api.get<CafeTable[]>('/tables') });

const invalidasiMeja = (qc: ReturnType<typeof useQueryClient>) => () => {
  void qc.invalidateQueries({ queryKey: ['tables'] });
};

export const useSimpanMeja = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; number: string; capacity?: number; location?: string }) =>
      id ? api.patch<CafeTable>(`/tables/${id}`, body) : api.post<CafeTable>('/tables', body),
    onSuccess: invalidasiMeja(qc),
  });
};

export const useHapusMeja = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/tables/${id}`),
    onSuccess: invalidasiMeja(qc),
  });
};

export const useRegenerateQr = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ id: string; qrUrl: string }>(`/tables/${id}/qr/regenerate`),
    onSuccess: invalidasiMeja(qc),
  });
};

// ---------- settings ----------

export const useSettings = () =>
  useQuery<Settings>({ queryKey: ['settings'], queryFn: () => api.get<Settings>('/settings') });

export const useSimpanSettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Settings>) => api.patch<Settings>('/settings', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['settings'] }),
  });
};
