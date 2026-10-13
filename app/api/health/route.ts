import { klienAdmin } from "@/lib/supabaseAdmin";

// Tidak boleh di-cache oleh Next/Vercel: tujuannya memang menyentuh database.
export const dynamic = "force-dynamic";

// Dipanggil terjadwal (vercel.json) agar proyek Supabase Free tidak dijeda karena 7 hari tanpa aktivitas,
// dan bisa dipakai untuk memantau (UptimeRobot dsb.). Hanya menjawab "ok"/"gagal", tanpa detail apa pun.
const TTL_MS = 60_000;
let terakhir: { waktu: number; ok: boolean } | null = null;

export async function GET() {
  const sekarang = Date.now();
  // Cache singkat per instance: pemantau yang menembak berkali-kali tidak ikut membebani database.
  if (terakhir && sekarang - terakhir.waktu < TTL_MS) return balas(terakhir.ok);

  let ok = false;
  try {
    // Memakai kunci server supaya query benar-benar sampai ke tabel (anon tidak punya akses setelah migrasi-03).
    const { error } = await klienAdmin().from("slot").select("id").limit(1);
    ok = !error;
  } catch {
    ok = false;
  }
  terakhir = { waktu: sekarang, ok };
  return balas(ok);
}

function balas(ok: boolean) {
  return Response.json({ status: ok ? "ok" : "gagal" }, { status: ok ? 200 : 503 });
}
