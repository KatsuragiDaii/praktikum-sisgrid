// Membaca daftar praktikan dari file Excel (.xlsx) atau CSV dengan format seperti sheet lab:
//   NO | NAMA | NIM | ANGKATAN | KELOMPOK
// Huruf kelompok cukup ada di baris pertama tiap kelompok (sel boleh digabung); orang di baris
// pertama itulah ketuanya (huruf A, B, C, ... dipakai langsung sebagai nama kelompok). Nama kelas dibaca dari judul "DAFTAR PRAKTIKAN EL-48-01".

import { hurufKelompok, nomorKelompok } from "@/lib/kelompok";

export type BarisImpor = { nim: string; nama: string; kelas: string; klp: number; ketua: boolean; password?: string };
export type HasilImpor = { jmlMahasiswa: number; akun: { nim: string; ok: boolean; pesan?: string }[] };

export type Anggota = { nim: string; nama: string; angkatan: string; baris: number };
export type KelompokFile = { label: string; klp: number; anggota: Anggota[]; ketuaNim: string };
export type Masalah = { galat: boolean; teks: string };
export type KelasFile = { sheet: string; kelas: string; kelompok: KelompokFile[]; masalah: Masalah[]; dilewati: boolean };

// Isi sel jadi teks rapi (spasi ganda dibuang). Sel tanggal/kosong menjadi "".
const teks = (v: unknown) =>
  (typeof v === "string" || typeof v === "number" || typeof v === "boolean" ? String(v) : "").replace(/\s+/g, " ").trim();

// ---------- CSV ----------
// Excel berbahasa Indonesia biasanya menyimpan CSV dengan titik koma, Google Sheets dengan koma.
export function parseCsv(isi: string): string[][] {
  const t = isi.replace(/^﻿/, "");
  const contoh = t.split(/\r?\n/).slice(0, 30).join("\n");
  const hitung = (c: string) => contoh.split(c).length - 1;
  const pemisah = [",", ";", "\t"].reduce((a, b) => (hitung(b) > hitung(a) ? b : a), ",");

  const baris: string[][] = [];
  let row: string[] = [];
  let sel = "";
  let kutip = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (kutip) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          sel += '"';
          i++;
        } else kutip = false;
      } else sel += c;
    } else if (c === '"') kutip = true;
    else if (c === pemisah) {
      row.push(sel);
      sel = "";
    } else if (c === "\n") {
      row.push(sel);
      baris.push(row);
      row = [];
      sel = "";
    } else if (c !== "\r") sel += c;
  }
  row.push(sel);
  baris.push(row);
  return baris;
}

