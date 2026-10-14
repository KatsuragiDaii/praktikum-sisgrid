"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Poppins } from "next/font/google";
import { supabase, emailDariNim, HARI, SHIFT } from "@/lib/supabase";
import { hurufKelompok } from "@/lib/kelompok";
import { useSesiBerubah, keluarAkun } from "@/lib/useSesiBerubah";
import PeringatanSesi from "@/components/PeringatanSesi";
import PeringatanIdle from "@/components/PeringatanIdle";
import { useIdleLogout } from "@/lib/useIdleLogout";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// --- Tipe Data ---
interface JadwalShift {
  id: string;
  hari: string;
  shift: number;
  waktu: string;
  sisaKuota: number;
  maksKuota: number;
}
type SlotDb = { id: number; hari: number; shift: number; kuota: number; terisi: number };
type MhsDb = {
  user_id: string | null;
  is_admin: boolean;
  nim: string;
  nama: string;
  is_ketua: boolean;
  kelompok: { nomor: number; kelas: { nama: string } } | null;
};

// --- Komponen Ikon ---
// Ikon Profil Akun (Menggunakan bi-person-fill dari Bootstrap Icons)
const IkonKelompok = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={className} viewBox="0 0 16 16">
    <path d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H3Zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
  </svg>
);

// Ikon War Ticket / Grid Kotak-kotak (Menggunakan bi-grid-fill dari Bootstrap Icons)
const IkonJadwal = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className={className} viewBox="0 0 16 16">
    <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z"/>
  </svg>
);

const MENU_KETUA = [
  { id: "jadwal", label: "War Ticket", Ikon: IkonJadwal },
  { id: "profil", label: "Profil Akun", Ikon: IkonKelompok },
];

