"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, HARI, SHIFT } from "@/lib/supabase";

type Slot = { id: number; hari: number; shift: number; kuota: number; terisi: number };

export default function Admin() {
  const router = useRouter();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [jmlKelompok, setJmlKelompok] = useState(0);
  const [teks, setTeks] = useState("");
  const [pesan, setPesan] = useState("");

  const muat = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return router.replace("/");
    const { data: me } = await supabase.from("mahasiswa").select("is_admin").eq("user_id", user.id).single();
    if (!me?.is_admin) return router.replace("/ketua");
    const [s, k] = await Promise.all([
      supabase.from("slot_terisi").select("*").order("hari").order("shift"),
      supabase.from("kelompok").select("*", { count: "exact", head: true }),
    ]);
    setSlots((s.data ?? []) as Slot[]);
    setJmlKelompok(k.count ?? 0);
  }, [router]);

  useEffect(() => {
    muat();
  }, [muat]);

  async function simpanKuota(id: number, kuota: number) {
    const { error } = await supabase.from("slot").update({ kuota }).eq("id", id);
    setPesan(error ? error.message : "Kuota disimpan.");
    muat();
  }

  // Format tiap baris: nim,nama,kelas,nomor kelompok,ketua(1/0)
  async function impor() {
    try {
      const ok = (r: { error: { message: string } | null }) => {
        if (r.error) throw new Error(r.error.message);
      };
      const baris = teks.split("\n").map((b) => b.split(",").map((x) => x.trim())).filter((b) => b.length >= 4 && b[0]);
      ok(await supabase.from("kelas").upsert([...new Set(baris.map((b) => b[2]))].map((nama) => ({ nama })), { onConflict: "nama" }));
      const kls = (await supabase.from("kelas").select("id,nama")).data ?? [];
      const idKelas = Object.fromEntries(kls.map((k) => [k.nama, k.id]));
      const kel = [...new Map(baris.map((b) => [`${b[2]}|${b[3]}`, { kelas_id: idKelas[b[2]], nomor: +b[3] }])).values()];
      ok(await supabase.from("kelompok").upsert(kel, { onConflict: "kelas_id,nomor" }));
      const kps = (await supabase.from("kelompok").select("id,kelas_id,nomor")).data ?? [];
      const idKel = Object.fromEntries(kps.map((k) => [`${k.kelas_id}|${k.nomor}`, k.id]));
      const mhs = baris.map((b) => ({
        nim: b[0].toLowerCase(),
        nama: b[1],
        kelompok_id: idKel[`${idKelas[b[2]]}|${+b[3]}`],
        is_ketua: b[4] === "1",
      }));
      ok(await supabase.from("mahasiswa").upsert(mhs, { onConflict: "nim" }));
      setPesan(`${mhs.length} mahasiswa tersimpan.`);
      setTeks("");
      muat();
    } catch (e) {
      setPesan((e as Error).message);
    }
  }

  const totalKuota = slots.reduce((a, s) => a + s.kuota, 0);

  return (
    <main className="mx-auto w-full max-w-4xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Admin Praktikum</h1>
        <button className="text-sm underline" onClick={async () => { await supabase.auth.signOut(); router.replace("/"); }}>
          Keluar
        </button>
      </header>
      {pesan && <p className="text-sm">{pesan}</p>}

      <section className="space-y-2">
        <h2 className="font-medium">Kuota per slot (jumlah kelompok)</h2>
        <p className={`text-sm ${totalKuota < jmlKelompok ? "text-amber-600" : "text-zinc-500"}`}>
          Total kuota {totalKuota} untuk {jmlKelompok} kelompok
          {totalKuota < jmlKelompok && ": kuota belum cukup untuk semua kelompok."}
        </p>
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
                    const s = slots.find((x) => x.hari === h + 1 && x.shift === i + 1);
                    return (
                      <td key={h} className="p-1 text-center">
                        {s && (
                          <>
                            <input
                              key={`${s.id}-${s.kuota}`}
                              type="number"
                              min={0}
                              defaultValue={s.kuota}
                              onBlur={(e) => +e.target.value !== s.kuota && simpanKuota(s.id, +e.target.value)}
                              className="w-16 rounded border border-zinc-400 bg-transparent p-1 text-center"
                            />
                            <div className="text-xs text-zinc-500">terisi {s.terisi}</div>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-medium">Tambah atau perbarui mahasiswa</h2>
        <p className="text-sm text-zinc-500">
          Satu baris per mahasiswa: nim,nama,kelas,nomor kelompok,ketua (1 = ketua, 0 = anggota)
        </p>
        <textarea
          rows={8}
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder={"1101230001,Budi Santoso,TE-45-01,1,1\n1101230002,Siti Aminah,TE-45-01,1,0"}
          className="w-full rounded border border-zinc-400 bg-transparent p-2 font-mono text-sm"
        />
        <button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={impor}>Simpan mahasiswa</button>
      </section>
    </main>
  );
}
