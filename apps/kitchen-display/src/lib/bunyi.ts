/**
 * Bunyi order baru. WebAudio, bukan file audio: dua nada tidak perlu aset.
 * Lebih panjang & lebih keras dari versi kasir — dapur berisik.
 *
 * Browser memblokir audio sebelum ada interaksi, jadi `aktifkanBunyi()` harus
 * dipanggil dari handler klik.
 */

let ctx: AudioContext | null = null;

export const bunyiAktif = (): boolean => ctx !== null && ctx.state === 'running';

export const aktifkanBunyi = async (): Promise<void> => {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume();
};

export const bunyiOrderBaru = (): void => {
  if (!ctx || ctx.state !== 'running') return;
  const mulai = ctx.currentTime;
  // Tiga nada naik: lebih menonjol di ruangan berisik daripada dua nada.
  for (const [i, freq] of [880, 1174, 1568].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const t = mulai + i * 0.16;
    // Envelope: nada tanpa fade menghasilkan 'klik' di speaker murah.
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.4, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16);
  }
};