export default function DashboardKetua() {
  const router = useRouter();
  
  // --- STATE MENU ---
  const [activeMenu, setActiveMenu] = useState<"jadwal" | "profil">("jadwal");

  const [profilKetua, setProfilKetua] = useState({ nama: "", nim: "", kelompok: "", kelas: "-", isKetua: false });
  const [anggotaKelompok, setAnggotaKelompok] = useState<{ id: string; nim: string; nama: string; role: string }[]>([]);
  
  // State Password
  const [pwLama, setPwLama] = useState("");
  const [pwBaru, setPwBaru] = useState("");
  const [pwUlang, setPwUlang] = useState("");
  const [pesanPw, setPesanPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  
  const hariList = HARI.map((h) => h.toUpperCase());

  // --- STATE REGISTRASI ---
  const [jadwalTersedia, setJadwalTersedia] = useState<JadwalShift[]>([]); 
  const [jadwalTerpilih, setJadwalTerpilih] = useState<JadwalShift | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetJadwal, setTargetJadwal] = useState<JadwalShift | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const statusSesi = useSesiBerubah(uid);
  const idle = useIdleLogout(uid !== null);

  const muat = useCallback(async () => {
    // getSession() membaca sesi dari perangkat tanpa memanggil server Auth (getUser() memanggil /auth/v1/user tiap
    // halaman dimuat dan terkena batas laju per IP). Data tetap dilindungi RLS di database.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return router.replace("/login");

    const [m, s, p] = await Promise.all([
      supabase.from("mahasiswa").select("*, kelompok(nomor, kelas(nama))").order("nim"),
      supabase.from("slot_terisi").select("*").order("hari").order("shift"),
      supabase.from("pendaftaran").select("slot_id").maybeSingle(),
    ]);

    const rows = (m.data ?? []) as unknown as MhsDb[];
    const saya = rows.find((r) => r.user_id === user.id);
    
    if (!saya) {
      await keluarAkun();
      return router.replace("/login");
    }

    // Akun admin tidak punya kelompok; halamannya ada di /admin (mis. setelah tab ini berganti akun karena
    // login admin di tab lain pada browser yang sama).
    if (saya.is_admin) return router.replace("/admin/dashboard");

    setUid(user.id);
    setProfilKetua({
      nama: saya.nama,
      nim: saya.nim,
      kelompok: saya.kelompok ? hurufKelompok(saya.kelompok.nomor) : "",
      kelas: saya.kelompok?.kelas.nama ?? "-",
      isKetua: saya.is_ketua,
    });

    setAnggotaKelompok(
      rows
        .filter((r) => r.kelompok?.nomor === saya.kelompok?.nomor)
        .map((r) => ({ 
          id: r.nim, 
          nim: r.nim, 
          nama: r.nama.toUpperCase(), 
          role: r.is_ketua ? "KETUA" : "ANGGOTA" 
        }))
        .sort((a, b) => {
          // Pindahkan ketua ke urutan paling atas (-1)
          if (a.role === "KETUA") return -1;
          if (b.role === "KETUA") return 1;
          // Sisanya diurutkan berdasarkan NIM atau Nama
          return a.nim.localeCompare(b.nim);
        })
    );

    const jadwal: JadwalShift[] = ((s.data ?? []) as SlotDb[]).map((x) => ({
      id: String(x.id),
      hari: HARI[x.hari - 1].toUpperCase(),
      shift: x.shift,
      waktu: SHIFT[x.shift - 1],
      sisaKuota: Math.max(x.kuota - x.terisi, 0),
      maksKuota: x.kuota,
    }));

    setJadwalTersedia(jadwal);
    setJadwalTerpilih(jadwal.find((j) => j.id === String(p.data?.slot_id)) ?? null);
    setIsMounted(true);
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data awal dari Supabase
    muat();
  }, [muat]);

  const gantiPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPesanPw("");
    if (pwBaru.length < 8) return setPesanPw("Password baru minimal 8 karakter.");
    if (pwBaru !== pwUlang) return setPesanPw("Konfirmasi password tidak sama.");
    setSavingPw(true);
    
    const { error: e1 } = await supabase.auth.signInWithPassword({ email: emailDariNim(profilKetua.nim), password: pwLama });
    if (e1) {
      setPesanPw("Password lama salah.");
      setSavingPw(false);
      return;
    }
    
    const { error: e2 } = await supabase.auth.updateUser({ password: pwBaru });
    setPesanPw(e2 ? e2.message : "Password berhasil diganti.");
    if (!e2) { setPwLama(""); setPwBaru(""); setPwUlang(""); }
    setSavingPw(false);
  };

  const handlePilihJadwal = (jadwal: JadwalShift) => {
    if (jadwal.sisaKuota === 0) return;
    if (!profilKetua.isKetua) {
      alert("Hanya ketua kelompok yang dapat melakukan registrasi.");
      return;
    }
    setTargetJadwal(jadwal);
    setIsModalOpen(true);
  };

  const konfirmasiRegistrasi = async () => {
    if (!targetJadwal) return;
    setIsLoading(true);
    const { error } = await supabase.rpc("daftar_slot", { p_slot: Number(targetJadwal.id) });
    if (error) alert(error.message);
    await muat();
    setIsLoading(false);
    setIsModalOpen(false);
  };

  const batalPilihJadwal = async () => {
    if (!jadwalTerpilih) return;
    setIsCancelling(true);
    const { error } = await supabase.rpc("batal_daftar");
    if (error) alert(error.message);
    await muat();
    setTargetJadwal(null);
    setIsCancelling(false);
  };

  const kartu = "bg-white rounded-2xl border border-gray-200 p-5 sm:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]";

  if (!isMounted) {
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
      
      {/* SIDEBAR KIRI (laptop/desktop, lebar >= 1024px) */}
      <aside className="hidden lg:flex w-64 bg-[#23424A] flex-col shrink-0 relative z-20 overflow-hidden">
        
        {/* LOGO */}
        <div className="p-8 pb-4 flex items-center justify-center">
          <Image src="/logoadminsisgrid.svg" alt="LOGO SISGRID" width={150} height={150} className="object-contain" priority />
        </div>

        {/* NAVIGASI (Dengan efek Inverse Border-Radius seperti halaman Admin) */}
        <nav className="flex flex-col gap-2 pl-5 mt-8 w-full relative z-30">
          {MENU_KETUA.map(({ id, label, Ikon }) => {
            const aktif = activeMenu === id;
            return (
              <button
                key={id}
                onClick={() => setActiveMenu(id as "jadwal" | "profil")}
                className={
                  aktif
                    // Tambahkan cursor-pointer di sini
                    ? "relative bg-[#f8f9fc] text-[#23424A] py-4 pl-6 pr-8 rounded-l-full font-extrabold flex items-center gap-4 w-full z-30 text-left transition-all cursor-pointer"
                    // Dan juga di sini
                    : "text-[#8fa3a8] hover:text-white hover:bg-white/5 py-4 pl-6 pr-8 font-bold flex items-center gap-4 transition-all rounded-l-full w-full text-left cursor-pointer"
                }
              >
                {/* Efek lengkungan di atas dan bawah khusus menu aktif */}
                {aktif && (
                  <>
                    <div className="absolute right-0 -top-6 w-6 h-6 bg-[#f8f9fc] pointer-events-none">
                      <div className="w-full h-full bg-[#23424A] rounded-br-full"></div>
                    </div>
                    <div className="absolute right-0 -bottom-6 w-6 h-6 bg-[#f8f9fc] pointer-events-none">
                      <div className="w-full h-full bg-[#23424A] rounded-tr-full"></div>
                    </div>
                  </>
                )}
                
                <Ikon className="w-[22px] h-[22px] shrink-0" />
                <span className="text-[15px] tracking-wide">{label}</span>
              </button>
            );
          })}
        </nav>

        {/* FOOTER SIDEBAR (Gambar Panel Surya & Copyright) */}
        <div className="mt-auto relative w-full h-64 flex flex-col justify-end overflow-hidden">
          <div className="absolute inset-0 z-0">
             <div className="absolute inset-0 bg-gradient-to-t from-[#23424A] via-[#23424A]/80 to-transparent z-10" />
             <img src="/solar-panel-bg.png" alt="Background" className="w-full h-full object-cover mix-blend-overlay opacity-40" />
          </div>
          
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
        
        {/* HEADER */}
        <header className="bg-[#f8f9fc] px-4 sm:px-8 py-5 sm:py-6 flex items-center justify-between border-b border-gray-200/60 z-10 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            {activeMenu === "jadwal" ? (
              <IkonJadwal className="w-7 h-7 sm:w-8 sm:h-8 text-[#0a1e2b] shrink-0" />
            ) : (
              <IkonKelompok className="w-7 h-7 sm:w-8 sm:h-8 text-[#0a1e2b] shrink-0" />
            )}
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-extrabold text-[#0a1e2b] tracking-tight leading-tight pb-1">
              {activeMenu === "jadwal" ? "Registrasi Praktikum" : "Profil & Kelompok"}
            </h1>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-3">
             <div className="hidden sm:block text-right mr-2">
                 <p className="text-sm font-bold text-gray-800">{profilKetua.kelas}</p>
                 <p className="text-xs text-gray-500">{profilKetua.kelompok ? `${profilKetua.isKetua ? "Ketua" : "Anggota"} Kelompok ${profilKetua.kelompok}` : "Belum tergabung kelompok"}</p>
             </div>
            <button
              onClick={async () => {
                await keluarAkun();
                router.replace("/login");
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2.5 sm:py-2 rounded-lg transition-colors shadow-sm cursor-pointer"
            >
              Keluar
            </button>
          </div>
        </header>

        {/* Navigasi layar HP dan tablet (sidebar disembunyikan di bawah lg) */}
        <nav className="lg:hidden flex gap-2 px-4 sm:px-8 py-2 bg-white border-b border-gray-200/60 shrink-0">
           <button 
              onClick={() => setActiveMenu("jadwal")}
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-full text-sm font-semibold cursor-pointer ${activeMenu === "jadwal" ? "bg-[#23424A] text-white" : "text-[#23424A] bg-gray-100"}`}
           >
              War Ticket
           </button>
           <button 
              onClick={() => setActiveMenu("profil")} 
              className={`flex-1 sm:flex-none px-4 py-2.5 rounded-full text-sm font-semibold cursor-pointer ${activeMenu === "profil" ? "bg-[#23424A] text-white" : "text-[#23424A] bg-gray-100"}`}
           >
              Profil Akun
           </button>
        </nav>

        {/* WORKSPACE CONTENT */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8">
          
          {/* ========================================= */}
          {/* HALAMAN 1: WAR TICKET (JADWAL REGISTRASI) */}
          {/* ========================================= */}
          {activeMenu === "jadwal" && (
            <div className="max-w-6xl mx-auto flex flex-col gap-6 pb-20">
              
              {/* BAGIAN ATAS (Status Registrasi Memanjang) */}
              <div className="w-full">
                {jadwalTerpilih ? (
                  <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl shadow-sm border border-emerald-400 p-6 md:p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block">
                      <svg className="w-64 h-64 -mr-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
                    </div>
                    
                    <div className="z-10 w-full md:w-auto text-center md:text-left flex-1">
                      <p className="text-sm font-bold text-emerald-100 mb-1 uppercase tracking-wider">Status Registrasi</p>
                      <h2 className="text-2xl sm:text-3xl font-black tracking-tight">BERHASIL</h2>
                    </div>

                    <div className="bg-white/20 rounded-xl p-4 md:px-6 backdrop-blur-sm border border-white/30 z-10 w-full md:w-auto flex items-center justify-between gap-8 shadow-sm">
                      <div>
                        <p className="text-xs text-emerald-50 mb-1 font-medium">Jadwal Anda:</p>
                        <p className="text-2xl font-bold">{jadwalTerpilih.hari}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-emerald-50 text-base">Shift {jadwalTerpilih.shift}</p>
                        <p className="text-xs text-emerald-100 mt-1 font-semibold tracking-wider">{jadwalTerpilih.waktu}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-2xl shadow-sm border border-amber-400 p-6 md:p-8 text-white relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-10 pointer-events-none hidden md:block">
                      <svg className="w-64 h-64 -mr-10" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path></svg>
                    </div>
                    <div className="z-10 text-center md:text-left">
                        <p className="text-sm font-bold text-amber-100 mb-1 uppercase tracking-wider">Status Registrasi</p>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight">BELUM MEMILIH</h2>
                        <p className="text-sm sm:text-base text-orange-50 mt-2 font-medium">Segera pilih jadwal di panel bawah sebelum kuota habis!</p>
                    </div>
                  </div>
                )}
              </div>

              {/* BAGIAN BAWAH (Pemilihan Jadwal) */}
              <div className="w-full">
                <div className={kartu + " flex flex-col h-full relative"}>
                  <div className="border-b border-gray-100 pb-5 mb-5 flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                    <div>
                      <h2 className="text-xl sm:text-2xl font-extrabold text-[#0a1e2b]">Pilih Jadwal Praktikum</h2>
                      <p className="text-sm font-medium text-gray-500 mt-1">Pilih satu shift yang tersedia untuk kelompok Anda.</p>
                    </div>
                    <div className="flex gap-4 text-xs font-bold text-gray-600">
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span> Tersedia</div>
                      <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-300"></span> Penuh</div>
                    </div>
                  </div>

                  <div className="relative flex-1">
                    {jadwalTerpilih && (
                      <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm rounded-xl flex items-center justify-center">
                        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 text-center max-w-sm mx-4">
                           <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-5 border-4 border-emerald-50">
                             <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                           </div>
                           <h3 className="text-xl font-extrabold text-[#0a1e2b] mb-2">Jadwal Terkunci</h3>
                           <p className="text-sm font-medium text-gray-600 mb-6">Kelompok Anda terdaftar di <br/><strong className="text-gray-800">{jadwalTerpilih.hari}, Shift {jadwalTerpilih.shift}</strong>.</p>
                           
                           <button 
                            onClick={batalPilihJadwal}
                            disabled={isCancelling || !profilKetua.isKetua}
                            className="w-full py-3 px-6 rounded-xl border-2 border-red-200 text-red-600 font-bold text-sm hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                          >
                            {isCancelling ? "Membatalkan..." : "Batalkan & Pilih Ulang"}
                           </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {hariList.map((hari) => (
                        <div key={hari} className="border border-gray-200 rounded-xl overflow-hidden flex flex-col bg-gray-50/50">
                          <div className="bg-gray-100 py-2.5 text-center border-b border-gray-200">
                            <h3 className="font-extrabold text-gray-700 tracking-widest text-sm">{hari}</h3>
                          </div>
                          
                          <div className="p-3 space-y-2 flex-1">
                            {jadwalTersedia
                              .filter((j) => j.hari === hari)
                              .map((jadwal) => {
                                const isFull = jadwal.sisaKuota === 0;
  
                                let btnStyle = "border-gray-200 bg-white hover:border-[#23424A] hover:shadow-md cursor-pointer";
                                let quotaStyle = "bg-emerald-100 text-emerald-700 border border-emerald-200";
                                let timeStyle = "text-gray-800";
                                
                                if (isFull) {
                                  btnStyle = "border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed";
                                  quotaStyle = "bg-gray-200 text-gray-500 border border-gray-300";
                                  timeStyle = "text-gray-400 line-through";
                                }

                                return (
                                  <div 
                                    key={jadwal.id} 
                                    onClick={() => handlePilihJadwal(jadwal)}
                                    className={`p-3 rounded-xl border-2 transition-all flex justify-between items-center group ${btnStyle}`}
                                  >
                                    <div>
                                      <p className="text-[10px] font-extrabold text-gray-400 mb-0.5 tracking-wider">SHIFT {jadwal.shift}</p>
                                      <p className={`text-sm font-bold ${timeStyle}`}>{jadwal.waktu}</p>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                      <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${quotaStyle}`}>
                                        {isFull ? "PENUH" : `SISA ${jadwal.sisaKuota}`}
                                      </span>
                                      {!isFull && profilKetua.isKetua && (
                                        <span className="text-[10px] text-[#23424A] font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          PILIH
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================= */}
          {/* HALAMAN 2: PROFIL AKUN & KELOMPOK           */}
          {/* ========================================= */}
          {activeMenu === "profil" && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 pb-20">
              
              {/* KOLOM KIRI (Ganti Password & Info Akun) */}
              <div className="xl:col-span-5">
                <div className={kartu + " !p-0 overflow-hidden"}>
                  <div className="bg-[#23424A] p-6 text-white text-center">
                     <h3 className="text-xl font-extrabold mb-1">Profil Akun</h3>
                     <p className="text-sm text-white/70 font-medium">Pengaturan Keamanan</p>
                  </div>
                  <form onSubmit={gantiPassword} className="p-6 space-y-5 bg-white">
                    <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center shadow-sm">
                      <p className="font-bold text-gray-800">{profilKetua.nama}</p>
                      <p className="text-xs text-gray-500 font-medium mt-1 tracking-wide">{profilKetua.nim}</p>
                    </div>
                    
                    <div className="space-y-3 pt-2">
                      <h4 className="text-sm font-extrabold text-[#0a1e2b]">Ganti Password</h4>
  
                    <input 
                      type="password" 
                      required 
                      placeholder="Password lama" 
                      value={pwLama} 
                      onChange={(e) => setPwLama(e.target.value)} 
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base lg:text-sm font-semibold text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#23424A] focus:ring-1 focus:ring-[#23424A]" 
                    />
  
                    <input 
                      type="password" 
                      required 
                      minLength={8} 
                      placeholder="Password baru (min. 8)" 
                      value={pwBaru} 
                      onChange={(e) => setPwBaru(e.target.value)} 
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base lg:text-sm font-semibold text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#23424A] focus:ring-1 focus:ring-[#23424A]" 
                    />
  
                    <input 
                      type="password" 
                      required 
                      placeholder="Ulangi password baru" 
                      value={pwUlang} 
                      onChange={(e) => setPwUlang(e.target.value)} 
                      className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base lg:text-sm font-semibold text-gray-800 placeholder-gray-500 focus:outline-none focus:border-[#23424A] focus:ring-1 focus:ring-[#23424A]" 
                    />
                  </div>
                    
                    {pesanPw && <p className={`text-xs font-bold text-center ${pesanPw.startsWith("Password berhasil") ? "text-emerald-600" : "text-red-600"}`}>{pesanPw}</p>}
                    
                    <div className="pt-2">
                      <button disabled={savingPw} className="w-full py-3.5 rounded-xl bg-[#23424A] hover:bg-[#152a30] text-white font-bold transition-all disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed">
                        {savingPw ? "Menyimpan..." : "Simpan Password Baru"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* KOLOM KANAN (Daftar Anggota Kelompok) */}
              <div className="xl:col-span-7">
                <div className={kartu + " !p-0 overflow-hidden"}>
                  <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                      <h2 className="font-extrabold text-[#0a1e2b] text-xl">{profilKetua.kelompok ? `Kelompok ${profilKetua.kelompok}` : "Belum ada kelompok"}</h2>
                      <p className="text-sm font-semibold text-gray-500 mt-1">Kelas: {profilKetua.kelas}</p>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-xs font-bold border ${anggotaKelompok.length >= 2 && anggotaKelompok.length <= 6 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                      {anggotaKelompok.length} Anggota
                    </span>
                  </div>
                  
                  <ul className="divide-y divide-gray-100 bg-white">
                    {anggotaKelompok.length > 0 ? (
                      anggotaKelompok.map((mhs) => (
                        <li key={mhs.id} className="flex items-center gap-4 p-5 hover:bg-gray-50 transition-colors">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${mhs.role === 'KETUA' ? 'bg-[#23424A]/10 text-[#23424A]' : 'bg-gray-100 text-gray-400'}`}>
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm truncate ${mhs.role === 'KETUA' ? 'font-extrabold text-[#0a1e2b]' : 'font-bold text-gray-700'}`}>
                              {mhs.nama}
                            </p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5 tracking-wide">{mhs.nim}</p>
                          </div>
                          {mhs.role === 'KETUA' && (
                             <span className="bg-[#23424A] text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shrink-0 tracking-wider">KETUA</span>
                          )}
                        </li>
                      ))
                    ) : (
                      <li className="p-8 text-center text-gray-500 font-medium">Anda belum dimasukkan ke kelompok manapun oleh Admin.</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* MODAL KONFIRMASI JADWAL (Hanya muncul saat memilih jadwal) */}
      {isModalOpen && targetJadwal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm">
         <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-[#23424A] p-6 text-center">
               <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
                 <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
               </div>
               <h3 className="text-xl font-extrabold text-white">Konfirmasi Jadwal</h3>
            </div>
            
            <div className="p-6 sm:p-8 text-center space-y-4 bg-gray-50">
              <p className="text-gray-600 font-medium text-sm leading-relaxed">
                Kunci jadwal praktikum untuk <strong className="text-gray-800">Kelompok {profilKetua.kelompok}</strong> pada:
              </p>
              
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-2xl font-black text-[#0a1e2b]">{targetJadwal.hari}</p>
                <p className="text-lg font-bold text-[#23424A] mt-1">Shift {targetJadwal.shift}</p>
                <p className="text-sm text-gray-500 mt-2 font-semibold bg-gray-100 py-1 rounded-md tracking-wide">{targetJadwal.waktu}</p>
              </div>
              
              <p className="text-xs text-[#23424A] font-semibold">
                  Tenang, Anda tetap bisa membatalkan dan memilih ulang jadwal lain jika melakukan kesalahan.
              </p>
              
              <div className="flex gap-3 sm:gap-4 pt-4">
                <button onClick={() => setIsModalOpen(false)} disabled={isLoading} className="flex-1 py-3 rounded-xl border border-gray-300 text-gray-600 font-bold hover:bg-white transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed">
                  Batal
                </button>
                <button onClick={konfirmasiRegistrasi} disabled={isLoading} className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md transition-all disabled:opacity-80 flex justify-center items-center cursor-pointer disabled:cursor-not-allowed">
                  {isLoading ? (
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    "Kunci Jadwal"
                  )}
                </button>
              </div>
            </div>
          </div>
         </div>
        </div>
      )}
    </div>
  );
}