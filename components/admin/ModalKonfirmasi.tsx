"use client";
import { useEffect, useRef, type ReactNode } from "react";

export type TombolModal = { label: string; gaya: "bahaya" | "sekunder"; onClick: () => void };

// Dialog konfirmasi untuk tindakan yang tidak bisa dibatalkan. Fokus awal ada di "Batal".
export default function ModalKonfirmasi({
  judul,
  children,
  tombol,
  sibuk,
  onBatal,
}: {
  judul: string;
  children: ReactNode;
  tombol: TombolModal[];
  sibuk: boolean;
  onBatal: () => void;
}) {
  const kotak = useRef<HTMLDivElement>(null);
  const batalRef = useRef<HTMLButtonElement>(null);
  const terbaru = useRef({ sibuk, onBatal });
  useEffect(() => {
    terbaru.current = { sibuk, onBatal };
  });

  useEffect(() => {
    batalRef.current?.focus();
    const tombolKeyboard = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !terbaru.current.sibuk) return terbaru.current.onBatal();
      if (e.key !== "Tab" || !kotak.current) return;
      // Fokus tidak boleh keluar dari dialog
      const bisa = [...kotak.current.querySelectorAll<HTMLElement>("button:not([disabled])")];
      if (!bisa.length) return;
      const awal = bisa[0];
      const akhir = bisa[bisa.length - 1];
      if (e.shiftKey && document.activeElement === awal) {
        e.preventDefault();
        akhir.focus();
      } else if (!e.shiftKey && document.activeElement === akhir) {
        e.preventDefault();
        awal.focus();
      }
    };
    window.addEventListener("keydown", tombolKeyboard);
    return () => window.removeEventListener("keydown", tombolKeyboard);
  }, []);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm">
     <div
      className="flex min-h-full items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sibuk) onBatal();
      }}
     >
      <div
        ref={kotak}
        role="dialog"
        aria-modal="true"
        aria-labelledby="judul-modal"
        className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="p-5 sm:p-6 md:p-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="shrink-0 w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center border-4 border-white shadow-sm">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 4h.01M10.3 4.3L2.6 17.5A2 2 0 004.3 20.5h15.4a2 2 0 001.7-3L13.7 4.3a2 2 0 00-3.4 0z" />
              </svg>
            </div>
            <div className="min-w-0 w-full">
              <h3 id="judul-modal" className="text-xl font-extrabold text-[#0a1e2b] leading-tight mb-3">{judul}</h3>
              <div className="space-y-3 text-sm text-gray-600 font-medium leading-relaxed bg-gray-50 p-4 rounded-xl text-left border border-gray-100">
                {children}
              </div>
            </div>
          </div>
        </div>
        
        {/* Tombol-tombol disusun menjadi kolom (bertumpuk ke bawah) di semua ukuran layar */}
        <div className="p-5 sm:p-6 pt-0 sm:pt-0 flex flex-col gap-3 w-full">
          {tombol.map((t, i) => {
            // Tentukan gaya tombol berdasarkan properti 'gaya'
            let styleTombol = "bg-blue-600 text-white hover:bg-blue-700 border border-transparent"; 
            
            if (t.gaya === "bahaya") {
              styleTombol = "bg-red-600 text-white hover:bg-red-700 border border-transparent";
            } else if (t.gaya === "sekunder") {
              // Perbaikan untuk teks samar: Beri warna teks merah tegas dengan latar putih
              styleTombol = "bg-white text-red-600 border border-red-200 hover:bg-red-50"; 
            }

            return (
              <button
                key={i}
                type="button"
                onClick={t.onClick}
                disabled={sibuk}
                className={`w-full px-5 py-3 rounded-xl font-bold transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-sm shadow-sm hover:shadow-md ${styleTombol}`}
              >
                {t.label}
              </button>
            );
          })}
          
          <button
            type="button"
            onClick={onBatal}
            disabled={sibuk}
            ref={batalRef}
            className="w-full px-5 py-3 bg-white text-gray-700 border border-gray-300 rounded-xl font-bold hover:bg-gray-100 hover:text-gray-900 transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-sm shadow-sm"
          >
            Batal
          </button>
        </div>
      </div>
     </div>
    </div>
  );
}