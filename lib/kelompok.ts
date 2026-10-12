// Di database kelompok disimpan sebagai nomor (1, 2, 3, ...), tetapi di layar selalu ditampilkan
// sebagai huruf kapital seperti di sheet lab: 1 = A, 2 = B, ..., 26 = Z, 27 = AA.

export function hurufKelompok(nomor: number): string {
  if (!Number.isInteger(nomor) || nomor < 1) return "?";
  let n = nomor;
  let huruf = "";
  while (n > 0) {
    const sisa = (n - 1) % 26;
    huruf = String.fromCharCode(65 + sisa) + huruf;
    n = Math.floor((n - 1) / 26);
  }
  return huruf;
}

// Kebalikannya. Menerima "A", "b", "Kelompok C", "KLP D", atau angka lama ("3").
// Mengembalikan null jika bukan huruf A-Z (maksimal dua huruf) atau angka bulat positif.
export function nomorKelompok(label: string): number | null {
  const l = label
    .trim()
    .toUpperCase()
    .replace(/^(KELOMPOK|KLP)\s*/, "");
  if (/^\d+$/.test(l)) {
    const n = parseInt(l, 10);
    return n >= 1 ? n : null;
  }
  if (/^[A-Z]{1,2}$/.test(l)) return [...l].reduce((jml, c) => jml * 26 + (c.charCodeAt(0) - 64), 0);
  return null;
}
