import { supabaseAdmin, cekAdmin } from "@/lib/supabaseAdmin";

type Gagal = { nim: string; pesan: string };
type Hasil = { kelompok: boolean; mahasiswa: number; akun: number; lepas: number; gagal: Gagal[] };

const kosong = (): Hasil => ({ kelompok: false, mahasiswa: 0, akun: 0, lepas: 0, gagal: [] });

// Satu kegagalan (termasuk exception) tidak boleh menghentikan penghapusan mahasiswa lain.
async function hapusAkun(id: string): Promise<{ message: string } | null> {
  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
    return error;
  } catch (e) {
    return { message: (e as Error).message };
  }
}

// Menghapus mahasiswa beserta akun loginnya. Akun admin tidak pernah ikut terhapus.
async function hapusMahasiswa(nims: string[], hasil: Hasil) {
  if (!nims.length) return;
  const { data, error } = await supabaseAdmin.from("mahasiswa").select("nim,user_id,is_admin").in("nim", nims);
  if (error) throw new Error(error.message);

  for (const m of data ?? []) {
    if (m.is_admin) {
      hasil.gagal.push({ nim: m.nim, pesan: "Akun admin tidak bisa dihapus dari sini" });
      continue;
    }
    if (m.user_id) {
      const e = await hapusAkun(m.user_id);
      if (e && !/not found/i.test(e.message)) {
        hasil.gagal.push({ nim: m.nim, pesan: `Akun login gagal dihapus: ${e.message}` });
        continue;
      }
      if (!e) hasil.akun++;
    }
    const { error: e2 } = await supabaseAdmin.from("mahasiswa").delete().eq("nim", m.nim);
    if (e2) hasil.gagal.push({ nim: m.nim, pesan: e2.message });
    else hasil.mahasiswa++;
  }
}

// Menghapus kelompok.
async function hapusKelompok(id: number, mode: "hapus" | "lepas", hasil: Hasil) {
  const { data: ada, error } = await supabaseAdmin.from("kelompok").select("id").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!ada) throw new Error("Kelompok tidak ditemukan (mungkin sudah dihapus)");

  if (mode === "hapus") {
    const { data: anggota, error: e1 } = await supabaseAdmin.from("mahasiswa").select("nim").eq("kelompok_id", id);
    if (e1) throw new Error(e1.message);
    await hapusMahasiswa((anggota ?? []).map((a) => a.nim), hasil);
    if (hasil.gagal.length) return; 
  } else {
    const { data: dilepas, error: e2 } = await supabaseAdmin
      .from("mahasiswa")
      .update({ kelompok_id: null, is_ketua: false })
      .eq("kelompok_id", id)
      .select("nim");
    if (e2) throw new Error(e2.message);
    hasil.lepas = dilepas?.length ?? 0;
  }

  const { error: e3 } = await supabaseAdmin.from("kelompok").delete().eq("id", id);
  if (e3) throw new Error(e3.message);
  hasil.kelompok = true;
}

export async function POST(req: Request) {
  try {
    await cekAdmin(req);
  } catch (error) {
    // Menangkap pesan detail dan mengirimkannya ke layar
    return Response.json({ error: `Akses ditolak: ${(error as Error).message}` }, { status: 403 });
  }

  const b = (await req.json().catch(() => null)) as {
    aksi?: string;
    nim?: unknown;
    id?: unknown;
    mahasiswa?: unknown;
  } | null;
  const hasil = kosong();

  try {
    if (b?.aksi === "mahasiswa") {
      if (!Array.isArray(b.nim) || b.nim.length === 0 || b.nim.length > 200 || !b.nim.every((n) => typeof n === "string" && n.trim()))
        return Response.json({ error: "Daftar NIM tidak valid" }, { status: 400 });
      await hapusMahasiswa(b.nim.map((n: string) => n.trim().toLowerCase()), hasil);
    } else if (b?.aksi === "kelompok") {
      if (typeof b.id !== "number" || !Number.isInteger(b.id) || (b.mahasiswa !== "hapus" && b.mahasiswa !== "lepas"))
        return Response.json({ error: "Permintaan tidak valid" }, { status: 400 });
      await hapusKelompok(b.id, b.mahasiswa, hasil);
    } else {
      return Response.json({ error: "Aksi tidak dikenal" }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  return Response.json(hasil);
}