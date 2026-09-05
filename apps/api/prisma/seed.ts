import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { randomBytes } from 'node:crypto';

const prisma = new PrismaClient();
const id = () => nanoid(21);
const qr = () => nanoid(32);
const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Idempoten: aman dijalankan berulang. Tidak menimpa data yang sudah diubah user. */
async function main(): Promise<void> {
  const outlet = await prisma.outlet.upsert({
    where: { id: 'outlet-default-000000' },
    update: {},
    create: {
      id: 'outlet-default-000000',
      name: 'Kopi Senja',
      address: 'Jl. Merdeka No. 10, Bandung',
      phone: '08123456789',
    },
  });

  await prisma.settings.upsert({
    where: { outletId: outlet.id },
    update: {},
    create: { id: id(), outletId: outlet.id, receiptFooter: 'Terima kasih atas kunjungan Anda' },
  });

  // Password admin: dari env, atau digenerate acak dan dicetak SEKALI.
  // Tanpa default hardcoded — instalasi baru tidak boleh punya password yang bisa ditebak.
  const adminAda = await prisma.user.findUnique({ where: { username: 'admin' } });
  if (!adminAda) {
    const password = process.env.SEED_ADMIN_PASSWORD?.trim() || randomBytes(9).toString('base64url');
    await prisma.user.create({
      data: {
        id: id(),
        outletId: outlet.id,
        username: 'admin',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
        name: 'Administrator',
        role: 'admin',
      },
    });
    console.log('\n  User admin dibuat');
    console.log(`  username: admin`);
    console.log(`  password: ${password}`);
    console.log('  Simpan sekarang — tidak ditampilkan lagi.\n');
  } else {
    console.log('  User admin sudah ada, dilewati.');
  }

  const katalog = [
    {
      nama: 'Kopi',
      items: [
        { name: 'Espresso', price: 15000, description: 'Single shot, 30ml' },
        { name: 'Kopi Susu Gula Aren', price: 22000, description: 'Signature, es' },
        { name: 'Americano', price: 18000, description: 'Panas atau es' },
      ],
    },
    {
      nama: 'Non-Kopi',
      items: [
        { name: 'Matcha Latte', price: 25000, description: 'Matcha Jepang' },
        { name: 'Teh Lemon', price: 15000, description: null },
      ],
    },
    {
      nama: 'Makanan',
      items: [
        { name: 'Croissant Butter', price: 20000, description: 'Panggang harian' },
        { name: 'Nasi Ayam Sambal Matah', price: 32000, description: 'Pedas sedang' },
        { name: 'Pisang Goreng Keju', price: 18000, description: null },
      ],
    },
  ];

  for (const [i, kat] of katalog.entries()) {
    const category = await prisma.category.upsert({
      where: { outletId_slug: { outletId: outlet.id, slug: slug(kat.nama) } },
      update: {},
      create: { id: id(), outletId: outlet.id, name: kat.nama, slug: slug(kat.nama), sortOrder: i },
    });

    for (const [j, item] of kat.items.entries()) {
      const ada = await prisma.menuItem.findFirst({
        where: { outletId: outlet.id, name: item.name },
      });
      if (!ada) {
        await prisma.menuItem.create({
          data: {
            id: id(),
            outletId: outlet.id,
            categoryId: category.id,
            name: item.name,
            description: item.description,
            price: item.price, // integer rupiah
            sortOrder: j,
          },
        });
      }
    }
  }

  for (const number of ['1', '2', '3', '4', 'Teras-1']) {
    await prisma.cafeTable.upsert({
      where: { outletId_number: { outletId: outlet.id, number } },
      update: {},
      create: {
        id: id(),
        outletId: outlet.id,
        number,
        capacity: number.startsWith('Teras') ? 4 : 2,
        location: number.startsWith('Teras') ? 'Teras' : 'Indoor',
        qrToken: qr(),
      },
    });
  }

  const [kategori, menu, meja] = await Promise.all([
    prisma.category.count(),
    prisma.menuItem.count(),
    prisma.cafeTable.count(),
  ]);
  console.log(`  Seed selesai: ${kategori} kategori, ${menu} menu, ${meja} meja.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
