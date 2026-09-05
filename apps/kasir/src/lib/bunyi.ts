/**
 * Bunyi notifikasi order baru. Dibangkitkan lewat WebAudio, bukan file audio:
 * satu file mp3 = satu request lagi + aset yang harus dijaga, padahal yang
 * dibutuhkan cuma dua nada.
 *
 * Browser memblokir audio sebelum ada interaksi pengguna, jadi `aktifkan()`
 * harus dipanggil dari handler klik.
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
  for (const [i, freq] of [880, 1174].entries()) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    osc.type = 'sine';
    // Envelope pendek: nada tanpa fade menghasilkan 'klik' di speaker murah.
    gain.gain.setValueAtTime(0, mulai + i * 0.14);
    gain.gain.linearRampToValueAtTime(0.25, mulai + i * 0.14 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, mulai + i * 0.14 + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(mulai + i * 0.14);
    osc.stop(mulai + i * 0.14 + 0.14);
  }
};
