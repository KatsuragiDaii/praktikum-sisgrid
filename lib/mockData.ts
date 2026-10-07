// file: lib/mockData.ts

// ------------------------------------------------------
// 1. DEFINISI TIPE DATA (TYPES)
// Memastikan struktur data selalu konsisten di Front-End
// ------------------------------------------------------

export type Role = 'ADMIN' | 'KETUA' | 'ANGGOTA';

export interface Mahasiswa {
  id: string;
  nim: string;
  nama: string;
  role: Role;
  kelas: string;
}

export interface Kelompok {
  id: string;
  namaKelompok: string;       // Contoh: "Kelompok 1"
  kelas: string;              // Contoh: "TT-46-01"
  ketua: Mahasiswa;
  anggota: Mahasiswa[];
  statusRegistrasi: boolean;  // true jika sudah memilih jadwal
  jadwalTerpilihId: string | null; 
}

export interface JadwalShift {
  id: string;
  hari: string;               // Senin - Sabtu
  shift: number;              // 1, 2, 3, atau 4
  waktu: string;              // "06.30 - 09.30"
  kuotaMaksimal: number;      // Berapa kelompok maksimal di shift ini
  sisaKuota: number;          // Sisa kuota real-time
}

// ------------------------------------------------------
// 2. MOCK DATA (DATA PALSU UNTUK SIMULASI UI)
// ------------------------------------------------------

// Data Jadwal (Senin - Sabtu, 4 Shift)
export const mockJadwal: JadwalShift[] = [
  { id: "JAD-SEN-1", hari: "Senin", shift: 1, waktu: "06.30 - 09.30", kuotaMaksimal: 5, sisaKuota: 0 }, // Contoh Penuh (Merah)
  { id: "JAD-SEN-2", hari: "Senin", shift: 2, waktu: "09.30 - 12.30", kuotaMaksimal: 5, sisaKuota: 2 }, // Contoh Hampir Habis (Kuning)
  { id: "JAD-SEN-3", hari: "Senin", shift: 3, waktu: "12.30 - 15.30", kuotaMaksimal: 5, sisaKuota: 5 }, // Contoh Kosong (Hijau)
  { id: "JAD-SEN-4", hari: "Senin", shift: 4, waktu: "15.30 - 18.30", kuotaMaksimal: 5, sisaKuota: 5 },
  // ... (Hari Selasa s/d Sabtu akan di-generate dengan pola yang sama di UI)
];

// Data Mahasiswa (Database keseluruhan mahasiswa)
export const mockMahasiswa: Mahasiswa[] = [
  { id: "M001", nim: "1101230001", nama: "Devdan Wisesa Putranto", role: "KETUA", kelas: "EL-46-01" },
  { id: "M002", nim: "1101230002", nama: "Ahmad Maulana", role: "ANGGOTA", kelas: "EL-46-01" },
  { id: "M003", nim: "1101230003", nama: "Siti Nurhaliza", role: "ANGGOTA", kelas: "EL-46-01" },
  { id: "M004", nim: "1101230004", nama: "Kevin Pratama", role: "ANGGOTA", kelas: "EL-46-01" },
  { id: "M005", nim: "1101230005", nama: "Rina Melati", role: "ANGGOTA", kelas: "EL-46-01" },
];

// Data Kelompok (Admin mengatur komposisi ini)
export const mockKelompok: Kelompok[] = [
  {
    id: "KEL-EL4601-01",
    namaKelompok: "Kelompok 1",
    kelas: "EL-46-01",
    ketua: mockMahasiswa[0], // Mengambil data Devdan sebagai ketua
    anggota: [
      mockMahasiswa[1],
      mockMahasiswa[2],
      mockMahasiswa[3],
      mockMahasiswa[4]
    ],
    statusRegistrasi: false,
    jadwalTerpilihId: null
  }
];

// Akun Admin Lab untuk Login
export const mockAdmin = {
  id: "ADM-001",
  username: "admin_sistem_tenaga",
  nama: "Asisten Lab Admin",
  role: "ADMIN"
};