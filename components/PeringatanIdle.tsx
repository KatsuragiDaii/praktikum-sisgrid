"use client";
import { useEffect, useRef } from "react";
import { teksBatasIdle } from "@/lib/idle";

// Muncul di akhir masa tunggu: "Anda akan keluar otomatis dalam N detik". Gerakan apa pun menutupnya.
export default function PeringatanIdle({ sisaDetik, onLanjut }: { sisaDetik: number | null; onLanjut: () => void }) {
  const tombol = useRef<HTMLButtonElement>(null);
  const tampil = sisaDetik !== null;
  useEffect(() => {
    if (tampil) tombol.current?.focus();
  }, [tampil]);

  if (!tampil) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-labelledby="judul-idle" aria-describedby="isi-idle">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
        <h2 id="judul-idle" className="text-lg font-extrabold text-[#0a1e2b]">Masih di sana?</h2>
        <p id="isi-idle" className="mt-2 text-sm leading-relaxed text-gray-600">
          Tidak ada aktivitas selama {teksBatasIdle()}. Anda akan keluar otomatis dalam{" "}
          <strong className="text-[#0a1e2b]">{sisaDetik} detik</strong>.
        </p>
        <button ref={tombol} type="button" onClick={onLanjut} className="mt-5 w-full cursor-pointer rounded-lg bg-[#23424A] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a3238]">
          Tetap masuk
        </button>
      </div>
    </div>
  );
}
