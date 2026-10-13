// Batas tidak aktif: setelah sekian menit tanpa gerakan mouse/ketikan/sentuhan/scroll, pengguna keluar otomatis.
// Bawaan 5 menit. Ubah lewat environment variable NEXT_PUBLIC_IDLE_MENIT (boleh pecahan, mis. 0.5; batas 6 detik
// sampai 4 jam), lalu deploy ulang karena nilainya ikut dibangun ke dalam kode browser.

const BAWAAN_MENIT = 5;
const MIN_MS = 6_000;
const MAKS_MS = 4 * 60 * 60_000;

export function batasIdleMs(nilai: string | undefined): number {
  const menit = Number(nilai);
  const m = Number.isFinite(menit) && menit > 0 ? menit : BAWAAN_MENIT;
  return Math.min(Math.max(Math.round(m * 60_000), MIN_MS), MAKS_MS);
}

export const BATAS_IDLE_MS = batasIdleMs(process.env.NEXT_PUBLIC_IDLE_MENIT);
// Peringatan "Anda akan keluar" muncul di bagian akhir masa tunggu.
export const PERINGATAN_IDLE_MS = Math.min(30_000, Math.floor(BATAS_IDLE_MS / 3));

export function teksBatasIdle(ms = BATAS_IDLE_MS): string {
  return ms < 60_000 ? `${Math.round(ms / 1000)} detik` : `${Math.round(ms / 60_000)} menit`;
}

// Waktu aktivitas terakhir disimpan di localStorage agar semua tab pada browser yang sama (yang berbagi satu sesi
// login) memakai penghitung yang sama: aktif di satu tab berarti aktif di semua tab.
const KUNCI = "sisgrid:aktivitas-terakhir";

export function catatAktivitas(waktu = Date.now()) {
  try {
    localStorage.setItem(KUNCI, String(waktu));
  } catch {
    /* penyimpanan diblokir: penghitung per tab tetap jalan */
  }
}
export function bacaAktivitas(): number {
  try {
    return Number(localStorage.getItem(KUNCI)) || 0;
  } catch {
    return 0;
  }
}
export function hapusAktivitas() {
  try {
    localStorage.removeItem(KUNCI);
  } catch {
    /* abaikan */
  }
}
