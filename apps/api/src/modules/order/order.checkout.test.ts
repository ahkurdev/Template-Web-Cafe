import { describe, expect, it } from 'vitest';
import { hitungTotal, subtotalOrder } from '@cafe/shared';
import { susunBaris, type MenuUntukOrder } from './order.pricing.js';

let n = 0;
const idPalsu = () => `id-${String(++n).padStart(17, '0')}`;

const dbMenu = (over: Partial<MenuUntukOrder> = {}): MenuUntukOrder => ({
  id: 'menu-kopi-susu-000001',
  name: 'Kopi Susu',
  price: 18000,
  isAvailable: true,
  ...over,
});

const hasilDb = (items: MenuUntukOrder[], habis: string[] = [], hilang: string[] = []) => ({
  peta: new Map(items.map((i) => [i.id, i])),
  habis,
  hilang,
});

describe('checkout — harga dari DB', () => {
  it('memakai harga DB, mengabaikan harga yang dikirim klien', () => {
    const menu = dbMenu({ price: 18000 });
    // Klien nakal mengirim price: 1. Field itu tidak ada di skema input
    // dan tidak pernah dibaca — susunBaris hanya melihat peta dari DB.
    const items = [{ menuItemId: menu.id, qty: 2, price: 1 } as never];

    const baris = susunBaris(items, hasilDb([menu]), idPalsu);

    expect(baris[0]!.priceSnapshot).toBe(18000);
    expect(baris[0]!.subtotal).toBe(36000);
  });

  it('menyimpan snapshot nama & harga saat order dibuat', () => {
    const menu = dbMenu({ name: 'Matcha Latte', price: 25000 });
    const baris = susunBaris([{ menuItemId: menu.id, qty: 1 }], hasilDb([menu]), idPalsu);

    expect(baris[0]).toMatchObject({ nameSnapshot: 'Matcha Latte', priceSnapshot: 25000 });
  });

  it('menolak checkout kalau ada item habis, menyebut namanya', () => {
    const menu = dbMenu({ isAvailable: false });

    expect(() =>
      susunBaris([{ menuItemId: menu.id, qty: 1 }], hasilDb([menu], ['Kopi Susu', 'Croissant']), idPalsu),
    ).toThrowError(/habis/i);

    try {
      susunBaris([{ menuItemId: menu.id, qty: 1 }], hasilDb([menu], ['Kopi Susu']), idPalsu);
    } catch (e) {
      const err = e as { code: string; statusCode: number; fields?: Record<string, string> };
      expect(err.code).toBe('ITEM_UNAVAILABLE');
      expect(err.statusCode).toBe(409);
      expect(err.fields?.['items']).toBe('Kopi Susu');
    }
  });

  it('menolak kalau ada menu yang tidak ada di DB', () => {
    expect(() =>
      susunBaris([{ menuItemId: 'menu-hantu-0000000001' }] as never, hasilDb([], [], ['menu-hantu']), idPalsu),
    ).toThrowError(/tidak ditemukan/i);
  });

  it('menggabungkan item duplikat dengan catatan sama', () => {
    const menu = dbMenu({ price: 15000 });
    const baris = susunBaris(
      [
        { menuItemId: menu.id, qty: 1, note: 'tanpa gula' },
        { menuItemId: menu.id, qty: 2, note: 'tanpa gula' },
      ],
      hasilDb([menu]),
      idPalsu,
    );

    expect(baris).toHaveLength(1);
    expect(baris[0]!.qty).toBe(3);
    expect(baris[0]!.subtotal).toBe(45000);
  });

  it('memisahkan item sama dengan catatan berbeda — dapur perlu lihat keduanya', () => {
    const menu = dbMenu();
    const baris = susunBaris(
      [
        { menuItemId: menu.id, qty: 1, note: 'tanpa gula' },
        { menuItemId: menu.id, qty: 1, note: 'extra shot' },
      ],
      hasilDb([menu]),
      idPalsu,
    );

    expect(baris).toHaveLength(2);
  });

  it('total order konsisten dengan subtotal baris', () => {
    const kopi = dbMenu({ id: 'menu-a-000000000000001', name: 'Kopi', price: 18000 });
    const kue = dbMenu({ id: 'menu-b-000000000000002', name: 'Kue', price: 20000 });

    const baris = susunBaris(
      [
        { menuItemId: kopi.id, qty: 2 },
        { menuItemId: kue.id, qty: 1 },
      ],
      hasilDb([kopi, kue]),
      idPalsu,
    );

    const subtotal = subtotalOrder(baris);
    expect(subtotal).toBe(56000);
    expect(hitungTotal({ subtotal, taxPercent: 11 }).total).toBe(56000 + 6160);
  });
});
