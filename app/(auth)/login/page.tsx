"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Simulasi login ke Dashboard Admin atau Ketua
    setTimeout(() => {
      if (username === "admin" && password === "admin123") {
        router.push("/admin/dashboard");
      } else if (username === "1101230001" && password === "ketua123") {
        router.push("/ketua/registrasi");
      } else {
        setError("Username/NIM atau Password salah!");
        setIsLoading(false);
      }
    }, 1000);
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-900"
      style={{
        // Menggunakan gambar gardu induk / pembangkit listrik dari Unsplash sebagai placeholder
        backgroundImage: "url('https://images.unsplash.com/photo-1548337138-e87d889cc369?q=80&w=2036&auto=format&fit=crop')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Overlay Gelap: Agar background image tidak menutupi tulisan pada card */}
      <div className="absolute inset-0 bg-blue-950/60 mix-blend-multiply"></div>

      {/* 
        GLASSMORPHISM CARD 
        bg-white/10 (putih transparan), backdrop-blur-md (efek blur kaca), border-white/20 (bingkai tipis)
      */}
      <div className="w-full max-w-md relative z-10 p-8 rounded-3xl bg-white/10 backdrop-blur-md border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]">
        
        {/* Header & Logo */}
        <div className="text-center mb-8">
          {/* Ubah kotak logo di sini */}
          <div className="w-24 h-24 mx-auto flex items-center justify-center mb-4 relative drop-shadow-lg">
            <Image 
              src="/logoSisgrid.png"
              alt="Logo Lab Sistem Tenaga"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-white drop-shadow-md">Registrasi Praktikum</h1>
          <p className="text-sm text-gray-200 mt-1 drop-shadow-md">Power System and Grid Digitalization Laboratory</p>
        </div>

        {/* Notifikasi Error */}
        {error && (
          <div className="mb-5 p-3 bg-red-500/20 backdrop-blur-sm text-red-200 text-sm rounded-lg border border-red-500/50 text-center">
            {error}
          </div>
        )}

        {/* Form Login */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1 drop-shadow-sm">
              Username
            </label>
            <input
              type="text"
              required
              className="w-full px-4 py-3 rounded-xl border border-white/20 text-white placeholder-gray-400 bg-black/20 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all backdrop-blur-sm"
              placeholder="Masukkan Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1 drop-shadow-sm">
              Password
            </label>
            <input
              type="password"
              required
              className="w-full px-4 py-3 rounded-xl border border-white/20 text-white placeholder-gray-400 bg-black/20 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all backdrop-blur-sm"
              placeholder="Masukkan Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-3 px-4 flex justify-center items-center rounded-xl text-white font-semibold transition-all shadow-lg border border-white/20
              ${isLoading 
                ? "bg-blue-600/50 cursor-not-allowed" 
                : "bg-blue-600/80 hover:bg-blue-500 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-sm"}`}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Memproses...
              </span>
            ) : (
              "Masuk ke Sistem"
            )}
          </button>
        </form>

        {/* Footer Info */}
        <div className="mt-8 text-center text-xs text-gray-300 drop-shadow-sm">
          <p>Jika mengalami kendala, silakan hubungi Asisten Laboratorium.</p>
          <p className="mt-1 font-medium tracking-wider">© 2026 Sisgrid Laboratory</p>
        </div>
      </div>
    </div>
  );
}