import { create } from 'zustand';
import { subtotalItem } from '@cafe/shared';

export interface BarisKasir {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}

interface State {
  baris: BarisKasir[];
  tambah: (item: { menuItemId: string; name: string; price: number }) => void;
  ubahQty: (menuItemId: string, delta: number) => void;
  setNote: (menuItemId: string, note: string) => void;
  hapus: (menuItemId: string) => void;
  kosongkan: () => void;
}

/**
 * Keranjang kasir manual. Tanpa persist: satu transaksi selesai di depan
 * pelanggan, dan keranjang sisa dari shift lalu lebih berbahaya daripada
 * mengetik ulang. Satu baris per item (catatan diedit di baris itu) — kasir
 * mengetik lebih cepat begini daripada pola customer-menu.
 */
export const useKeranjangKasir = create<State>()((set) => ({
  baris: [],

  tambah: (item) =>
    set((s) => {
      const ada = s.baris.find((b) => b.menuItemId === item.menuItemId);
      if (ada) {
        return {
          baris: s.baris.map((b) =>
            b.menuItemId === item.menuItemId ? { ...b, qty: Math.min(b.qty + 1, 99) } : b,
          ),
        };
      }
      return { baris: [...s.baris, { ...item, qty: 1 }] };
    }),

  ubahQty: (menuItemId, delta) =>
    set((s) => ({
      baris: s.baris
        .map((b) =>
          b.menuItemId === menuItemId
            ? { ...b, qty: Math.min(Math.max(b.qty + delta, 0), 99) }
            : b,
        )
        .filter((b) => b.qty > 0),
    })),

  setNote: (menuItemId, note) =>
    set((s) => ({
      baris: s.baris.map((b) =>
        b.menuItemId === menuItemId ? { ...b, note: note.trim() || undefined } : b,
      ),
    })),

  hapus: (menuItemId) =>
    set((s) => ({ baris: s.baris.filter((b) => b.menuItemId !== menuItemId) })),

  kosongkan: () => set({ baris: [] }),
}));

export const subtotalKasir = (baris: BarisKasir[]): number =>
  baris.reduce((a, b) => a + subtotalItem(b.price, b.qty), 0);
