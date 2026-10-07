"use client";

import { useState, useEffect } from "react";

// --- Tipe Data ---
interface JadwalShift {
  id: string;
  hari: string;
  shift: number;
  waktu: string;
  sisaKuota: number;
  maksKuota: number;
}

export default function DashboardKetua() {
  // --- MOCK DATA: Profil Login (Ketua) ---
  const profilKetua = {
    nama: "Devdan Wisesa Putranto",
    nim: "1101230001",
    kelompok: 1,
    kelas: "EL-46-01",
  };

  const anggotaKelompok = [
    { id: "P1", nim: "1101230001", nama: "DEVDAN WISESA PUTRANTO", role: "KETUA" },
    { id: "P2", nim: "101012400374", nama: "AKBAR ALIFANDY KRESNAWAN", role: "ANGGOTA" },
    { id: "P3", nim: "101012400155", nama: "DZAKY MUHAMMAD ASYAM", role: "ANGGOTA" },
    { id: "P4", nim: "101012400221", nama: "PRADIVA ADINDA FEBIOLA", role: "ANGGOTA" },
  ];

  const hariList = ["SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"];
  const shiftList = [
    { shift: 1, waktu: "06.30 - 09.30" },
    { shift: 2, waktu: "09.30 - 12.30" },
    { shift: 3, waktu: "12.30 - 15.30" },
    { shift: 4, waktu: "15.30 - 18.30" },
  ];

  // --- STATE REGISTRASI ---
  const [jadwalTersedia, setJadwalTersedia] = useState<JadwalShift[]>([]); 
  const [jadwalTerpilih, setJadwalTerpilih] = useState<JadwalShift | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetJadwal, setTargetJadwal] = useState<JadwalShift | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  const [isMounted, setIsMounted] = useState(false);

  // Mencegah Hydration Mismatch
  useEffect(() => {
    const dataJadwalAcak = hariList.flatMap((hari) =>
      shiftList.map((s) => {
        const isFull = hari === "SENIN" && s.shift === 1;
        const randomKuota = isFull ? 0 : Math.floor(Math.random() * 4) + 1; 
        return {
          id: `${hari}-${s.shift}`,
          hari,
          shift: s.shift,
          waktu: s.waktu,
          sisaKuota: randomKuota,
          maksKuota: 5,
        };
      })
    );
    setJadwalTersedia(dataJadwalAcak);
    setIsMounted(true);
  }, []);

  // --- FUNGSI LOGIKA ---
  const handlePilihJadwal = (jadwal: JadwalShift) => {
    if (jadwal.sisaKuota === 0) return; 
    setTargetJadwal(jadwal);
    setIsModalOpen(true);
  };

  const konfirmasiRegistrasi = () => {
    if (!targetJadwal) return;
    setIsLoading(true);

    // Proses Kunci Jadwal (Kuota - 1)
    setTimeout(() => {
      setJadwalTersedia((prev) =>
        prev.map((j) =>
          j.id === targetJadwal.id ? { ...j, sisaKuota: j.sisaKuota - 1 } : j
        )
      );
      setJadwalTerpilih(targetJadwal);
      setIsLoading(false);
      setIsModalOpen(false);
    }, 1000);
  };

  // FUNGSI BARU: Batal / Ubah Jadwal
  const batalPilihJadwal = () => {
    if (!jadwalTerpilih) return;
    setIsCancelling(true);

    // Proses Pengembalian Kuota (Kuota + 1)
    setTimeout(() => {
      setJadwalTersedia((prev) =>
        prev.map((j) =>
          j.id === jadwalTerpilih.id ? { ...j, sisaKuota: j.sisaKuota + 1 } : j
        )
      );
      setJadwalTerpilih(null);
      setTargetJadwal(null);
      setIsCancelling(false);
    }, 800);
  };

  if (!isMounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      
      {/* NAVBAR */}
      <nav className="bg-blue-900 text-white p-4 shadow-md sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center border border-white/20">
                <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
             </div>
             <div>
               <h1 className="font-bold text-lg leading-tight">Registrasi Kelompok</h1>
               <p className="text-xs text-blue-200">Hai, {profilKetua.nama.split(" ")[0]} (Ketua KLP {profilKetua.kelompok})</p>
             </div>
          </div>
          <button className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            Keluar
          </button>
        </div>
      </nav>

      {/* WORKSPACE UTAMA */}
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        
        {/* KOLOM KIRI: Profil & Anggota */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Status Registrasi Card */}
          {jadwalTerpilih ? (
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl shadow-lg border border-emerald-400 p-6 text-white relative overflow-hidden">
              <div className="absolute -right-6 -top-6 opacity-20">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path></svg>
              </div>
              <p className="text-sm font-bold text-emerald-100 mb-1 uppercase tracking-wider">Status Registrasi</p>
              <h2 className="text-2xl font-black mb-4">BERHASIL</h2>
              <div className="bg-white/20 rounded-xl p-4 backdrop-blur-sm border border-white/30 mb-4">
                <p className="text-sm text-emerald-50 mb-1">Jadwal Anda:</p>
                <p className="text-xl font-bold">{jadwalTerpilih.hari}</p>
                <p className="font-semibold text-emerald-100">Shift {jadwalTerpilih.shift} ({jadwalTerpilih.waktu})</p>
              </div>
              
              {/* Tombol Batal/Ubah di Kartu Kiri */}
              <button 
                onClick={batalPilihJadwal}
                disabled={isCancelling}
                className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-2 rounded-lg transition-colors border border-white/40 flex justify-center items-center gap-2"
              >
                {isCancelling ? "Memproses..." : "Ubah Jadwal"}
              </button>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-2xl shadow-lg border border-amber-400 p-6 text-white relative overflow-hidden animate-pulse-slow">
              <div className="absolute -right-6 -top-6 opacity-20">
                <svg className="w-32 h-32" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"></path></svg>
              </div>
              <p className="text-sm font-bold text-amber-100 mb-1 uppercase tracking-wider">Status Registrasi</p>
              <h2 className="text-xl font-black">BELUM MEMILIH</h2>
              <p className="text-sm text-orange-100 mt-2">Segera pilih jadwal di panel kanan sebelum kuota habis!</p>
            </div>
          )}

          {/* Rincian Kelompok */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="font-bold text-slate-800">Kelompok {profilKetua.kelompok}</h2>
                <p className="text-xs text-slate-500">Kelas: {profilKetua.kelas}</p>
              </div>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full">
                {anggotaKelompok.length} Anggota
              </span>
            </div>
            
            <div className="p-2 space-y-1">
              {anggotaKelompok.map((mhs) => (
                <div key={mhs.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${mhs.role === 'KETUA' ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-400'}`}>
                    {mhs.role === 'KETUA' ? '⭐' : '👤'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${mhs.role === 'KETUA' ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>
                      {mhs.nama}
                    </p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">{mhs.nim}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* KOLOM KANAN: Pemilihan Jadwal (War Ticket) */}
        <div className="lg:col-span-8">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex flex-col h-full relative">
            
            <div className="p-5 border-b border-slate-200 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-bold text-slate-800">Pilih Jadwal Praktikum</h2>
                <p className="text-sm text-slate-500 mt-1">Pilih satu shift yang tersedia untuk kelompok Anda.</p>
              </div>
              <div className="hidden md:flex gap-4 text-xs font-bold">
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Tersedia</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Hampir Penuh</div>
                <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-slate-300"></span> Penuh</div>
              </div>
            </div>

            {/* Grid Jadwal */}
            <div className="p-5 relative">
              {/* Jika sudah berhasil registrasi, Overlay Blur Aktif */}
              {jadwalTerpilih && (
                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm rounded-b-2xl flex items-center justify-center">
                  <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 text-center max-w-sm">
                     <div className="w-16 h-16 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                       <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                     </div>
                     <h3 className="text-lg font-bold text-slate-800 mb-2">Jadwal Terkunci</h3>
                     <p className="text-sm text-slate-600 mb-6">Anda telah berhasil mendaftar di <br/><strong>{jadwalTerpilih.hari}, Shift {jadwalTerpilih.shift}</strong>.</p>
                     
                     {/* Tombol Batal/Ubah di Overlay */}
                     <button 
                        onClick={batalPilihJadwal}
                        disabled={isCancelling}
                        className="w-full py-2.5 rounded-lg border-2 border-red-500 text-red-600 font-bold hover:bg-red-50 transition-colors disabled:opacity-50"
                     >
                       {isCancelling ? "Membatalkan..." : "Batalkan & Pilih Ulang"}
                     </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {hariList.map((hari) => (
                  <div key={hari} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                    <div className="bg-slate-200/50 py-2 text-center border-b border-slate-200">
                      <h3 className="font-black text-slate-700 tracking-widest">{hari}</h3>
                    </div>
                    
                    <div className="p-3 space-y-2 flex-1">
                      {jadwalTersedia
                        .filter((j) => j.hari === hari)
                        .map((jadwal) => {
                          const isFull = jadwal.sisaKuota === 0;
                          const isAlmostFull = jadwal.sisaKuota <= 2 && !isFull;
                          
                          let btnStyle = "border-slate-200 bg-white hover:border-blue-400 hover:shadow-md cursor-pointer";
                          let quotaStyle = "bg-emerald-100 text-emerald-700";
                          let timeStyle = "text-slate-800";
                          
                          if (isFull) {
                            btnStyle = "border-slate-200 bg-slate-100 opacity-60 cursor-not-allowed";
                            quotaStyle = "bg-slate-200 text-slate-500";
                            timeStyle = "text-slate-500 line-through";
                          } else if (isAlmostFull) {
                            quotaStyle = "bg-amber-100 text-amber-700";
                          }

                          return (
                            <div 
                              key={jadwal.id} 
                              onClick={() => handlePilihJadwal(jadwal)}
                              className={`p-3 rounded-lg border-2 transition-all flex justify-between items-center group ${btnStyle}`}
                            >
                              <div>
                                <p className="text-xs font-bold text-slate-400 mb-0.5">SHIFT {jadwal.shift}</p>
                                <p className={`text-sm font-black ${timeStyle}`}>{jadwal.waktu}</p>
                              </div>
                              <div className="text-right flex flex-col items-end">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${quotaStyle}`}>
                                  {isFull ? "PENUH" : `SISA ${jadwal.sisaKuota}`}
                                </span>
                                {!isFull && (
                                  <span className="text-[10px] text-blue-600 font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* MODAL KONFIRMASI */}
      {isModalOpen && targetJadwal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-blue-600 p-6 text-center">
               <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-blue-500">
                 <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
               </div>
               <h3 className="text-xl font-bold text-white">Konfirmasi Jadwal</h3>
            </div>
            <div className="p-6 text-center space-y-4">
              <p className="text-slate-600">Anda akan mengunci jadwal praktikum untuk <strong>Kelompok {profilKetua.kelompok}</strong> pada:</p>
              
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 inline-block mx-auto">
                <p className="text-2xl font-black text-blue-900">{targetJadwal.hari}</p>
                <p className="text-lg font-bold text-blue-700">Shift {targetJadwal.shift}</p>
                <p className="text-sm text-blue-500 font-mono mt-1">{targetJadwal.waktu}</p>
              </div>

              {/* Teks Peringatan Diperbarui */}
              <p className="text-xs text-blue-600 font-semibold bg-blue-50 p-2 rounded-lg border border-blue-100">
                💡 Tenang, Anda tetap bisa membatalkan dan memilih ulang jadwal lain jika melakukan kesalahan.
              </p>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
              <button onClick={() => setIsModalOpen(false)} disabled={isLoading} className="flex-1 py-2.5 rounded-lg text-slate-600 font-bold hover:bg-slate-200 transition-colors disabled:opacity-50">
                Batal
              </button>
              <button onClick={konfirmasiRegistrasi} disabled={isLoading} className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md transition-all disabled:opacity-80 flex justify-center items-center">
                {isLoading ? (
                   <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                ) : (
                  "Kunci Jadwal"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}