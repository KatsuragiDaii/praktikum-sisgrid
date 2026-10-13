// lib/supabaseAdmin.ts
// HANYA untuk dipakai di server (route handler). Jangan diimpor dari komponen "use client".
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Kesalahan "pengunjung tidak berhak" (token kosong/kedaluwarsa, bukan admin) -> dijawab 403.
// Kesalahan lain (env belum diisi, database bermasalah) -> dijawab 500 agar tidak tertukar.
export class AksesDitolak extends Error {}

const opsi = { auth: { persistSession: false, autoRefreshToken: false } };

let klienAdminCache: SupabaseClient | null = null;
let klienVerifikatorCache: SupabaseClient | null = null;

function wajib(nama: string): string {
  const nilai = process.env[nama];
  if (!nilai) throw new Error(`Environment variable ${nama} belum diisi di server (lokal: berkas .env.local; Vercel: Settings > Environment Variables), lalu jalankan ulang/deploy ulang.`);
  return nilai;
}

// Dibuat saat pertama kali dipakai, bukan saat modul dimuat, supaya env yang hilang menghasilkan
// pesan yang jelas (JSON, bukan halaman 500 kosong yang membuat browser menampilkan "Unexpected end of JSON input").
export function klienAdmin(): SupabaseClient {
  klienAdminCache ??= createClient(wajib("NEXT_PUBLIC_SUPABASE_URL"), wajib("SUPABASE_SERVICE_ROLE_KEY"), opsi);
  return klienAdminCache;
}

function klienVerifikator(): SupabaseClient {
  klienVerifikatorCache ??= createClient(wajib("NEXT_PUBLIC_SUPABASE_URL"), wajib("NEXT_PUBLIC_SUPABASE_ANON_KEY"), opsi);
  return klienVerifikatorCache;
}

export async function cekAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token || token === "undefined") throw new AksesDitolak("Token sesi kosong. Harap logout dan login ulang.");

  const { data, error } = await klienVerifikator().auth.getUser(token);
  if (error || !data.user) {
    // Auth Supabase sedang membatasi laju / tidak bisa dihubungi: ini bukan salah pengguna.
    if (error && (error.status === 429 || (error.status ?? 0) >= 500)) {
      throw new Error("Layanan login Supabase sedang sibuk. Tunggu sebentar lalu coba lagi.");
    }
    throw new AksesDitolak("Token kedaluwarsa. Harap logout dan login ulang.");
  }

  // Ambil data is_admin dan nim untuk melacak siapa sebenarnya yang sedang menekan tombol
  const { data: m, error: dbError } = await klienAdmin()
    .from("mahasiswa")
    .select("is_admin, nim")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (dbError) throw new Error(`Database Error: ${dbError.message}`);

  // SKENARIO 1: Data tidak ditemukan karena Kunci Service Role salah/tertukar
  if (!m) {
    throw new Error(
      "Data tidak ditemukan! Pastikan SUPABASE_SERVICE_ROLE_KEY di server adalah Secret Key (berawalan ey... atau sb_secret_...), BUKAN Anon Key."
    );
  }

  // SKENARIO 2: Sesi tercampur dengan akun mahasiswa
  if (m.is_admin !== true) {
    throw new AksesDitolak(`Sesi yang terkirim adalah akun mahasiswa (NIM: ${m.nim}). Harap tekan tombol KELUAR lalu LOGIN KEMBALI sebagai admin.`);
  }

  return true;
}

// Dipakai di route handler: jawab sesuai jenis kesalahannya.
export function jawabKesalahan(e: unknown): Response {
  const pesan = e instanceof Error ? e.message : "Terjadi kesalahan pada server";
  if (e instanceof AksesDitolak) return Response.json({ error: `Akses ditolak: ${pesan}` }, { status: 403 });
  console.error("[api/admin]", pesan);
  return Response.json({ error: pesan }, { status: 500 });
}
