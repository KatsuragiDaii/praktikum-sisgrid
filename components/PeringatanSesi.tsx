"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { StatusSesi } from "@/lib/useSesiBerubah";

// Layar penghalang saat sesi tab ini sudah tidak sama dengan akun yang ditampilkan.
export default function PeringatanSesi({ status }: { status: StatusSesi }) {
  const router = useRouter();
  const utama = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (status) utama.current?.focus();
  }, [status]);

  if (!status) return null;
  const lain = status === "lain";
  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60" role="alertdialog" aria-modal="true" aria-labelledby="judul-sesi" aria-describedby="isi-sesi">
     <div className="flex min-h-full items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 sm:p-6 shadow-2xl">
        <h2 id="judul-sesi" className="text-lg font-extrabold text-[#0a1e2b]">
          {lain ? "Akun di browser ini sudah berganti" : "Sesi login sudah berakhir"}
        </h2>
        <p id="isi-sesi" className="mt-2 text-sm leading-relaxed text-gray-600">
          {lain
            ? "Anda masuk dengan akun lain di tab atau jendela lain pada browser ini. Login disimpan per browser, jadi tab ini tidak lagi mewakili akun yang tadi. Muat ulang untuk melihat akun yang sedang aktif. Untuk memakai dua akun sekaligus, gunakan jendela privat atau browser yang berbeda."
            : "Anda sudah keluar dari akun ini di tab atau jendela lain (atau keluar otomatis karena tidak ada aktivitas). Silakan masuk kembali."}
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {lain && (
            <button type="button" onClick={() => router.push("/login")} className="cursor-pointer rounded-lg border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">
              Ke halaman login
            </button>
          )}
          <button
            ref={utama}
            type="button"
            onClick={() => (lain ? window.location.reload() : router.push("/login"))}
            className="cursor-pointer rounded-lg bg-[#23424A] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1a3238]"
          >
            {lain ? "Muat ulang halaman" : "Ke halaman login"}
          </button>
        </div>
      </div>
     </div>
    </div>
  );
}
