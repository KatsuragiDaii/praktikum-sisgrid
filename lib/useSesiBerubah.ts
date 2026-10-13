"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { hapusAktivitas } from "@/lib/idle";

export type StatusSesi = "" | "lain" | "keluar";

// Dipakai tombol "Keluar" di tab ini sendiri, supaya keluar yang disengaja tidak dianggap "sesi berakhir di tab lain".
let keluarSendiri = false;
// scope "global" (bawaan Supabase) mengeluarkan akun ini dari SEMUA perangkat; "local" hanya browser ini.
export async function keluarAkun(scope: "global" | "local" = "global") {
  keluarSendiri = true;
  try {
    await supabase.auth.signOut({ scope });
  } finally {
    keluarSendiri = false;
    hapusAktivitas();
  }
}

// Sesi login Supabase disimpan di localStorage, jadi SEMUA tab di browser yang sama (satu profil) berbagi satu sesi.
// Jika tab lain masuk dengan akun berbeda (mis. admin), tab ini otomatis ikut berganti akun saat dimuat ulang.
// Hook ini memberi tahu tab yang sedang terbuka supaya bisa menampilkan peringatan, bukan diam-diam menampilkan
// akun lain. `userId` = akun yang sedang ditampilkan tab ini (null = belum siap, tidak memantau).
export function useSesiBerubah(userId: string | null): StatusSesi {
  const [status, setStatus] = useState<StatusSesi>("");

  useEffect(() => {
    if (!userId) return;

    // 1) Tab lain masuk / menyegarkan sesi: auth-js menyiarkannya ke semua tab.
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (!keluarSendiri) setStatus("keluar");
      } else if (session && session.user.id !== userId) setStatus("lain");
    });

    // 2) Cadangan: saat tab kembali aktif, cocokkan lagi dengan sesi yang tersimpan (baca lokal, tanpa ke server).
    const cocokkan = async () => {
      if (document.visibilityState === "hidden") return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) setStatus("keluar");
      else if (session.user.id !== userId) setStatus("lain");
    };
    window.addEventListener("focus", cocokkan);
    document.addEventListener("visibilitychange", cocokkan);

    return () => {
      data.subscription.unsubscribe();
      window.removeEventListener("focus", cocokkan);
      document.removeEventListener("visibilitychange", cocokkan);
    };
  }, [userId]);

  return status;
}
