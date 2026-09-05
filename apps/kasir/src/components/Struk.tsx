import { formatRupiah, type Order } from '@cafe/shared';

export interface DataStruk {
  cafe: { name: string; address: string | null; phone: string | null };
  order: Order;
  kasir: string | null;
  footer: string | null;
  currencySymbol: string;
  printedAt: string;
}

const jam = (iso: string) =>
  new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });

/**
 * Struk thermal. Lebar cetak diatur kelas `.cetak` di index.css; `lebar58`
 * menambah `.cetak--58` untuk printer 58mm. Kelas `cetak` wajib ada — itu
 * satu-satunya yang tidak disembunyikan aturan `@media print`.
 */
export function Struk({ data, lebar58 = false }: { data: DataStruk; lebar58?: boolean }) {
  const { order: o, currencySymbol: rp } = data;
  const uang = (n: number) => formatRupiah(n, rp);

  return (
    <div
      className={`cetak ${lebar58 ? 'cetak--58' : ''} mx-auto ${
        lebar58 ? 'max-w-[58mm]' : 'max-w-[80mm]'
      } bg-white p-3 font-mono text-[11px] leading-tight text-black`}
    >
      <div className="text-center">
        <p className="text-sm font-bold uppercase">{data.cafe.name}</p>
        {data.cafe.address && <p>{data.cafe.address}</p>}
        {data.cafe.phone && <p>{data.cafe.phone}</p>}
      </div>

      <Garis />

      <Baris kiri="No" kanan={o.orderCode} />
      <Baris kiri="Waktu" kanan={jam(o.createdAt)} />
      <Baris kiri={o.table ? 'Meja' : 'Tipe'} kanan={o.table ? o.table.number : 'Takeaway'} />
      {o.customerName && <Baris kiri="Nama" kanan={o.customerName} />}
      {data.kasir && <Baris kiri="Kasir" kanan={data.kasir} />}

      <Garis />

      {o.items.map((i) => (
        <div key={i.id} className="mb-1">
          <p>{i.nameSnapshot}</p>
          {i.note && <p className="pl-2 italic">* {i.note}</p>}
          <div className="flex justify-between tabular-nums">
            <span className="pl-2">
              {i.qty} × {uang(i.priceSnapshot)}
            </span>
            <span>{uang(i.subtotal)}</span>
          </div>
        </div>
      ))}

      <Garis />

      <Baris kiri="Subtotal" kanan={uang(o.subtotal)} angka />
      {o.taxAmount > 0 && <Baris kiri="Pajak" kanan={uang(o.taxAmount)} angka />}
      {o.serviceAmount > 0 && <Baris kiri="Servis" kanan={uang(o.serviceAmount)} angka />}
      {o.discountAmount > 0 && <Baris kiri="Diskon" kanan={`-${uang(o.discountAmount)}`} angka />}

      <div className="mt-1 flex justify-between border-t border-dashed border-black pt-1 text-sm font-bold tabular-nums">
        <span>TOTAL</span>
        <span>{uang(o.total)}</span>
      </div>

      {o.paymentMethod && (
        <>
          <Baris kiri="Bayar" kanan={o.paymentMethod.replace('_', ' ')} />
          {o.paidAmount !== null && <Baris kiri="Diterima" kanan={uang(o.paidAmount)} angka />}
          {o.changeAmount !== null && <Baris kiri="Kembali" kanan={uang(o.changeAmount)} angka />}
        </>
      )}
      {o.paymentStatus === 'belum_bayar' && (
        <p className="mt-1 text-center font-bold">** BELUM DIBAYAR **</p>
      )}

      <Garis />

      <div className="text-center">
        {data.footer && <p className="whitespace-pre-line">{data.footer}</p>}
        <p className="mt-1">{jam(data.printedAt)}</p>
      </div>
    </div>
  );
}

const Garis = () => <div className="my-1.5 border-t border-dashed border-black" />;

function Baris({ kiri, kanan, angka }: { kiri: string; kanan: string; angka?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${angka ? 'tabular-nums' : ''}`}>
      <span>{kiri}</span>
      <span className="text-right">{kanan}</span>
    </div>
  );
}
