"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase, HARI, SHIFT } from "@/lib/supabase";
import { Toast, useNotif } from "@/components/admin/Toast";

type Slot = { id: number; hari: number; shift: number; kuota: number; terisi: number };

export default function JadwalPage() {
  const { notif, tampilkan } = useNotif();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [jmlKelompok, setJmlKelompok] = useState(0);
  const [versi, setVersi] = useState(0); // memaksa kolom kuota menampilkan nilai asli dari database
  const [massal, setMassal] = useState("");

  const muat = useCallback(async () => {
    const [s, k] = await Promise.all([
      supabase.from("slot_terisi").select("*").order("hari").order("shift"),
      supabase.from("kelompok").select("*", { count: "exact", head: true }),
    ]);
    setSlots((s.data ?? []) as Slot[]);
    setJmlKelompok(k.count ?? 0);
    setVersi((v) => v + 1);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data awal dari Supabase
    muat();
  }, [muat]);

  async function simpanKuota(id: number, nilai: string) {
    const kuota = Number(nilai);
    if (nilai.trim() === "" || !Number.isInteger(kuota) || kuota < 0) {
      tampilkan("Kuota harus berupa bilangan bulat 0 atau lebih.", false);
    } else {
      const { error } = await supabase.from("slot").update({ kuota }).eq("id", id);
      if (error) tampilkan(error.message, false);
      else tampilkan("Kuota berhasil disimpan.");
    }
    muat();
  }

  async function terapkanSemua() {
    const kuota = Number(massal);
    if (massal.trim() === "" || !Number.isInteger(kuota) || kuota < 0) {
      return tampilkan("Isi kuota dengan bilangan bulat 0 atau lebih.", false);
    }
    if (!confirm(`Ubah kuota semua ${slots.length} slot menjadi ${kuota}?`)) return;
    const { error } = await supabase.from("slot").update({ kuota }).gt("id", 0);
    if (error) tampilkan(error.message, false);
    else {
      tampilkan(`Kuota semua slot diubah menjadi ${kuota}.`);
      setMassal("");
    }
    muat();
  }

  const totalKuota = slots.reduce((a, s) => a + s.kuota, 0);
  const totalTerisi = slots.reduce((a, s) => a + s.terisi, 0);
  const kurang = totalKuota < jmlKelompok;

  return (
    <>
      <Toast notif={notif} />

      <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
        <div className="flex items-center gap-3 mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="w-6 h-6 text-[#0a1e2b]" viewBox="0 0 16 16">
            <path d="M10.5 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z"/>
            <path d="M0 8s3-5.5 8-5.5S16 8 16 8s-3 5.5-8 5.5S0 8 0 8zm8 3.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/>
          </svg>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0a1e2b]">Kuota Shift</h2>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-5">
          <div className="text-sm font-medium space-y-1">
            <p className={kurang ? "text-red-600" : "text-gray-600"}>
              Total kuota {totalKuota} untuk {jmlKelompok} kelompok.
              {kurang && ` Masih kurang ${jmlKelompok - totalKuota} kursi agar semua kelompok bisa mendaftar.`}
            </p>
            <p className="text-gray-500 text-xs">
              Sudah terdaftar {totalTerisi} kelompok. Ubah angka di tabel lalu tekan Enter atau klik di luar kolom untuk menyimpan.
              Kuota tidak bisa dikurangi di bawah jumlah kelompok yang sudah terdaftar.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
            <label htmlFor="massal" className="text-sm font-semibold text-gray-700">
              Samakan semua slot
            </label>
            <input
              id="massal"
              type="number"
              min={0}
              value={massal}
              onChange={(e) => setMassal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && terapkanSemua()}
              placeholder="0"
              className="w-16 h-10 lg:h-9 text-base lg:text-sm rounded border border-gray-300 bg-white text-center font-bold text-gray-800 focus:border-[#23424A] focus:ring-1 focus:ring-[#23424A] outline-none"
            />
            <button
              onClick={terapkanSemua}
              className="bg-[#23424A] hover:bg-[#162b31] text-white text-sm font-bold h-10 lg:h-9 px-4 rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              Terapkan
            </button>
          </div>
        </div>

        <div className="overflow-x-auto border border-gray-100 rounded-xl">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 border-b border-gray-100 text-gray-700">
              <tr>
                <th className="p-3 font-bold sticky left-0 z-10 bg-gray-50">Shift</th>
                {HARI.map((h) => (
                  <th key={h} className="p-3 font-bold text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-gray-600">
              {SHIFT.map((jam, i) => (
                <tr key={jam}>
                  <td className="p-3 whitespace-nowrap sticky left-0 z-10 bg-white border-r border-gray-100 md:border-r-0">
                    <span className="font-semibold text-gray-800">Shift {i + 1}</span>
                    <span className="block text-xs text-gray-400">{jam}</span>
                  </td>
                  {HARI.map((hari, h) => {
                    const s = slots.find((x) => x.hari === h + 1 && x.shift === i + 1);
                    const penuh = !!s && s.kuota > 0 && s.terisi >= s.kuota;
                    return (
                      <td key={hari} className="p-2 text-center align-middle">
                        {s && (
                          <div className="flex flex-col items-center">
                            <input
                              key={`${s.id}-${versi}`}
                              type="number"
                              min={0}
                              defaultValue={s.kuota}
                              aria-label={`Kuota ${hari} Shift ${i + 1}`}
                              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                              onBlur={(e) => e.target.value !== String(s.kuota) && simpanKuota(s.id, e.target.value)}
                              className="w-14 h-10 lg:h-9 text-base lg:text-sm rounded border border-gray-300 bg-white text-center font-bold text-gray-800 focus:border-[#23424A] focus:ring-1 focus:ring-[#23424A] outline-none"
                            />
                            <span className={`text-[10px] font-bold mt-1 ${penuh ? "text-red-500" : "text-gray-400"}`}>
                              {penuh ? "penuh " : ""}isi:{s.terisi}
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="md:hidden mt-2 text-xs font-medium text-gray-400">Geser tabel ke samping untuk melihat hari lainnya.</p>
      </div>
    </>
  );
}
