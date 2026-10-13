import type { NextConfig } from "next";

const produksi = process.env.NODE_ENV === "production";

// Browser hanya boleh menghubungi server kita sendiri dan Supabase milik proyek ini.
function asalSupabase(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
}

// CSP statis (tanpa nonce) supaya halaman tetap bisa dibuat statis dan di-cache CDN Vercel.
// 'unsafe-inline' pada script dibutuhkan skrip hidrasi Next.js; 'unsafe-eval' hanya untuk mode dev.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${produksi ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  // images.unsplash.com = latar halaman login. Jika gambar sudah disimpan di /public, hapus asal ini.
  "img-src 'self' blob: data: https://images.unsplash.com",
  "font-src 'self'",
  `connect-src 'self' ${asalSupabase()}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(produksi ? ["upgrade-insecure-requests"] : []),
].join("; ");

const headerKeamanan = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(produksi ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: headerKeamanan },
      // Jawaban API (daftar akun, hasil hapus, status) tidak boleh disimpan cache mana pun.
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