// ---------- Ubah baris sheet menjadi kelas/kelompok/anggota ----------
export function ekstrakKelas(rows: unknown[][], namaSheet: string): KelasFile {
  const kosong = (alasan: string): KelasFile => ({
    sheet: namaSheet,
    kelas: namaSheet,
    kelompok: [],
    masalah: [{ galat: false, teks: alasan }],
    dilewati: true,
  });
  const norm = (v: unknown) => teks(v).toUpperCase();

  let h = -1;
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const sel = (rows[i] ?? []).map(norm);
    if (sel.includes("NAMA") && sel.includes("NIM")) {
      h = i;
      break;
    }
  }
  if (h < 0) return kosong('Judul kolom "NAMA" dan "NIM" tidak ditemukan, tab ini dilewati.');

  const head = rows[h].map(norm);
  const cNama = head.indexOf("NAMA");
  const cNim = head.indexOf("NIM");
  const cAng = head.indexOf("ANGKATAN");
  const cKlp = head.findIndex((x) => x === "KELOMPOK" || x === "KLP");
  if (cKlp < 0) return kosong('Kolom "KELOMPOK" tidak ditemukan, tab ini dilewati.');

  // Nama kelas dari judul di atas tabel, mis. "DAFTAR PRAKTIKAN EL-48-01"
  const atas = rows
    .slice(0, h + 1)
    .flat()
    .map(teks)
    .join(" ");
  const kelas =
    atas
      .match(/DAFTAR\s+PRAKTIKAN\s+(?:KELAS\s+)?(?=[A-Z0-9-]*\d)([A-Z0-9][A-Z0-9-]*)/i)?.[1]
      .replace(/-+$/, "")
      .toUpperCase() ?? namaSheet;

  const masalah: Masalah[] = [];
  const kelompok: KelompokFile[] = [];
  const dipakai = new Map<string, KelompokFile>();
  const nimBaris = new Map<string, number>();
  let kini: KelompokFile | null = null;
  let labelKini = "";

  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const nama = teks(r[cNama]);
    const nimMentah = teks(r[cNim]);
    const label = teks(r[cKlp]).toUpperCase();
    if (!nama && !nimMentah) continue;
    if (!nama || !nimMentah) {
      masalah.push({ galat: false, teks: `Baris ${i + 1}: NAMA atau NIM kosong, baris dilewati.` });
      continue;
    }

    if (label && label !== labelKini) {
      labelKini = label;
      const ada = dipakai.get(label);
      if (ada) {
        masalah.push({ galat: true, teks: `Kelompok ${label} muncul lebih dari satu kali (baris ${i + 1}).` });
        kini = ada;
      } else {
        kini = { label, klp: 0, anggota: [], ketuaNim: "" };
        dipakai.set(label, kini);
        kelompok.push(kini);
      }
    }
    if (!kini) {
      masalah.push({ galat: true, teks: `Baris ${i + 1}: belum ada huruf kelompok di atas baris ini.` });
      continue;
    }

    const nim = nimMentah.replace(/\s/g, "").replace(/\.0+$/, "");
    if (/\d[eE][+-]?\d+$/.test(nim)) {
      masalah.push({
        galat: true,
        teks: `Baris ${i + 1}: NIM "${nimMentah}" rusak (format ilmiah). Ubah kolom NIM menjadi angka biasa/teks di Excel, lalu simpan ulang.`,
      });
      continue;
    }
    if (!/^\d{8,14}$/.test(nim)) {
      masalah.push({ galat: true, teks: `Baris ${i + 1}: NIM "${nimMentah}" harus berupa angka (8-14 digit).` });
      continue;
    }
    const sebelumnya = nimBaris.get(nim);
    if (sebelumnya) {
      masalah.push({ galat: true, teks: `NIM ${nim} muncul dua kali (baris ${sebelumnya} dan ${i + 1}).` });
      continue;
    }
    nimBaris.set(nim, i + 1);
    kini.anggota.push({ nim, nama, angkatan: cAng >= 0 ? teks(r[cAng]) : "", baris: i + 1 });
  }

  const nomorDipakai = new Map<number, string>();
  for (const g of kelompok) {
    g.ketuaNim = g.anggota[0]?.nim ?? "";
    const no = nomorKelompok(g.label);
    if (no === null) {
      masalah.push({ galat: true, teks: `Label kelompok "${g.label}" tidak dikenali (pakai huruf A-Z).` });
    } else {
      g.klp = no;
      const bentrok = nomorDipakai.get(no);
      if (bentrok) masalah.push({ galat: true, teks: `Kelompok "${bentrok}" dan "${g.label}" dianggap kelompok yang sama (${hurufKelompok(no)}).` });
      nomorDipakai.set(no, g.label);
    }
    const n = g.anggota.length;
    if (n === 0) masalah.push({ galat: false, teks: `Kelompok ${g.label} tidak punya anggota.` });
    else if (n < 2 || n > 6) masalah.push({ galat: false, teks: `Kelompok ${g.label} berisi ${n} orang (aturan pendaftaran: 2-6 orang).` });
  }

  return { sheet: namaSheet, kelas, kelompok: kelompok.filter((g) => g.anggota.length > 0), masalah, dilewati: false };
}

// ---------- Baca file ----------
export async function bacaFile(file: File): Promise<KelasFile[]> {
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "xlsx") {
    // varian "universal": tanpa Web Worker, aman untuk bundler dan cukup cepat untuk daftar kecil
    const { default: bacaXlsx } = await import("read-excel-file/universal");
    const semua = await bacaXlsx<string>(file, { parseNumber: (s) => s });
    return semua.map((s) => ekstrakKelas(s.data as unknown[][], s.sheet));
  }
  if (ext === "csv" || ext === "tsv" || ext === "txt") {
    return [ekstrakKelas(parseCsv(await file.text()), file.name.replace(/\.[^.]+$/, ""))];
  }
  if (ext === "xls") throw new Error("File .xls (Excel lama) belum didukung. Buka di Excel, lalu simpan sebagai .xlsx atau .csv.");
  throw new Error("Format file tidak dikenali. Gunakan file .xlsx atau .csv.");
}

// ---------- Password acak untuk ketua ----------
// Tanpa karakter yang mudah tertukar (0/o, 1/l/i). Pengambilan acak memakai crypto, tanpa bias modulo.
const HURUF = "abcdefghjkmnpqrstuvwxyz23456789";
export function buatPassword(panjang = 8): string {
  const batas = 256 - (256 % HURUF.length);
  let hasil = "";
  while (hasil.length < panjang) {
    for (const b of crypto.getRandomValues(new Uint8Array(panjang * 2))) {
      if (b < batas && hasil.length < panjang) hasil += HURUF[b % HURUF.length];
    }
  }
  return hasil;
}
