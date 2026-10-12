import { redirect } from "next/navigation";

// Alamat lama /admin/dashboard sekarang dipecah menjadi /admin/jadwal dan /admin/kelompok.
export default function AdminDashboard() {
  redirect("/admin/jadwal");
}
