"use client";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { supabase, HARI } from "@/lib/supabase";
import { Toast, useNotif } from "@/components/admin/Toast";
import ImporFile from "@/components/admin/ImporFile";
import ModalKonfirmasi, { type TombolModal } from "@/components/admin/ModalKonfirmasi";
import type { BarisImpor, HasilImpor } from "@/lib/impor";
import { hurufKelompok, nomorKelompok } from "@/lib/kelompok";

type Mhs = { nim: string; nama: string; is_ketua: boolean; user_id: string | null; kelompok_id: number | null };
type Klp = { id: number; nomor: number; kelas: string; anggota: Mhs[]; jadwal: string | null };

type HasilHapus = { kelompok: boolean; mahasiswa: number; akun: number; lepas: number; gagal: { nim: string; pesan: string }[] };
type Hapus = { jenis: "kelompok"; k: Klp } | { jenis: "mhs"; m: Mhs; k: Klp | null };

// Pesan galat database yang paling sering muncul, diterjemahkan agar mudah dipahami
function pesanGalat(msg: string) {
  if (msg.includes("satu_ketua_per_kelompok"))
    return "Kelompok itu sudah punya ketua lain. Untuk menggantinya, pakai tombol Jadikan Ketua di daftar kelompok.";
  return msg;
}

// Sel tabel: berjarak di tabel (>= 1280px), tanpa jarak sendiri saat menjadi kartu.
const sel = "py-3 px-4 max-xl:p-0";

const tombolBahaya =
  "max-xl:py-2.5 max-xl:px-2 text-red-600 hover:text-red-800 font-bold text-xs underline decoration-red-200 hover:decoration-red-600 underline-offset-2 transition-colors cursor-pointer";
const tombolTeks =
  "max-xl:py-2.5 max-xl:px-2 text-gray-500 hover:text-[#23424A] font-bold text-xs underline decoration-gray-300 hover:decoration-[#23424A] underline-offset-2 transition-colors cursor-pointer";

