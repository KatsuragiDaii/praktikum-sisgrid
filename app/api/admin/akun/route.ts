import { klienAdmin, cekAdmin, jawabKesalahan } from "@/lib/supabaseAdmin";
import { emailDariNim } from "@/lib/supabase";

const MAKS_AKUN = 100;
const MIN_PASSWORD = 8;

type Hasil = { nim: string; ok: boolean; pesan?: string };

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
            const { error } = m.user_id
              ? await db.auth.admin.updateUserById(m.user_id, { password })
              : // app_metadata.dibuat_admin dicek oleh trigger tautkan_akun (supabase/migrasi-03-keamanan.sql):
                // akun yang dibuat lewat pendaftaran mandiri ditolak, hanya yang dibuat di sini yang diterima.
                await db.auth.admin.createUser({
                  email: emailDariNim(id),
                  password,
                  email_confirm: true,
                  app_metadata: { dibuat_admin: true },
                });
            r = { nim: id, ok: !error, pesan: error?.message };
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
