"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { keluarAkun } from "@/lib/useSesiBerubah";
import { BATAS_IDLE_MS, PERINGATAN_IDLE_MS, bacaAktivitas, catatAktivitas } from "@/lib/idle";

const PERISTIWA = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"] as const;
const TULIS_PALING_SERING_MS = 3_000;

// Keluar otomatis bila tidak ada aktivitas selama BATAS_IDLE_MS. `aktif` = sudah login dan halaman siap.
// Mengembalikan sisa detik selama masa peringatan (null = tidak sedang diperingatkan) dan fungsi `lanjut`.
export function useIdleLogout(aktif: boolean) {
  const router = useRouter();
  const [sisaDetik, setSisaDetik] = useState<number | null>(null);
  const terakhir = useRef(0); // aktivitas terakhir di tab ini
  const tertulis = useRef(0); // kapan terakhir menulis ke localStorage (dibatasi supaya tidak berlebihan)
  const diperingatkan = useRef(false);
  const selesai = useRef(false);

  const catat = useCallback(() => {
    const sekarang = Date.now();
    terakhir.current = sekarang;
    if (sekarang - tertulis.current >= TULIS_PALING_SERING_MS) {
      tertulis.current = sekarang;
      catatAktivitas(sekarang);
    }
    if (diperingatkan.current) {
      diperingatkan.current = false;
      setSisaDetik(null);
    }
  }, []);

  useEffect(() => {
    if (!aktif) return;
    selesai.current = false;

    const keluarOtomatis = async () => {
      if (selesai.current) return;
      selesai.current = true;
      // 'local': hanya mencabut sesi di browser ini (di server juga), perangkat lain milik akun yang sama tidak ikut keluar.
      await keluarAkun("local");
      router.replace("/login?alasan=idle");
    };

    // Halaman dibuka lagi setelah lama tidak dipakai (mis. browser lama terbuka di komputer bersama): langsung keluar.
    const tersimpan = bacaAktivitas();
    if (tersimpan > 0 && Date.now() - tersimpan >= BATAS_IDLE_MS) {
      void keluarOtomatis();
      return;
    }
    // Membuka/memuat halaman dihitung sebagai aktivitas.
    const sekarang = Date.now();
    terakhir.current = sekarang;
    tertulis.current = sekarang;
    catatAktivitas(sekarang);

    const periksa = () => {
      if (selesai.current) return;
      const idle = Date.now() - Math.max(terakhir.current, bacaAktivitas());
      if (idle >= BATAS_IDLE_MS) return void keluarOtomatis();
      const sisa = BATAS_IDLE_MS - idle;
      if (sisa <= PERINGATAN_IDLE_MS) {
        diperingatkan.current = true;
        setSisaDetik(Math.ceil(sisa / 1000));
      } else if (diperingatkan.current) {
        diperingatkan.current = false;
        setSisaDetik(null);
      }
    };

    for (const p of PERISTIWA) window.addEventListener(p, catat, { passive: true });
    window.addEventListener("focus", periksa);
    document.addEventListener("visibilitychange", periksa);
    const jam = window.setInterval(periksa, 1000);
    return () => {
      for (const p of PERISTIWA) window.removeEventListener(p, catat);
      window.removeEventListener("focus", periksa);
      document.removeEventListener("visibilitychange", periksa);
      window.clearInterval(jam);
    };
  }, [aktif, catat, router]);

  return { sisaDetik, lanjut: catat };
}