export default function KelompokPage() {
  const { notif, tampilkan } = useNotif();
  const [klp, setKlp] = useState<Klp[]>([]);
  const [tanpaKelompok, setTanpaKelompok] = useState<Mhs[]>([]);
  const [semua, setSemua] = useState<Mhs[]>([]);
  const [mode, setMode] = useState<"file" | "teks">("file");
  const [teks, setTeks] = useState("");
  const [menyimpan, setMenyimpan] = useState(false);
  const [cari, setCari] = useState("");
  const [fKelas, setFKelas] = useState("");
  const [fStatus, setFStatus] = useState<"" | "terdaftar" | "belum">("");
  const [terbuka, setTerbuka] = useState<number | null>(null);
  const [hapus, setHapus] = useState<Hapus | null>(null);
  const [menghapus, setMenghapus] = useState(false);
  const [resetAkun, setResetAkun] = useState<{ nim: string; nama: string } | null>(null);
  const [pwBaru, setPwBaru] = useState("");
  const [menyimpanPw, setMenyimpanPw] = useState(false);
  const [calonKetua, setCalonKetua] = useState<{ nim: string; nama: string } | null>(null);
  const [menyimpanKetua, setMenyimpanKetua] = useState(false);

  const muat = useCallback(async () => {
    const [k, m, p] = await Promise.all([
      supabase.from("kelompok").select("id,nomor,kelas(nama)"),
      supabase.from("mahasiswa").select("nim,nama,is_ketua,user_id,kelompok_id").eq("is_admin", false).order("nim"),
      supabase.from("pendaftaran").select("kelompok_id,slot(hari,shift)"),
    ]);
    const galat = k.error ?? m.error ?? p.error;
    if (galat) return tampilkan(galat.message, false);

    const mhs = (m.data ?? []) as Mhs[];
    const jadwalPer = new Map<number, string>();
    for (const r of (p.data ?? []) as unknown as { kelompok_id: number; slot: { hari: number; shift: number } | null }[]) {
      if (r.slot) jadwalPer.set(r.kelompok_id, `${HARI[r.slot.hari - 1]}, Shift ${r.slot.shift}`);
    }
    const daftar = ((k.data ?? []) as unknown as { id: number; nomor: number; kelas: { nama: string } }[])
      .map((x) => ({
        id: x.id,
        nomor: x.nomor,
        kelas: x.kelas.nama,
        anggota: mhs.filter((a) => a.kelompok_id === x.id),
        jadwal: jadwalPer.get(x.id) ?? null,
      }))
      .sort((a, b) => a.kelas.localeCompare(b.kelas, "id", { numeric: true }) || a.nomor - b.nomor);

    setKlp(daftar);
    setTanpaKelompok(mhs.filter((a) => a.kelompok_id === null));
    setSemua(mhs);
  }, [tampilkan]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- memuat data awal dari Supabase
    muat();
  }, [muat]);

  // Membuat akun ketua / mengganti password lewat API server (memakai kunci rahasia)
  async function kirimAkun(akun: { nim: string; password: string }[]) {
    const { data: { session } } = await supabase.auth.getSession();
    const hasil: { nim: string; ok: boolean; pesan?: string }[] = [];
    for (let i = 0; i < akun.length; i += 25) {
      const res = await fetch("/api/admin/akun", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ akun: akun.slice(i, i + 25) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Gagal menghubungi server");
      hasil.push(...j.hasil);
    }
    return hasil;
  }

  async function jalankanReset(e: React.FormEvent) {
    e.preventDefault();
    if (!resetAkun || pwBaru.length < 8) return;
    setMenyimpanPw(true);
    try {
      const [h] = await kirimAkun([{ nim: resetAkun.nim, password: pwBaru }]);
      if (h.ok) tampilkan(`Akun ${resetAkun.nim} siap. Password sudah diatur.`);
      else tampilkan(`${resetAkun.nim}: ${h.pesan}`, false);
    } catch (e) {
      tampilkan((e as Error).message, false);
    }
    setMenyimpanPw(false);
    setResetAkun(null);
    setPwBaru("");
    muat();
  }

  async function jalankanJadikanKetua() {
    if (!calonKetua) return;
    setMenyimpanKetua(true);
    const { error } = await supabase.rpc("jadikan_ketua", { p_nim: calonKetua.nim });
    if (error) {
      tampilkan(error.message, false);
    } else {
      tampilkan(`${calonKetua.nama} sekarang menjadi ketua kelompoknya.`);
    }
    setMenyimpanKetua(false);
    setCalonKetua(null);
    muat();
  }

// Penghapusan lewat API server karena akun login ikut dihapus (butuh kunci rahasia)
  async function panggilHapus(body: object): Promise<HasilHapus> {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch("/api/admin/hapus", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify(body),
    });

    // --- PERBAIKAN DI SINI ---
    // Jangan langsung parse JSON, baca sebagai text dulu untuk mencegah error "Unexpected end of JSON input"
    const text = await res.text();
    let j = {} as HasilHapus & { error?: string };
    
    try {
      j = text ? JSON.parse(text) : {};
    } catch {
      console.error("Gagal parse respons JSON:", text);
    }

    if (!res.ok) throw new Error(j.error ?? "Gagal menghubungi server");
    // -------------------------

    return j;
  }

  async function jalankanHapus(mode: "hapus" | "lepas" = "hapus") {
    if (!hapus) return;
    setMenghapus(true);
    try {
      if (hapus.jenis === "mhs") {
        const h = await panggilHapus({ aksi: "mahasiswa", nim: [hapus.m.nim] });
        if (h.gagal.length) throw new Error(`${hapus.m.nama}: ${h.gagal[0].pesan}`);
        tampilkan(`${hapus.m.nama} dihapus${h.akun ? ", akun login-nya ikut dihapus" : ""}.`);
      } else {
        const { k } = hapus;
        const nama = `Kelompok ${hurufKelompok(k.nomor)} (${k.kelas})`;
        const h = await panggilHapus({ aksi: "kelompok", id: k.id, mahasiswa: mode });
        if (!h.kelompok) throw new Error(`${nama} belum dihapus. ${h.gagal.map((g) => `${g.nim}: ${g.pesan}`).join("; ")}`);
        if (terbuka === k.id) setTerbuka(null);
        tampilkan(
          mode === "hapus"
            ? `${nama} dihapus bersama ${h.mahasiswa} mahasiswa${h.akun ? ` dan ${h.akun} akun login` : ""}.`
            : `${nama} dihapus. ${h.lepas} mahasiswa dilepas dari kelompok dan masih tersimpan.`
        );
      }
    } catch (e) {
      tampilkan((e as Error).message, false);
    }
    setHapus(null);
    await muat().catch(() => {});
    setMenghapus(false);
  }

  // Menyimpan mahasiswa (kelas, kelompok, ketua) lalu membuat akun ketua. Dipakai form teks dan unggah file.
  async function simpanBaris(baris: BarisImpor[]): Promise<HasilImpor> {
    const ok = (r: { error: { message: string } | null }) => {
      if (r.error) throw new Error(pesanGalat(r.error.message));
    };

    const nimTerlihat = new Set<string>();
    for (const b of baris) {
      if (nimTerlihat.has(b.nim)) throw new Error(`NIM ${b.nim} muncul lebih dari sekali.`);
      nimTerlihat.add(b.nim);
    }
    const ketuaPer = new Map<string, { kelas: string; klp: number; n: number }>();
    for (const b of baris) {
      if (b.ketua) {
        const key = `${b.kelas}|${b.klp}`;
        ketuaPer.set(key, { kelas: b.kelas, klp: b.klp, n: (ketuaPer.get(key)?.n ?? 0) + 1 });
      }
    }
    const ganda = [...ketuaPer.values()].find((x) => x.n > 1);
    if (ganda) throw new Error(`Kelompok ${hurufKelompok(ganda.klp)} di ${ganda.kelas} punya lebih dari satu ketua di data.`);

    ok(await supabase.from("kelas").upsert([...new Set(baris.map((b) => b.kelas))].map((nama) => ({ nama })), { onConflict: "nama" }));
    const kls = (await supabase.from("kelas").select("id,nama")).data ?? [];
    const idKelas = Object.fromEntries(kls.map((k) => [k.nama, k.id]));
    const kel = [...new Map(baris.map((b) => [`${b.kelas}|${b.klp}`, { kelas_id: idKelas[b.kelas], nomor: b.klp }])).values()];
    ok(await supabase.from("kelompok").upsert(kel, { onConflict: "kelas_id,nomor" }));
    const kps = (await supabase.from("kelompok").select("id,kelas_id,nomor")).data ?? [];
    const idKel = Object.fromEntries(kps.map((k) => [`${k.kelas_id}|${k.nomor}`, k.id]));
    const mhs = baris.map((b) => ({
      nim: b.nim,
      nama: b.nama,
      kelompok_id: idKel[`${idKelas[b.kelas]}|${b.klp}`],
      is_ketua: b.ketua,
    }));
    ok(await supabase.from("mahasiswa").upsert(mhs, { onConflict: "nim" }));

    // Akun hanya dibuat untuk ketua
    const akun = baris.filter((b) => b.ketua && b.password).map((b) => ({ nim: b.nim, password: b.password as string }));
    const hasil = akun.length ? await kirimAkun(akun) : [];
    // Muat ulang daftar; kegagalan di sini tidak boleh menghilangkan hasil (password ketua hanya tampil sekali)
    await muat().catch(() => {});
    return { jmlMahasiswa: mhs.length, akun: hasil };
  }

  // Form teks. Format tiap baris: nim, nama, kelas, nomor kelompok, ketua (1/0), password (khusus ketua)
  async function impor() {
    setMenyimpan(true);
    try {
      const mentah = teks
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => l.split(",").map((x) => x.trim()));
      if (!mentah.length) throw new Error("Data masih kosong.");

      const salah = mentah.findIndex(
        (b) => b.length < 4 || !b[0] || !b[1] || !b[2] || nomorKelompok(b[3]) === null
      );
      if (salah >= 0) throw new Error(`Baris ${salah + 1} tidak valid. Isi minimal: nim, nama, kelas, kelompok (huruf A, B, C, ...).`);

      const baris: BarisImpor[] = mentah.map((b) => ({
        nim: b[0].toLowerCase(),
        nama: b[1],
        kelas: b[2],
        klp: nomorKelompok(b[3]) as number,
        ketua: b[4] === "1",
        password: b[4] === "1" && b[5] ? b[5] : undefined,
      }));
      const diabaikan = mentah.filter((b) => b[4] !== "1" && b[5]).length;
      const h = await simpanBaris(baris);
      const gagal = h.akun.filter((x) => !x.ok);

      let ringkas = `${h.jmlMahasiswa} mahasiswa tersimpan`;
      if (h.akun.length) ringkas += `, ${h.akun.length - gagal.length} akun ketua dibuat/diperbarui`;
      ringkas += ".";
      if (diabaikan) ringkas += ` ${diabaikan} password anggota diabaikan (hanya ketua yang punya akun).`;
      if (gagal.length) ringkas += ` Akun gagal: ${gagal.map((g) => `${g.nim} (${g.pesan})`).join("; ")}`;
      tampilkan(ringkas, gagal.length === 0);
      setTeks("");
    } catch (e) {
      tampilkan((e as Error).message, false);
    } finally {
      setMenyimpan(false);
    }
  }

  const nimAda = useMemo(() => new Set(semua.map((a) => a.nim)), [semua]);
  const nimBerakun = useMemo(() => new Set(semua.filter((a) => a.user_id).map((a) => a.nim)), [semua]);

  const kelasList = useMemo(() => [...new Set(klp.map((k) => k.kelas))], [klp]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return klp.filter((k) => {
      if (fKelas && k.kelas !== fKelas) return false;
      if (fStatus === "terdaftar" && !k.jadwal) return false;
      if (fStatus === "belum" && k.jadwal) return false;
      if (!q) return true;
      const isi = `${k.kelas} kelompok ${hurufKelompok(k.nomor)} ${k.anggota.map((a) => `${a.nim} ${a.nama}`).join(" ")}`;
      return isi.toLowerCase().includes(q);
    });
  }, [klp, cari, fKelas, fStatus]);

  const jmlMahasiswa = klp.reduce((a, k) => a + k.anggota.length, 0);
  const jmlTerdaftar = klp.filter((k) => k.jadwal).length;
  const kartu = "bg-white rounded-2xl border border-gray-200 p-4 sm:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]";
  const kontrol =
    "rounded-lg border border-gray-300 bg-gray-50 py-2.5 px-3 text-base lg:text-sm text-gray-800 focus:outline-none focus:border-[#23424A] focus:bg-white transition-colors cursor-pointer";

  return (
    <>
      <Toast notif={notif} />

      {/* IMPORT: tambah mahasiswa dan akun ketua */}
      <div className={kartu}>
        <div className="flex items-center gap-3 mb-6">
          {/* Ikon person-plus-fill dari Bootstrap */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="w-7 h-7 sm:w-8 sm:h-8 text-[#23424A] shrink-0" viewBox="0 0 16 16">
            <path d="M1 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1H1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"/>
            <path fillRule="evenodd" d="M13.5 5a.5.5 0 0 1 .5.5V7h1.5a.5.5 0 0 1 0 1H14v1.5a.5.5 0 0 1-1 0V8h-1.5a.5.5 0 0 1 0-1H13V5.5a.5.5 0 0 1 .5-.5z"/>
          </svg>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#0a1e2b]">Tambah Mahasiswa dan Akun Ketua</h2>
        </div>
        <div role="tablist" aria-label="Cara menambah mahasiswa" className="flex sm:inline-flex rounded-lg bg-gray-100 p-1 mb-5 text-sm font-bold">
          {([["file", "Unggah Excel/CSV"], ["teks", "Ketik manual"]] as const).map(([m, label]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`flex-1 sm:flex-none px-4 py-2.5 sm:py-1.5 rounded-md transition-colors cursor-pointer ${mode === m ? "bg-white text-[#23424A] shadow-sm" : "text-gray-500 hover:text-[#23424A]"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {mode === "file" ? (
          <ImporFile nimAda={nimAda} nimBerakun={nimBerakun} simpan={simpanBaris} tampilkan={tampilkan} />
        ) : (
          <>
            <p className="text-sm font-medium text-gray-600 mb-4 leading-relaxed">
              Satu baris per mahasiswa, pisahkan dengan koma:{" "}
              <code className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded font-mono break-words">nim, nama, kelas, kelompok, ketua(1/0), password</code>
              <br />
              <span className="text-gray-500 text-xs">
                Contoh: 1101230001, Budi, TE-45, A, 1, sandi12345. Kelompok ditulis dengan huruf (A, B, C, ...). Password hanya diisi untuk ketua (minimal 8 karakter, tanpa koma).
                Memasukkan NIM yang sudah ada akan memindahkannya ke kelompok yang ditulis.
              </span>
            </p>
            <textarea
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              placeholder="Masukkan data CSV di sini..."
              rows={6}
              className="w-full min-h-[140px] rounded-xl border border-gray-300 bg-gray-50 p-3 sm:p-4 font-mono text-base lg:text-sm text-gray-800 focus:outline-none focus:border-[#23424A] focus:bg-white transition-colors resize-y"
            />
            <div className="mt-4 flex sm:justify-end">
              <button
                onClick={impor}
                disabled={menyimpan || !teks.trim()}
                className="w-full sm:w-auto bg-[#23424A] hover:bg-[#162b31] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 sm:py-2.5 px-6 rounded-lg transition-colors shadow-sm"
              >
                {menyimpan ? "Menyimpan..." : "Simpan Data"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* DAFTAR KELOMPOK */}
      <div className={kartu}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {/* Ikon 2 Orang dari Bootstrap */}
            <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="w-7 h-7 sm:w-8 sm:h-8 text-[#23424A] shrink-0" viewBox="0 0 16 16">
              <path d="M7 14s-1 0-1-1 1-4 5-4 5 3 5 4-1 1-1 1H7Zm4-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.784 6A2.238 2.238 0 0 1 5 13c0-1.355.68-2.75 1.936-3.72A6.325 6.325 0 0 0 5 9c-4 0-5 3-5 4s1 1 1 1h4.216ZM4.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"/>
            </svg>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-[#0a1e2b]">
                Daftar Kelompok <span className="text-gray-400 text-lg font-bold ml-1">({klp.length})</span>
              </h2>
              <p className="text-xs font-medium text-gray-500">
                {jmlMahasiswa} mahasiswa, {jmlTerdaftar} kelompok sudah memilih jadwal
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select value={fKelas} onChange={(e) => setFKelas(e.target.value)} className={kontrol} aria-label="Filter kelas">
              <option value="">Semua kelas</option>
              {kelasList.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className={kontrol} aria-label="Filter status jadwal">
              <option value="">Semua status</option>
              <option value="terdaftar">Sudah memilih jadwal</option>
              <option value="belum">Belum memilih jadwal</option>
            </select>
            <div className="relative sm:w-64">
              <input
                value={cari}
                onChange={(e) => setCari(e.target.value)}
                placeholder="Cari NIM, nama, kelas..."
                className={`${kontrol} w-full pr-10`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Layar >= 1280px: tabel. HP dan tablet: setiap kelompok menjadi satu kartu supaya tidak perlu menggeser ke samping. */}
        <div className="xl:border xl:border-gray-200 xl:rounded-xl xl:overflow-hidden">
          <div className="xl:overflow-auto xl:max-h-[560px]">
            <table className="block xl:table w-full text-left text-sm xl:whitespace-nowrap">
              <thead className="hidden xl:table-header-group sticky top-0 bg-gray-100 text-gray-700 shadow-sm z-10">
                <tr>
                  <th className="py-3 px-4 font-bold border-b border-gray-200">Kelas</th>
                  <th className="py-3 px-4 font-bold border-b border-gray-200">Kelompok</th>
                  <th className="py-3 px-4 font-bold border-b border-gray-200 w-full">Ketua</th>
                  <th className="py-3 px-4 font-bold border-b border-gray-200 text-center">Anggota</th>
                  <th className="py-3 px-4 font-bold border-b border-gray-200">Jadwal</th>
                  <th className="py-3 px-4 font-bold border-b border-gray-200 text-center">Akun ketua</th>
                  <th className="py-3 px-4 border-b border-gray-200"><span className="sr-only">Detail</span></th>
                </tr>
              </thead>
              <tbody className="max-xl:flex max-xl:flex-col max-xl:gap-3 divide-y divide-gray-100 max-xl:divide-y-0 bg-white">
                {tampil.length === 0 ? (
                  <tr className="max-xl:block">
                    <td colSpan={7} className="py-8 text-center text-gray-400 font-medium italic max-xl:block">
                      {klp.length === 0 ? "Belum ada kelompok. Tambahkan mahasiswa lewat form di atas." : "Tidak ada kelompok yang cocok."}
                    </td>
                  </tr>
                ) : (
                  tampil.map((k) => {
                    const ketua = k.anggota.find((a) => a.is_ketua);
                    const n = k.anggota.length;
                    const buka = terbuka === k.id;
                    const huruf = hurufKelompok(k.nomor);
                    return (
                      <Fragment key={k.id}>
                        <tr
                          className={`hover:bg-gray-50 transition-colors max-xl:flex max-xl:flex-wrap max-xl:items-center max-xl:gap-x-3 max-xl:gap-y-1 max-xl:rounded-xl max-xl:border max-xl:border-gray-200 max-xl:bg-white max-xl:p-4 ${
                            buka ? "max-xl:rounded-b-none max-xl:border-b-0" : ""
                          }`}
                        >
                          <td className={`${sel} max-xl:order-1 max-xl:font-bold max-xl:text-gray-800 text-gray-600 font-medium`}>{k.kelas}</td>
                          <td className={`${sel} max-xl:order-2`}>
                            <span className="bg-gray-100 text-gray-700 font-bold px-2.5 py-1 rounded border border-gray-200">{huruf}</span>
                          </td>
                          <td className={`${sel} max-xl:order-4 max-xl:basis-full max-xl:mt-1`}>
                            <span className="xl:hidden mr-2 text-xs font-semibold text-gray-400">Ketua</span>
                            {ketua ? (
                              <>
                                <span className="text-gray-800 font-bold">{ketua.nama}</span>
                                <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">{ketua.nim}</span>
                              </>
                            ) : (
                              <span className="text-amber-600 font-semibold text-xs">Belum ada ketua</span>
                            )}
                          </td>
                          <td className={`${sel} max-xl:order-3 max-xl:ml-auto text-center`}>
                            <span
                              title={n >= 2 && n <= 6 ? undefined : "Jumlah anggota harus 2-6 agar kelompok bisa mendaftar"}
                              className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
                                n >= 2 && n <= 6
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-600 border-red-200"
                              }`}
                            >
                              {n} orang
                            </span>
                          </td>
                          <td className={`${sel} max-xl:order-5 max-xl:basis-full sm:max-xl:basis-auto max-xl:mt-1`}>
                            <span className="xl:hidden mr-2 text-xs font-semibold text-gray-400">Jadwal</span>
                            {k.jadwal ? (
                              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold">{k.jadwal}</span>
                            ) : (
                              <span className="text-gray-400 text-xs font-medium">Belum memilih</span>
                            )}
                          </td>
                          <td className={`${sel} max-xl:order-6 max-xl:mt-1 text-center`}>
                            {ketua ? (
                              <div className="flex items-center justify-center max-xl:justify-start gap-2">
                                <span className="xl:hidden mr-0.5 text-xs font-semibold text-gray-400">Akun ketua</span>
                                <div
                                  className={`w-2 h-2 rounded-full ${ketua.user_id ? "bg-emerald-500" : "bg-gray-300"}`}
                                  title={ketua.user_id ? "Akun aktif" : "Belum punya akun"}
                                ></div>
                                <button className={tombolTeks} onClick={() => setResetAkun({ nim: ketua.nim, nama: ketua.nama })}>
                                  {ketua.user_id ? "Reset" : "Buat"}
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-300">-</span>
                            )}
                          </td>
                          <td className={`${sel} max-xl:order-7 max-xl:ml-auto max-xl:mt-1 text-right`}>
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => setHapus({ jenis: "kelompok", k })}
                                aria-label={`Hapus kelompok ${huruf} ${k.kelas}`}
                                title="Hapus kelompok"
                                className="text-gray-400 hover:text-red-600 p-1 max-xl:p-2.5 rounded transition-colors cursor-pointer"
                              >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                              <button
                                onClick={() => setTerbuka(buka ? null : k.id)}
                                aria-expanded={buka}
                                aria-label={`${buka ? "Tutup" : "Lihat"} anggota ${k.kelas} kelompok ${huruf}`}
                                className="text-gray-400 hover:text-[#23424A] p-1 max-xl:p-2.5 rounded transition-colors cursor-pointer"
                              >
                                <svg className={`w-5 h-5 transition-transform ${buka ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                        {buka && (
                          <tr className="bg-gray-50 max-xl:block max-xl:-mt-3 max-xl:rounded-b-xl max-xl:border max-xl:border-t-0 max-xl:border-gray-200">
                            <td colSpan={7} className="px-4 py-3 max-xl:block">
                              {n === 0 ? (
                                <p className="text-xs text-gray-400 italic">Kelompok ini belum punya anggota.</p>
                              ) : (
                                <ul className="divide-y divide-gray-200/70">
                                  {k.anggota.map((a) => (
                                    <li key={a.nim} className="flex flex-wrap items-center gap-x-4 gap-y-0 py-2">
                                      <span className="text-xs font-semibold text-gray-700 w-24 sm:w-32 shrink-0 tracking-wide">{a.nim}</span>
                                      <span className="text-gray-800 font-semibold flex-1 min-w-0 break-words">{a.nama}</span>
                                      <div className="flex items-center justify-end gap-3 max-sm:basis-full">
                                        {a.is_ketua ? (
                                          <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-bold">Ketua</span>
                                        ) : (
                                          <button className={tombolTeks} onClick={() => setCalonKetua({ nim: a.nim, nama: a.nama })}>
                                            Jadikan Ketua
                                          </button>
                                        )}
                                        <button
                                          className={`${tombolBahaya} w-14 text-right cursor-pointer`}
                                          aria-label={`Hapus ${a.nama}`}
                                          onClick={() => setHapus({ jenis: "mhs", m: a, k })}
                                        >
                                          Hapus
                                        </button>
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {tanpaKelompok.length > 0 && (
          <div className="mt-4 text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p>
              {tanpaKelompok.length} mahasiswa belum punya kelompok. Masukkan ulang lewat form di atas untuk menempatkannya, atau hapus jika tidak diperlukan.
            </p>
            <ul className="mt-2 divide-y divide-amber-200/70">
              {tanpaKelompok.map((a) => (
                <li key={a.nim} className="flex flex-wrap items-center gap-x-4 py-1.5">
                  <span className="font-semibold w-24 sm:w-32 shrink-0 tracking-wide">{a.nim}</span>
                  <span className="flex-1 min-w-0 break-words font-semibold text-gray-800">{a.nama}</span>
                  <button className={tombolBahaya} aria-label={`Hapus ${a.nama}`} onClick={() => setHapus({ jenis: "mhs", m: a, k: null })}>
                    Hapus
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {hapus && <DialogHapus hapus={hapus} sibuk={menghapus} onBatal={() => setHapus(null)} onHapus={jalankanHapus} />}
      
      {/* --- MODAL RESET PASSWORD --- */}
      {resetAkun && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm">
         <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-[#23424A] p-6 text-center">
               <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
                 {/* Ikon Key-fill dari Bootstrap Icons */}
                 <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" className="w-8 h-8 text-white" viewBox="0 0 16 16">
                   <path d="M3.5 11.5a3.5 3.5 0 1 1 3.163-5H14L15.5 8 14 9.5l-1-1-1 1-1-1-1 1-1-1-1 1H6.663a3.5 3.5 0 0 1-3.163 2zM2.5 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"/>
                 </svg>
               </div>
               <h3 className="text-xl font-extrabold text-white">Atur Password</h3>
            </div>
            <form onSubmit={jalankanReset} className="p-6 sm:p-8 text-center space-y-5">
              <p className="text-gray-600 font-medium text-sm leading-relaxed">
                Masukkan password baru untuk <strong className="text-gray-800">{resetAkun.nama}</strong> ({resetAkun.nim}).
              </p>
              <div>
                <input
                  type="text"
                  required
                  minLength={8}
                  value={pwBaru}
                  onChange={(e) => setPwBaru(e.target.value)}
                  placeholder="Password (min. 8 karakter)"
                  className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base lg:text-sm font-semibold text-gray-800 focus:outline-none focus:border-[#23424A] focus:ring-1 focus:ring-[#23424A] text-center"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 sm:gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => { setResetAkun(null); setPwBaru(""); }}
                  disabled={menyimpanPw}
                  className="flex-1 py-3 rounded-xl text-gray-600 font-bold border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={menyimpanPw}
                  className="flex-1 py-3 rounded-xl bg-[#23424A] hover:bg-[#152a30] text-white font-bold shadow-md transition-all disabled:opacity-80 flex justify-center items-center cursor-pointer disabled:cursor-not-allowed"
                >
                  {menyimpanPw ? (
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    "Simpan"
                  )}
                </button>
              </div>
            </form>
          </div>
         </div>
        </div>
      )}
      {/* ---------------------------- */}

      {/* --- MODAL JADIKAN KETUA --- */}
      {calonKetua && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 backdrop-blur-sm">
         <div className="flex min-h-full items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden">
            <div className="bg-[#23424A] p-6 text-center">
               <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-white/20">
                 <span className="text-3xl">⭐</span>
               </div>
               <h3 className="text-xl font-extrabold text-white">Jadikan Ketua?</h3>
            </div>
            <div className="p-6 sm:p-8 text-center space-y-4">
              <p className="text-gray-600 font-medium text-sm leading-relaxed">
                Jadikan <strong className="text-gray-800">{calonKetua.nama}</strong> sebagai ketua kelompok ini?
              </p>
              <p className="text-xs text-amber-700 font-semibold bg-amber-50 p-3 rounded-lg border border-amber-200">
                Ketua sebelumnya (jika ada) akan menjadi anggota biasa dan tidak bisa lagi melakukan pendaftaran jadwal.
              </p>
              
              <div className="flex gap-3 sm:gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setCalonKetua(null)}
                  disabled={menyimpanKetua}
                  className="flex-1 py-3 rounded-xl text-gray-600 font-bold border border-gray-300 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={jalankanJadikanKetua}
                  disabled={menyimpanKetua}
                  className="flex-1 py-3 rounded-xl bg-[#23424A] hover:bg-[#152a30] text-white font-bold shadow-md transition-all disabled:opacity-80 flex justify-center items-center cursor-pointer disabled:cursor-not-allowed"
                >
                  {menyimpanKetua ? (
                     <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  ) : (
                    "Jadikan Ketua"
                  )}
                </button>
              </div>
            </div>
          </div>
         </div>
        </div>
      )}
      {/* ---------------------------- */}
    </>
  );
}

// Isi dialog konfirmasi: menjelaskan apa saja yang ikut terhapus sebelum admin menekan tombol merah.
function DialogHapus({
  hapus,
  sibuk,
  onBatal,
  onHapus,
}: {
  hapus: Hapus;
  sibuk: boolean;
  onBatal: () => void;
  onHapus: (mode: "hapus" | "lepas") => void;
}) {
  if (hapus.jenis === "mhs") {
    const { m, k } = hapus;
    const sisa = k ? k.anggota.length - 1 : 0;
    return (
      <ModalKonfirmasi
        judul={`Hapus ${m.nama}?`}
        sibuk={sibuk}
        onBatal={onBatal}
        tombol={[{ label: "Hapus Mahasiswa", gaya: "bahaya", onClick: () => onHapus("hapus") }]}
      >
        <p>
          <span className="font-mono">{m.nim}</span>
          {k ? ` di kelompok ${hurufKelompok(k.nomor)} (${k.kelas})` : " (belum punya kelompok)"} akan dihapus dari sistem.
        </p>
        {m.user_id && <p>Akun login mahasiswa ini ikut dihapus dan tidak bisa dipakai masuk lagi.</p>}
        {m.is_ketua && (
          <p className="text-amber-700">
            Dia adalah ketua. Kelompok akan tanpa ketua sampai Anda memilih ketua baru lewat tombol Jadikan Ketua.
          </p>
        )}
        {k?.jadwal && (
          <p className="text-amber-700">
            Kelompok ini sudah memilih jadwal ({k.jadwal}) dan jadwalnya tetap. Sisa anggota {sisa} orang
            {sisa < 2 || sisa > 6 ? ", di luar aturan 2-6 orang" : ""}.
          </p>
        )}
        <p className="font-bold text-gray-700">Tindakan ini tidak bisa dibatalkan.</p>
      </ModalKonfirmasi>
    );
  }

  const { k } = hapus;
  const n = k.anggota.length;
  const akun = k.anggota.filter((a) => a.user_id).length;
  const tombol: TombolModal[] =
    n === 0
      ? [{ label: "Hapus Kelompok", gaya: "bahaya", onClick: () => onHapus("lepas") }]
      : [
          { label: "Hapus kelompok saja", gaya: "sekunder", onClick: () => onHapus("lepas") },
          { label: `Hapus kelompok + ${n} mahasiswa`, gaya: "bahaya", onClick: () => onHapus("hapus") },
        ];
  return (
    <ModalKonfirmasi judul={`Hapus Kelompok ${hurufKelompok(k.nomor)} (${k.kelas})?`} sibuk={sibuk} onBatal={onBatal} tombol={tombol}>
      {n === 0 ? (
        <p>Kelompok ini belum punya anggota.</p>
      ) : (
        <>
          <p>Kelompok ini beranggota {n} mahasiswa. Pilih apa yang terjadi pada mereka:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>Hapus kelompok saja</b>: mahasiswa tetap tersimpan tanpa kelompok (status ketua dicabut, akun login tetap ada).
            </li>
            <li>
              <b>Hapus kelompok + {n} mahasiswa</b>: semua anggota dihapus{akun ? `, termasuk ${akun} akun login` : ""}.
            </li>
          </ul>
        </>
      )}
      {k.jadwal && <p className="text-amber-700">Jadwal {k.jadwal} yang dipilih kelompok ini dibatalkan dan kuotanya kembali.</p>}
      <p className="font-bold text-gray-700">Tindakan ini tidak bisa dibatalkan.</p>
    </ModalKonfirmasi>
  );
}
