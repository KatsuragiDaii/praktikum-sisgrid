"use client";
import { useMemo, useState } from "react";
import { bacaFile, buatPassword, type BarisImpor, type HasilImpor, type KelasFile } from "@/lib/impor";
import { hurufKelompok } from "@/lib/kelompok";

type Props = {
  nimAda: Set<string>; // NIM yang sudah ada di sistem
  nimBerakun: Set<string>; // NIM yang sudah punya akun login
  simpan: (baris: BarisImpor[]) => Promise<HasilImpor>;
  tampilkan: (teks: string, ok?: boolean) => void;
};

type Kredensial = { kelas: string; label: string; nama: string; nim: string; password: string; ok: boolean; pesan?: string };

const chip = "px-2 py-0.5 rounded-full text-[10px] font-bold border";

export default function ImporFile({ nimAda, nimBerakun, simpan, tampilkan }: Props) {
  const [tahap, setTahap] = useState<"pilih" | "pratinjau" | "menyimpan" | "selesai">("pilih");
  const [namaFile, setNamaFile] = useState("");
  const [data, setData] = useState<KelasFile[]>([]);
  const [buatAkun, setBuatAkun] = useState(true);
  const [membaca, setMembaca] = useState(false);
  const [seret, setSeret] = useState(false);
  const [hasil, setHasil] = useState<{ ringkas: string; ok: boolean; akun: Kredensial[] } | null>(null);

  async function pilihFile(file: File) {
    setMembaca(true);
    try {
      const d = await bacaFile(file);
      if (!d.some((k) => k.kelompok.length > 0)) {
        throw new Error('Tidak ada data praktikan yang terbaca. Pastikan ada kolom "NAMA", "NIM", dan "KELOMPOK".');
      }
      setData(d);
      setNamaFile(file.name);
      setTahap("pratinjau");
    } catch (e) {
      tampilkan((e as Error).message || "File tidak bisa dibaca.", false);
    } finally {
      setMembaca(false);
    }
  }

  const analisis = useMemo(() => {
    const aktif = data.filter((k) => !k.dilewati);
    const galat: string[] = [];
    const nimKe = new Map<string, string>();
    const kelasDipakai = new Set<string>();
    let mhs = 0, kel = 0, baru = 0, ada = 0;
    for (const k of aktif) {
      const nama = k.kelas.trim();
      for (const m of k.masalah) if (m.galat) galat.push(`${nama || k.sheet}: ${m.teks}`);
      if (!nama) galat.push(`Tab "${k.sheet}": nama kelas masih kosong.`);
      else if (kelasDipakai.has(nama.toUpperCase())) galat.push(`Nama kelas "${nama}" dipakai lebih dari satu tab.`);
      kelasDipakai.add(nama.toUpperCase());
      for (const g of k.kelompok) {
        kel++;
        for (const a of g.anggota) {
          mhs++;
          if (nimAda.has(a.nim)) ada++;
          else baru++;
          const lain = nimKe.get(a.nim);
          if (lain) galat.push(`NIM ${a.nim} (${a.nama}) muncul di dua kelas: ${lain} dan ${nama || k.sheet}.`);
          else nimKe.set(a.nim, nama || k.sheet);
        }
      }
    }
    return { aktif, galat, mhs, kel, baru, ada, dilewati: data.filter((k) => k.dilewati) };
  }, [data, nimAda]);

  function ubahKelas(ci: number, nama: string) {
    setData((d) => d.map((k, i) => (i === ci ? { ...k, kelas: nama } : k)));
  }
  function ubahKetua(ci: number, gi: number, nim: string) {
    setData((d) =>
      d.map((k, i) => (i !== ci ? k : { ...k, kelompok: k.kelompok.map((g, j) => (j === gi ? { ...g, ketuaNim: nim } : g)) }))
    );
  }

  async function simpanSemua() {
    setTahap("menyimpan");
    const baris: BarisImpor[] = [];
    for (const k of analisis.aktif) {
      for (const g of k.kelompok) {
        for (const a of g.anggota) {
          const ketua = a.nim === g.ketuaNim;
          // Ketua yang sudah punya akun dilewati supaya password yang sudah mereka ganti tidak ter-reset
          const password = ketua && buatAkun && !nimBerakun.has(a.nim) ? buatPassword() : undefined;
          baris.push({ nim: a.nim, nama: a.nama, kelas: k.kelas.trim(), klp: g.klp, ketua, password });
        }
      }
    }
    try {
      const h = await simpan(baris);
      const akun: Kredensial[] = baris
        .filter((b) => b.password)
        .map((b) => {
          const st = h.akun.find((x) => x.nim === b.nim);
          return { kelas: b.kelas, label: hurufKelompok(b.klp), nama: b.nama, nim: b.nim, password: b.password!, ok: !!st?.ok, pesan: st?.pesan };
        });
      const gagal = akun.filter((a) => !a.ok).length;
      setHasil({
        ringkas: `${h.jmlMahasiswa} mahasiswa tersimpan` + (akun.length ? `, ${akun.length - gagal} akun ketua dibuat.` : "."),
        ok: gagal === 0,
        akun,
      });
      setTahap("selesai");
    } catch (e) {
      tampilkan((e as Error).message, false);
      setTahap("pratinjau");
    }
  }

  function unduhAkun() {
    if (!hasil) return;
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const baris = [["kelas", "kelompok", "nama_ketua", "username", "password"]]
      .concat(hasil.akun.filter((a) => a.ok).map((a) => [a.kelas, a.label, a.nama, a.nim, a.password]))
      .map((r) => r.map(esc).join(","))
      .join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + baris], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "akun-ketua.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function ulang() {
    setData([]);
    setHasil(null);
    setNamaFile("");
    setTahap("pilih");
  }

  // ---------- Tampilan ----------
  if (tahap === "pilih") {
    return (
      <div>
        <label
          onDragOver={(e) => { e.preventDefault(); setSeret(true); }}
          onDragLeave={() => setSeret(false)}
          onDrop={(e) => {
            e.preventDefault();
            setSeret(false);
            const f = e.dataTransfer.files?.[0];
            if (f) pilihFile(f);
          }}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-[#23424A] ${
            seret ? "border-[#23424A] bg-[#23424A]/5" : "border-gray-300 bg-gray-50 hover:border-[#23424A]"
          }`}
        >
          <input
            type="file"
            accept=".xlsx,.csv,.tsv,.txt"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) pilihFile(f);
            }}
          />
          <svg className="w-9 h-9 text-[#23424A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
          </svg>
          <span className="font-bold text-[#0a1e2b]">{membaca ? "Membaca file..." : "Pilih file Excel/CSV, atau seret ke sini"}</span>
          <span className="text-xs text-gray-500">.xlsx (semua tab dibaca) atau .csv</span>
        </label>
        <ul className="mt-4 text-xs text-gray-600 font-medium space-y-1 list-disc pl-5">
          <li>Kolom yang dibaca: NO, NAMA, NIM, ANGKATAN, KELOMPOK (urutan bebas, judul kolom harus ada).</li>
          <li>Huruf kelompok cukup di baris pertama tiap kelompok (sel boleh digabung). Nama paling atas di kelompok menjadi ketua, dan bisa diganti di pratinjau.</li>
          <li>Nama kelas dibaca dari judul seperti &quot;DAFTAR PRAKTIKAN EL-48-01&quot; dan bisa diubah di pratinjau. Huruf kelompok (A, B, C, ...) dipakai langsung sebagai nama kelompok.</li>
        </ul>
      </div>
    );
  }

  if (tahap === "selesai" && hasil) {
    const ok = hasil.akun.filter((a) => a.ok);
    const gagal = hasil.akun.filter((a) => !a.ok);
    return (
      <div className="space-y-4">
        <div className={`rounded-xl border p-4 text-sm font-bold ${hasil.ok ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`}>
          {hasil.ringkas}
          {gagal.length > 0 && ` ${gagal.length} akun gagal dibuat, lihat daftar di bawah.`}
        </div>

        {hasil.akun.length > 0 && (
          <>
            <p className="text-xs font-semibold text-red-600">
              Password hanya tampil di sini. Unduh dan simpan sekarang. Kalau terlewat, gunakan tombol Reset di daftar kelompok untuk membuat yang baru.
            </p>
            <div className="border border-gray-200 rounded-xl overflow-auto max-h-80">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="sticky top-0 bg-gray-100 text-gray-700">
                  <tr>
                    <th className="py-2 px-4 font-bold">Kelas</th>
                    <th className="py-2 px-4 font-bold">Kelompok</th>
                    <th className="py-2 px-4 font-bold w-full">Ketua</th>
                    <th className="py-2 px-4 font-bold">Username</th>
                    <th className="py-2 px-4 font-bold">Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {hasil.akun.map((a) => (
                    <tr key={a.nim}>
                      <td className="py-2 px-4 text-gray-600">{a.kelas}</td>
                      <td className="py-2 px-4 font-semibold">{a.label}</td>
                      <td className="py-2 px-4 font-bold text-gray-800">{a.nama}</td>
                      <td className="py-2 px-4 font-mono">{a.nim}</td>
                      <td className="py-2 px-4 font-mono font-bold">
                        {a.ok ? a.password : <span className="text-red-600 font-sans text-xs">Gagal: {a.pesan ?? "tidak diketahui"}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="flex flex-wrap justify-end gap-3">
          {ok.length > 0 && (
            <button onClick={unduhAkun} className="bg-[#23424A] hover:bg-[#162b31] text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm">
              Unduh akun-ketua.csv
            </button>
          )}
          <button onClick={ulang} className="border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-2.5 px-6 rounded-lg transition-colors">
            Selesai
          </button>
        </div>
      </div>
    );
  }

  const diblokir = analisis.galat.length > 0 || analisis.kel === 0;
  const butuhAkun = analisis.aktif.some((k) => k.kelompok.some((g) => g.ketuaNim && !nimBerakun.has(g.ketuaNim)));
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-gray-600">
          <span className="font-bold text-gray-800">{namaFile}</span>: {analisis.aktif.length} kelas, {analisis.kel} kelompok, {analisis.mhs} mahasiswa
          {" "}({analisis.baru} baru{analisis.ada > 0 ? `, ${analisis.ada} sudah ada dan akan diperbarui` : ""})
        </p>
        <button onClick={ulang} disabled={tahap === "menyimpan"} className={`text-xs font-bold text-gray-500 hover:text-[#23424A] underline underline-offset-2`}>
          Pilih file lain
        </button>
      </div>

      {analisis.galat.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-bold mb-1">Perbaiki dulu sebelum menyimpan:</p>
          <ul className="list-disc pl-5 space-y-0.5 font-medium">
            {analisis.galat.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </div>
      )}

      {analisis.dilewati.map((k) => (
        <p key={k.sheet} className="text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          Tab &quot;{k.sheet}&quot; dilewati: {k.masalah[0]?.teks}
        </p>
      ))}

      <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {data.map((k, ci) =>
          k.dilewati ? null : (
            <details key={ci} open={data.length <= 3 || k.masalah.length > 0} className="border border-gray-200 rounded-xl bg-white group">
              <summary className="cursor-pointer select-none px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span className="font-extrabold text-[#0a1e2b]">{k.kelas || k.sheet}</span>
                <span className="text-xs font-medium text-gray-500">
                  {k.kelompok.length} kelompok, {k.kelompok.reduce((a, g) => a + g.anggota.length, 0)} mahasiswa
                </span>
                {k.masalah.some((m) => !m.galat) && <span className={`${chip} bg-amber-50 text-amber-700 border-amber-200`}>ada peringatan</span>}
              </summary>
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                  Nama kelas di sistem
                  <input
                    value={k.kelas}
                    onChange={(e) => ubahKelas(ci, e.target.value)}
                    className="rounded-lg border border-gray-300 bg-gray-50 py-1.5 px-3 text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#23424A] focus:bg-white"
                  />
                </label>
                {k.masalah.filter((m) => !m.galat).map((m, i) => (
                  <p key={i} className="text-xs font-medium text-amber-700">{m.teks}</p>
                ))}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {k.kelompok.map((g, gi) => (
                    <fieldset key={g.label} className="border border-gray-200 rounded-lg p-3">
                      <legend className="px-1 text-xs font-extrabold text-[#23424A]">
                        Kelompok {g.klp ? hurufKelompok(g.klp) : g.label}
                        <span className={`${chip} ml-2 ${g.anggota.length >= 2 && g.anggota.length <= 6 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                          {g.anggota.length} orang
                        </span>
                      </legend>
                      <ul className="space-y-1">
                        {g.anggota.map((a) => {
                          const ketua = a.nim === g.ketuaNim;
                          return (
                            <li key={a.nim}>
                              <label className={`flex items-center gap-2 rounded-md px-2 py-1 cursor-pointer text-sm ${ketua ? "bg-[#23424A]/5" : "hover:bg-gray-50"}`}>
                                <input
                                  type="radio"
                                  name={`ketua-${ci}-${gi}`}
                                  checked={ketua}
                                  onChange={() => ubahKetua(ci, gi, a.nim)}
                                  className="accent-[#23424A]"
                                  aria-label={`Jadikan ${a.nama} ketua`}
                                />
                                <span className={`flex-1 min-w-0 truncate ${ketua ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>{a.nama}</span>
                                <span className="font-mono text-[11px] text-gray-400">{a.nim}</span>
                                {ketua && <span className={`${chip} bg-blue-50 text-blue-700 border-blue-200`}>Ketua</span>}
                                {ketua && nimBerakun.has(a.nim) && <span className={`${chip} bg-gray-100 text-gray-500 border-gray-200`}>akun sudah ada</span>}
                                {!ketua && nimAda.has(a.nim) && <span className={`${chip} bg-gray-100 text-gray-500 border-gray-200`}>sudah ada</span>}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </fieldset>
                  ))}
                </div>
              </div>
            </details>
          )
        )}
      </div>

      <label className="flex items-start gap-2 text-sm font-medium text-gray-700 cursor-pointer">
        <input type="checkbox" checked={buatAkun} onChange={(e) => setBuatAkun(e.target.checked)} className="mt-1 accent-[#23424A]" />
        <span>
          Buatkan akun login untuk ketua dengan password acak. Username-nya NIM.
          {buatAkun && !butuhAkun && <span className="text-gray-500"> Semua ketua di file ini sudah punya akun, password mereka tidak diubah.</span>}
          {buatAkun && butuhAkun && <span className="text-gray-500"> Ketua yang sudah punya akun dilewati, password mereka tidak diubah.</span>}
        </span>
      </label>

      <div className="flex justify-end">
        <button
          onClick={simpanSemua}
          disabled={diblokir || tahap === "menyimpan"}
          className="bg-[#23424A] hover:bg-[#162b31] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-2.5 px-6 rounded-lg transition-colors shadow-sm"
        >
          {tahap === "menyimpan" ? "Menyimpan..." : `Simpan ${analisis.mhs} Mahasiswa`}
        </button>
      </div>
    </div>
  );
}
