// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const supabaseVerifikator = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
  { auth: { persistSession: false, autoRefreshToken: false } }
);

export async function cekAdmin(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "")?.trim();
  if (!token || token === "undefined") throw new Error("Token sesi kosong. Harap logout dan login ulang.");

  const { data, error } = await supabaseVerifikator.auth.getUser(token);
  if (error || !data.user) throw new Error("Token kedaluwarsa. Harap logout dan login ulang.");

  // Ambil data is_admin dan nim untuk melacak siapa sebenarnya yang sedang menekan tombol
  const { data: m, error: dbError } = await supabaseAdmin
    .from("mahasiswa")
    .select("is_admin, nim")
    .eq("user_id", data.user.id)
    .maybeSingle();

  if (dbError) throw new Error(`Database Error: ${dbError.message}`);

  // SKENARIO 1: Data tidak ditemukan karena Kunci Service Role salah/tertukar
  if (!m) {
    throw new Error(`Data tidak ditemukan! Pastikan SUPABASE_SERVICE_ROLE_KEY di .env adalah Secret Key (berawalan ey...), BUKAN Anon Key.`);
  }

  // SKENARIO 2: Sesi tercampur dengan akun mahasiswa
  if (m.is_admin !== true) {
    throw new Error(`Sesi yang terkirim adalah akun mahasiswa (NIM: ${m.nim}). Harap tekan tombol KELUAR lalu LOGIN KEMBALI sebagai admin.`);
  }

  return true;
}