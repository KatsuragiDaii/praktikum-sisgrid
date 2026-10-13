import { klienAdmin, cekAdmin, jawabKesalahan } from "@/lib/supabaseAdmin";
import { emailDariNim } from "@/lib/supabase";

const MAKS_AKUN = 100;
const MIN_PASSWORD = 8;

type Hasil = { nim: string; ok: boolean; pesan?: string };

// Supabase menyembunyikan pesan asli trigger database di balik kalimat umum ini.
function petunjukGalat(pesan: string): string {
  return /Database error creating new user/i.test(pesan)
    ? `${pesan}. Biasanya trigger tautkan_akun menolak: jalankan ulang supabase/migrasi-03-keamanan.sql versi terbaru, atau lihat Supabase > Logs > Postgres.`
    : pesan;
}

// Admin membuat akun ketua (atau mengganti passwordnya jika akun sudah ada).
export async function POST(req: Request) {
  try {
    await cekAdmin(req);

    const b = (await req.json().catch(() => null)) as { akun?: unknown } | null;
    if (!b || !Array.isArray(b.akun) || b.akun.length === 0 || b.akun.length > MAKS_AKUN) {
      return Response.json({ error: `Daftar akun tidak valid (1-${MAKS_AKUN} akun per permintaan)` }, { status: 400 });
    }
    const akun = b.akun as { nim?: unknown; password?: unknown }[];
    if (!akun.every((a) => a && typeof a.nim === "string" && typeof a.password === "string")) {
      return Response.json({ error: "Setiap akun harus berisi nim dan password (teks)" }, { status: 400 });
    }

    const db = klienAdmin();
    // Dibatasi beberapa sekaligus agar tidak membanjiri Auth Supabase (batas laju) saat impor besar.
    const antrean = (akun as { nim: string; password: string }[]).map((a, i) => ({ ...a, i }));
    const hasil: Hasil[] = new Array(antrean.length);

    async function proses({ nim, password, i }: { nim: string; password: string; i: number }) {
      const id = nim.trim().toLowerCase();
      let r: Hasil;
      try {
        if (!/^[a-z0-9._-]+$/.test(id)) r = { nim: id, ok: false, pesan: "Username hanya boleh huruf, angka, titik, strip" };
        else if (password.length < MIN_PASSWORD) r = { nim: id, ok: false, pesan: `Password minimal ${MIN_PASSWORD} karakter` };
        else {
          const { data: m, error: e0 } = await db.from("mahasiswa").select("user_id").eq("nim", id).maybeSingle();
          if (e0) r = { nim: id, ok: false, pesan: e0.message };
          else if (!m) r = { nim: id, ok: false, pesan: "belum ada di daftar mahasiswa" };
          else {
            let error: { message: string } | null;
            if (m.user_id) {
              ({ error } = await db.auth.admin.updateUserById(m.user_id, { password }));
            } else {
              // Trigger tautkan_akun (supabase/migrasi-03-keamanan.sql) hanya menerima akun baru yang punya izin singkat
              // di tabel izin_akun, yang hanya bisa ditulis oleh server ini. (app_metadata tidak bisa dipakai sebagai
              // tanda: Supabase Auth baru mengisinya setelah baris user dimasukkan.)
              const { error: eIzin } = await db.from("izin_akun").upsert({ nim: id, sampai: new Date(Date.now() + 60_000).toISOString() });
              if (eIzin) {
                hasil[i] = { nim: id, ok: false, pesan: `Gagal menyiapkan izin akun: ${eIzin.message}. Pastikan migrasi-03-keamanan.sql versi terbaru sudah dijalankan.` };
                return;
              }
              ({ error } = await db.auth.admin.createUser({ email: emailDariNim(id), password, email_confirm: true }));
              if (error) await db.from("izin_akun").delete().eq("nim", id); // izin tidak dipakai: bersihkan
            }
            r = { nim: id, ok: !error, pesan: error ? petunjukGalat(error.message) : undefined };
          }
        }
      } catch (e) {
        r = { nim: id, ok: false, pesan: (e as Error).message };
      }
      hasil[i] = r;
    }

    const PARALEL = 5;
    let berikut = 0;
    await Promise.all(
      Array.from({ length: Math.min(PARALEL, antrean.length) }, async () => {
        while (berikut < antrean.length) await proses(antrean[berikut++]);
      })
    );

    return Response.json({ hasil });
  } catch (e) {
    return jawabKesalahan(e);
  }
}
