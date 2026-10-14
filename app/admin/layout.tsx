"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Poppins } from "next/font/google";
import { supabase } from "@/lib/supabase";
import { useSesiBerubah, keluarAkun } from "@/lib/useSesiBerubah";
import PeringatanSesi from "@/components/PeringatanSesi";
import PeringatanIdle from "@/components/PeringatanIdle";
import { useIdleLogout } from "@/lib/useIdleLogout";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Menggunakan bi-grid-fill dari Bootstrap
const IkonJadwal = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={className} viewBox="0 0 16 16">
    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
  </svg>
);

// Menggunakan bi-people-fill dari Bootstrap (Ikon 2 orang)
const IkonKelompok = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={className} viewBox="0 0 16 16">
    <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7Zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216ZM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
  </svg>
);

const MENU = [
  { href: "/admin/jadwal", label: "Jadwal", judul: "Jadwal Praktikum", Ikon: IkonJadwal },
  { href: "/admin/kelompok", label: "Daftar Kelompok", judul: "Daftar Kelompok", Ikon: IkonKelompok },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [siap, setSiap] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const statusSesi = useSesiBerubah(uid);
  const idle = useIdleLogout(uid !== null);

  // Hanya admin yang boleh melihat halaman di bawah /admin
  useEffect(() => {
    let batal = false;
    (async () => {
      // getSession() membaca sesi dari perangkat tanpa memanggil server Auth. getUser() memanggil /auth/v1/user
      // pada setiap pemuatan halaman dan terkena batas laju per IP (di kampus banyak orang berbagi satu IP).
      // Ini hanya penjaga tampilan; keamanan sebenarnya ada di RLS database dan di cekAdmin() sisi server.
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return router.replace("/login");
      const { data: me } = await supabase.from("mahasiswa").select("is_admin").eq("user_id", user.id).maybeSingle();
      if (!me?.is_admin) return router.replace("/ketua/registrasi");
      if (!batal) {
        setUid(user.id);
        setSiap(true);
      }
    })();
    return () => {
      batal = true;
    };
  }, [router]);

  const aktif = MENU.find((m) => pathname.startsWith(m.href)) ?? MENU[0];

  if (!siap) {
    return (
      <div className={`tinggi-min-layar bg-[#f8f9fc] flex items-center justify-center ${poppins.className}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#23424A]"></div>
      </div>
    );
  }

  return (
    <div className={`flex tinggi-layar bg-[#f8f9fc] ${poppins.className} overflow-hidden`}>
      <PeringatanSesi status={statusSesi} />
      <PeringatanIdle sisaDetik={idle.sisaDetik} onLanjut={idle.lanjut} />
      {/* SIDEBAR */}
      <aside className="w-64 bg-[#23424A] flex-col relative z-20 hidden lg:flex shrink-0">
        <div>
          <div className="p-8 pb-10 flex items-center justify-center">
            <Image src="/logoadminsisgrid.svg" alt="LOGO SISGRID" width={150} height={150} className="object-contain" priority />
          </div>

          <nav className="flex flex-col gap-2 pl-5">
            {MENU.map(({ href, label, Ikon }) => {
              const on = href === aktif.href;
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={on ? "page" : undefined}
                  className={
                    on
                      // Hapus w-[calc(100%+1px)] dan ganti menjadi w-full biasa agar ujungnya presisi
                      ? "relative bg-[#f8f9fc] text-[#23424A] py-4 pl-6 pr-8 rounded-l-full font-extrabold flex items-center gap-4 w-full z-30"
                      : "text-[#8fa3a8] hover:text-white hover:bg-white/5 py-4 pl-6 pr-8 font-bold flex items-center gap-4 transition-colors rounded-l-full w-full"
                  }
                >
                  {/* Efek lengkungan (inverse border radius) */}
                  {on && (
                    <>
                      {/* Lengkungan Atas - sekarang otomatis sejajar dengan garis lurus sidebar */}
                      <div className="absolute right-0 -top-6 w-6 h-6 bg-[#f8f9fc] pointer-events-none">
                        <div className="w-full h-full bg-[#23424A] rounded-br-full"></div>
                      </div>
                      {/* Lengkungan Bawah - sekarang otomatis sejajar dengan garis lurus sidebar */}
                      <div className="absolute right-0 -bottom-6 w-6 h-6 bg-[#f8f9fc] pointer-events-none">
                        <div className="w-full h-full bg-[#23424A] rounded-tr-full"></div>
                      </div>
                    </>
                  )}
                  
                  <Ikon className="w-[22px] h-[22px] shrink-0" />
                  <span className="text-[15px] tracking-wide">{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Sidebar (Gambar Background & Copyright) */}
        <div className="mt-auto relative w-full h-64 flex flex-col justify-end overflow-hidden">
          {/* Overlay gambar panel surya dengan gradient agar menyatu ke atas */}
          <div className="absolute inset-0 z-0">
             <div className="absolute inset-0 bg-gradient-to-t from-[#23424A] via-[#23424A]/80 to-transparent z-10" />
             {/* Pastikan file solar-panel-bg.jpg ada di folder public/ */}
             <img src="/solar-panel-bg.png" alt="Background" className="w-full h-full object-cover mix-blend-overlay opacity-40" />
          </div>
          
          {/* Teks Copyright di tengah bawah */}
          <div className="relative z-20 p-6 text-center pb-8">
            <p className="text-white text-[10px] sm:text-xs font-bold leading-tight tracking-wide">
              © 2026 Devdan Wisesa.<br />
              All Rights Reserved.
            </p>
          </div>
        </div>
      </aside>

      {/* AREA UTAMA */}
      <div className="flex-1 flex flex-col tinggi-layar overflow-hidden min-w-0">
        <header className="bg-[#f8f9fc] px-4 sm:px-8 py-5 sm:py-6 flex items-center justify-between border-b border-gray-200/60 z-10 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <aktif.Ikon className="w-7 h-7 sm:w-8 sm:h-8 text-[#0a1e2b] shrink-0" />
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[#0a1e2b] tracking-tight truncate">{aktif.judul}</h1>
          </div>
          <button
            onClick={async () => {
              await keluarAkun();
              router.replace("/login");
            }}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 sm:py-2 rounded-lg transition-colors cursor-pointer shadow-sm shrink-0 ml-3"
          >
            Keluar
          </button>
        </header>

        {/* Navigasi untuk layar HP dan tablet (sidebar disembunyikan di bawah lg) */}
        <nav className="lg:hidden flex gap-2 px-4 sm:px-8 py-2 bg-white border-b border-gray-200/60 shrink-0">
          {MENU.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              aria-current={href === aktif.href ? "page" : undefined}
              className={`flex-1 sm:flex-none text-center px-4 py-2.5 rounded-full text-sm font-semibold ${
                href === aktif.href ? "bg-[#23424A] text-white" : "text-[#23424A] bg-gray-100"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="max-w-6xl mx-auto space-y-6 pb-20">{children}</div>
        </main>
      </div>
    </div>
  );
}