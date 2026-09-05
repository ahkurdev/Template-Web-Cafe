import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { formatRupiah, subtotalItem } from '@cafe/shared';

export interface BarisKeranjang {
  menuItemId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
}

interface KeranjangState {
  baris: BarisKeranjang[];
  tambah: (item: { menuItemId: string; name: string; price: number }, note?: string) => void;
  ubahQty: (menuItemId: string, note: string | undefined, delta: number) => void;
  setNote: (menuItemId: string, noteLama: string | undefined, noteBaru: string) => void;
  hapus: (menuItemId: string, note?: string) => void;
  hapusBanyak: (namaItem: string[]) => void;
  kosongkan: () => void;
}

// Item sama dengan catatan berbeda = baris berbeda. Dapur perlu lihat keduanya.
const kunci = (id: string, note?: string) => `${id}|${note ?? ''}`;

export const useKeranjang = create<KeranjangState>()(
  persist(
    (set) => ({
      baris: [],

      tambah: (item, note) =>
        set((s) => {
          const k = kunci(item.menuItemId, note);
          const ada = s.baris.find((b) => kunci(b.menuItemId, b.note) === k);
          if (ada) {
            return {
              baris: s.baris.map((b) =>
                kunci(b.menuItemId, b.note) === k ? { ...b, qty: Math.min(b.qty + 1, 99) } : b,
              ),
            };
          }
          return { baris: [...s.baris, { ...item, qty: 1, note }] };
        }),

      ubahQty: (menuItemId, note, delta) =>
        set((s) => {
          const k = kunci(menuItemId, note);
          return {
            baris: s.baris
              .map((b) =>
                kunci(b.menuItemId, b.note) === k
                  ? { ...b, qty: Math.min(Math.max(b.qty + delta, 0), 99) }
                  : b,
              )
              .filter((b) => b.qty > 0),
          };
        }),

      setNote: (menuItemId, noteLama, noteBaru) =>
        set((s) => {
          const k = kunci(menuItemId, noteLama);
          const bersih = noteBaru.trim();
          return {
            baris: s.baris.map((b) =>
              kunci(b.menuItemId, b.note) === k ? { ...b, note: bersih || undefined } : b,
            ),
          };
        }),

      hapus: (menuItemId, note) =>
        set((s) => ({
          baris: s.baris.filter((b) => kunci(b.menuItemId, b.note) !== kunci(menuItemId, note)),
        })),

      /** Dipakai saat checkout gagal karena item habis: buang yang disebut server. */
      hapusBanyak: (namaItem) =>
        set((s) => ({ baris: s.baris.filter((b) => !namaItem.includes(b.name)) })),

      kosongkan: () => set({ baris: [] }),
    }),
    {
      name: 'cafe-keranjang',
      // sessionStorage, bukan localStorage: keranjang tidak ikut ke kunjungan besok.
      storage: {
        getItem: (n) => {
          const v = sessionStorage.getItem(n);
          return v ? (JSON.parse(v) as never) : null;
        },
        setItem: (n, v) => sessionStorage.setItem(n, JSON.stringify(v)),
        removeItem: (n) => sessionStorage.removeItem(n),
      },
    },
  ),
);

export const totalQty = (baris: BarisKeranjang[]): number =>
  baris.reduce((a, b) => a + b.qty, 0);

export const subtotalKeranjang = (baris: BarisKeranjang[]): number =>
  baris.reduce((a, b) => a + subtotalItem(b.price, b.qty), 0);

export const rupiah = formatRupiah;
