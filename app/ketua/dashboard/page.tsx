"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, HARI, SHIFT } from "@/lib/supabase";

type Slot = { id: number; hari: number; shift: number; kuota: number; terisi: number };
type Mhs = {
  user_id: string | null;
  nim: string;
  nama: string;
  is_ketua: boolean;
  kelompok: { nomor: number; kelas: { nama: string } } | null;
};

export default function Ketua() {
  const router = useRouter();
  const [uid, setUid] = useState("");
  const [anggota, setAnggota] = useState<Mhs[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [terpilih, setTerpilih] = useState<number | null>(null);
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/");
    setUid(user.id);
    const [m, s, p] = await Promise.all([
      supabase.from("mahasiswa").select("*, kelompok(nomor, kelas(nama))").order("nim"),
      supabase.from("slot_terisi").select("*").order("hari").order("shift"),
      supabase.from("pendaftaran").select("slot_id").maybeSingle(),
    ]);
    setAnggota((m.data ?? []) as unknown as Mhs[]);
    setSlots((s.data ?? []) as Slot[]);
    setTerpilih(p.data?.slot_id ?? null);
  }, [router]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function aksi(fn: "daftar_slot" | "batal_daftar", slot?: number) {
    if (fn === "daftar_slot" && !confirm("Daftarkan kelompok ke slot ini?")) return;
    if (fn === "batal_daftar" && !confirm("Batalkan pendaftaran kelompok?")) return;
    const { error } = await supabase.rpc(fn, slot ? { p_slot: slot } : {});
    setPesan(error ? error.message : fn === "daftar_slot" ? "Pendaftaran berhasil." : "Pendaftaran dibatalkan.");
    muat();
  }

  const saya = anggota.find((a) => a.user_id === uid);
  const ketua = !!saya?.is_ketua;
  const slotDi = (hari: number, shift: number) => slots.find((s) => s.hari === hari && s.shift === shift);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">
          {saya?.kelompok ? `${saya.kelompok.kelas.nama}, Kelompok ${saya.kelompok.nomor}` : "Registrasi Praktikum"}
        </h1>
        <button className="text-sm underline" onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}>
          Keluar
        </button>
      </header>

      <section>
        <h2 className="mb-2 font-medium">Anggota</h2>
        <ul className="text-sm">
          {anggota.map((a) => (
            <li key={a.nim}>{a.nim} - {a.nama}{a.is_ketua && " (ketua)"}</li>
          ))}
        </ul>
        {!ketua && <p className="mt-2 text-sm text-amber-600">Hanya ketua kelompok yang dapat mendaftar.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Pilih slot praktikum</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left">Shift</th>
                {HARI.map((h) => <th key={h} className="p-2">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {SHIFT.map((jam, i) => (
                <tr key={jam}>
                  <td className="whitespace-nowrap p-2">Shift {i + 1} ({jam})</td>
                  {HARI.map((_, h) => {
                    const s = slotDi(h + 1, i + 1);
                    if (!s) return <td key={h} />;
                    const penuh = s.terisi >= s.kuota;
                    const dipilih = s.id === terpilih;
                    return (
                      <td key={h} className="p-1">
                        <button
                          disabled={!ketua || terpilih !== null || penuh}
                          onClick={() => aksi("daftar_slot", s.id)}
                          className={`w-full rounded border p-2 disabled:opacity-40 ${dipilih ? "border-blue-700 bg-blue-700 text-white !opacity-100" : "border-zinc-400"}`}
                        >
                          {dipilih ? "Terdaftar" : penuh ? "Penuh" : `${s.terisi}/${s.kuota}`}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {terpilih !== null && ketua && (
          <button className="rounded border border-red-600 px-3 py-1 text-sm text-red-600" onClick={() => aksi("batal_daftar")}>
            Batalkan pendaftaran
          </button>
        )}
        {pesan && <p className="text-sm">{pesan}</p>}
      </section>
    </main>
  );
}
