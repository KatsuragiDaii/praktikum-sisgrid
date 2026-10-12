import { supabaseAdmin, cekAdmin } from "@/lib/supabaseAdmin";
import { emailDariNim } from "@/lib/supabase";

// Admin membuat akun ketua (atau mengganti passwordnya jika akun sudah ada).
export async function POST(req: Request) {
  try {
    await cekAdmin(req);
  } catch (error) {
    return Response.json({ error: `Akses ditolak: ${(error as Error).message}` }, { status: 403 });
  }

  const { akun } = (await req.json()) as { akun: { nim: string; password: string }[] };
  const hasil = await Promise.all(
    akun.map(async ({ nim, password }) => {
      const id = nim.trim().toLowerCase();
      if (!/^[a-z0-9._-]+$/.test(id)) return { nim: id, ok: false, pesan: "Username hanya boleh huruf, angka, titik, strip" };
      if (password.length < 6) return { nim: id, ok: false, pesan: "Password minimal 6 karakter" };
      
      const { data: m } = await supabaseAdmin.from("mahasiswa").select("user_id").eq("nim", id).maybeSingle();
      if (!m) return { nim: id, ok: false, pesan: "belum ada di daftar mahasiswa" };
      
      const { error } = m.user_id
        ? await supabaseAdmin.auth.admin.updateUserById(m.user_id, { password })
        : await supabaseAdmin.auth.admin.createUser({ email: emailDariNim(id), password, email_confirm: true });
      
      return { nim: id, ok: !error, pesan: error?.message };
    })
  );
  return Response.json({ hasil });
}