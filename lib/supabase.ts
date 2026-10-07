import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Supabase Auth butuh email; NIM dipetakan ke alamat ini (tidak ada email yang dikirim).
export const emailDariNim = (nim: string) =>
  `${nim.trim().toLowerCase()}@student.telkomuniversity.ac.id`;

export const HARI = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
export const SHIFT = ["06.30 - 09.30", "09.30 - 12.30", "12.30 - 15.30", "15.30 - 18.30"];
