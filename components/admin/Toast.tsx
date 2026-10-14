"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type Notif = { teks: string; ok: boolean } | null;

// Notifikasi singkat: hijau untuk berhasil, merah untuk gagal (gagal tampil lebih lama agar sempat dibaca).
export function useNotif() {
  const [notif, setNotif] = useState<Notif>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const tampilkan = useCallback((teks: string, ok = true) => {
    clearTimeout(timer.current);
    setNotif({ teks, ok });
    timer.current = setTimeout(() => setNotif(null), ok ? 3500 : 8000);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { notif, tampilkan };
}

export function Toast({ notif }: { notif: Notif }) {
  if (!notif) return null;
  const gaya = notif.ok
    ? "bg-emerald-100 border-emerald-500 text-emerald-800"
    : "bg-red-100 border-red-500 text-red-800";
  return (
    <div
      role="status"
      className={`fixed top-20 left-4 right-4 sm:top-24 sm:left-auto sm:right-8 z-[60] sm:max-w-md border-l-4 p-4 rounded shadow-md flex items-start gap-3 ${gaya}`}
    >
      <svg className="w-5 h-5 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {notif.ok ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        )}
      </svg>
      <p className="text-sm font-bold break-words">{notif.teks}</p>
    </div>
  );
}
