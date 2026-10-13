# Panduan Deploy ke Vercel + Perkuatan Keamanan

Panduan ini untuk menayangkan aplikasi di Vercel dengan Supabase sebagai database/login, dan menyiapkannya
untuk saat banyak ketua login dan registrasi bersamaan.

Urutan pengerjaan (jangan dibalik, terutama langkah 2 dan 3):

1. Pengaturan di dashboard Supabase
2. Deploy kode ke Vercel
3. Jalankan `supabase/migrasi-03-keamanan.sql`
4. Pengaturan Vercel (region, firewall, proteksi)
5. Gladi resik sebelum pendaftaran dibuka

---

## 0. Apa yang berubah di kode ini

| Area | Perubahan | Alasan |
|---|---|---|
| Akun | Trigger `tautkan_akun` hanya menerima akun baru yang punya izin 60 detik di tabel `izin_akun`. Tabel itu hanya bisa ditulis server (kunci rahasia); route `/api/admin/akun` mencatat izin sebelum membuat akun, dan izinnya sekali pakai. | Sebelumnya, selama pendaftaran mandiri Supabase aktif, siapa pun yang tahu NIM bisa membuat akun lebih dulu dan menguasai baris ketua. |
| Hak akses DB | `anon` dicabut dari semua tabel dan fungsi; view `slot_terisi` hanya untuk yang sudah login. | Kuota tidak bisa lagi dibaca orang tanpa login. |
| Beban Auth | Halaman admin dan ketua memakai `getSession()` (baca sesi lokal), bukan `getUser()` (panggilan ke server tiap halaman dibuka). | Batas laju Auth Supabase dihitung **per alamat IP**; di kampus banyak ketua memakai IP yang sama. |
| Login | Pesan khusus saat dibatasi (429) atau server sibuk, tombol dijeda 30 dtk / 5 dtk. Pesan salah sandi tetap umum. | Mencegah orang menekan tombol berulang-ulang yang justru memperparah antrean. |
| Route admin | Klien admin dibuat saat dipakai (bukan saat import), semua galat dijawab JSON (403 hak akses, 500 server/konfigurasi, 400 input), input divalidasi, pembuatan akun dibatasi 5 paralel, maksimum 100 akun per permintaan. | Tidak ada lagi 500 kosong ("Unexpected end of JSON input"). |
| Password | Minimal 8 karakter (pembuatan akun, reset, ganti password). Kolom login tidak lagi memaksa panjang agar akun lama (6-7 karakter) tetap bisa masuk. | Password lebih kuat. |
| Header | CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store` untuk `/api/*`, `X-Powered-By` dihapus. | Perlindungan dasar terhadap XSS, clickjacking, dan cache jawaban API. |
| Batas tidak aktif | Tanpa gerakan mouse/ketikan/sentuhan/scroll selama 5 menit, pengguna keluar otomatis (peringatan 30 detik sebelumnya) dan diarahkan ke login. Sesi dicabut di server hanya untuk browser itu (`scope: local`). Aktivitas di tab mana pun menjaga semua tab. Ubah lewat `NEXT_PUBLIC_IDLE_MENIT`. | Mengurangi risiko komputer bersama/lab yang ditinggal dalam keadaan login. |
| Peringatan antar tab | Tab yang akunnya berganti karena login di tab lain menampilkan dialog, bukan diam-diam berganti akun. | Satu browser hanya punya satu sesi login. |
| Keep-alive | `/api/health` + cron harian di `vercel.json`. | Proyek Supabase Free dijeda setelah 7 hari tanpa aktivitas. |

---

## 1. Dashboard Supabase

Nama menu bisa sedikit berbeda antar versi dashboard; cari nama opsinya.

1. **Authentication > Sign In / Providers (User Signups)**: matikan **Allow new users to sign up**.
   Admin tetap bisa membuat akun lewat server karena memakai kunci rahasia. Migrasi SQL (langkah 3) adalah
   lapisan kedua jika opsi ini lupa dimatikan.
2. **Password minimum length** = `8` (di pengaturan Email provider).
3. **Authentication > Rate Limits**: lihat nilai batas per IP. Dokumentasi Supabase menyebut batas bawaan
   sekitar 30 permintaan per 5 menit per IP untuk endpoint seperti `/user` dan 150 per 5 menit untuk `/token`
   (login, ada burst). Apakah angka ini bisa Anda ubah tergantung paket Anda; jika tidak bisa diubah, andalkan
   langkah "stagger" di bagian 5.
4. **CAPTCHA (opsional)**: Authentication > Attack Protection. Berguna jika ada yang menyerang login, tetapi
   perlu perubahan kode di halaman login (token CAPTCHA dikirim saat `signInWithPassword`). Belum dipasang.
5. **Region**: catat region proyek Supabase Anda (Project Settings > General). Dipakai di langkah 4.

Ambil tiga nilai di **Project Settings > API**: Project URL, anon/publishable key, dan service_role/secret key.

## 2. Deploy ke Vercel

1. vercel.com > **Add New > Project** > pilih repo `praktikum-sisgrid` (Framework: Next.js, otomatis).
2. **Sebelum menekan Deploy**, isi Environment Variables (build akan gagal dengan
   `supabaseUrl is required` jika dua yang pertama kosong):

   | Nama | Nilai | Catatan |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL | publik |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon/publishable key | publik, dilindungi RLS |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role/secret key | **rahasia**; centang *Sensitive*; hanya Environment *Production* (dan Preview bila perlu) |
   | `NEXT_PUBLIC_IDLE_MENIT` | *(opsional)* menit, bawaan `5` | batas tidak aktif; perubahan perlu deploy ulang |

   Jangan memberi awalan `NEXT_PUBLIC_` pada kunci rahasia, jangan commit `.env.local`.
3. Deploy. Setelah selesai, buka `https://<domain>/api/health`; harus menjawab `{"status":"ok"}`.
4. Jika kunci rahasia pernah tertulis di GitHub/chat/screenshot, **putar (rotate) kuncinya** di Supabase
   lalu perbarui di Vercel dan redeploy.

## 3. Jalankan migrasi keamanan

Supabase > **SQL Editor** > tempel isi `supabase/migrasi-03-keamanan.sql` > Run. Aman dijalankan berulang.

Jalankan SQL ini dan deploy kode baru (route `/api/admin/akun` yang mencatat izin) dalam waktu berdekatan. Selama salah
satunya belum, pembuatan akun ketua baru gagal dengan "Database error creating new user" (akun yang sudah ada tidak
terpengaruh). Jika Anda pernah menjalankan versi migrasi yang lama (yang memakai `app_metadata.dibuat_admin`),
jalankan ulang file ini: versi lama itu keliru karena Supabase Auth baru mengisi `app_metadata` sesudah baris user
dimasukkan, sehingga semua pembuatan akun ditolak.

Perlindungan utamanya tetap mematikan **Allow new users to sign up** di dashboard (bagian 1). Izin 60 detik ini adalah
lapisan kedua jika opsi itu lupa dimatikan.

Aturan jumlah anggota kelompok (2-6) di fungsi `daftar_slot` tidak diubah migrasi ini.

Cek hasilnya (harus ditolak / kosong, bukan data):

```bash
curl -s "https://<project>.supabase.co/rest/v1/slot_terisi?select=*" -H "apikey: <ANON_KEY>"
```

## 4. Pengaturan Vercel

- **Settings > Functions > Function Region**: pilih region terdekat dengan region Supabase
  (mis. Supabase Singapore -> Vercel `sin1`). Mengurangi waktu tunggu antar server.
- **Firewall > Rate limiting**: buat aturan untuk path yang diawali `/api/` (mis. 60 permintaan per menit per IP,
  aksi *Deny*). Hanya ada 3 route API (2 untuk admin, 1 health); ketua tidak memakainya. Paket Hobby dibatasi jumlah
  aturan dan jendela waktunya, periksa batas di dashboard.
- **Deployment Protection**: biarkan proteksi untuk *Preview* menyala agar URL preview tidak publik.
- Cron di `vercel.json` memanggil `/api/health` sekali sehari (batas paket Hobby). Ini menjaga proyek Supabase
  Free tetap aktif. Tambahan opsional: pemantau luar (UptimeRobot dsb.) ke `/api/health`; jawabannya
  di-cache 60 detik per instance sehingga tidak membebani database.
- Paket Hobby Vercel ditujukan untuk penggunaan non-komersial dan punya batas transfer/invokasi; baca
  ketentuan terbarunya. Untuk praktikum internal dengan sekitar seratus ketua, beban jauh di bawah batas.
  Halaman bersifat statis (dilayani CDN), sedangkan yang dinamis hanya `/api/*` yang dipakai admin.

## 5. Sebelum pendaftaran dibuka (checklist)

- [ ] **Supabase Free dijeda otomatis** setelah 7 hari tanpa aktivitas. Cron di atas mencegahnya; tetap cek
  dashboard sehari sebelum buka. Untuk masa pendaftaran, pertimbangkan **Pro** (proyek tidak dijeda otomatis).
- [ ] **Cadangan data**: paket Free tidak menyediakan unduhan backup. Ekspor tabel `mahasiswa`, `kelompok`,
  `kelas`, `slot`, `pendaftaran` (Table Editor > Export CSV) sebelum buka.
- [ ] **Akun ketua sudah dibuat dan sudah dibagikan** minimal sehari sebelumnya, supaya login tidak menumpuk di menit pertama.
  Ingat batas tidak aktif: ketua yang menunggu tanpa menyentuh layar akan keluar otomatis setelah 5 menit. Pilih salah satu:
  minta ketua login **tepat sebelum** pendaftaran dibuka (maksimal beberapa menit), atau naikkan `NEXT_PUBLIC_IDLE_MENIT`
  (mis. `30`) khusus hari pendaftaran lalu deploy ulang dan kembalikan sesudahnya. Jika semua ketua terpaksa login ulang
  di menit yang sama, Anda akan melihat pembatasan 429 (lihat bagian bawah).
- [ ] **Bagi jadwal buka per kelas** (mis. tiap kelas selisih 30-60 menit). Ini pengaman paling efektif: batas
  laju Supabase per IP tidak bisa diatasi dari sisi aplikasi jika ratusan orang di jaringan kampus yang sama
  menekan tombol serentak.
- [ ] **Gladi resik**: buat 3-5 akun uji, login dari HP (data seluler) dan Wi-Fi kampus, daftar, batalkan, daftar ulang.
  Hapus data uji setelahnya.
- [ ] `akun-ketua.csv` (berisi password) **jangan di-commit** (sudah ada di `.gitignore`), hapus dari perangkat setelah dibagikan.
- [ ] Gambar latar login diambil dari `images.unsplash.com`. Untuk keandalan, unduh gambarnya ke `public/` dan ganti
  URL-nya, lalu hapus `https://images.unsplash.com` dari `img-src` di `next.config.ts`.

## 6. Jika ada masalah

| Gejala | Penyebab umum |
|---|---|
| Build Vercel gagal: `supabaseUrl is required` | Env `NEXT_PUBLIC_*` belum diisi sebelum deploy. Isi, lalu Redeploy. |
| Admin: `Akses ditolak: Data tidak ditemukan! Pastikan SUPABASE_SERVICE_ROLE_KEY...` | Kunci service_role di Vercel tertukar dengan anon key. |
| Admin: `Environment variable ... belum diisi di server` | Env belum diisi untuk lingkungan itu (Production/Preview). Isi lalu Redeploy (perubahan env tidak berlaku ke deploy lama). |
| Buat akun: `Akun hanya dapat dibuat oleh admin` | Migrasi sudah jalan tetapi kode lama masih tayang. Deploy kode terbaru. |
| Login: "Terlalu banyak percobaan dari jaringan ini" | Batas laju per IP Supabase. Tunggu 30 detik; bagi jadwal buka per kelas. |
| Login: "Server sedang sibuk" | Supabase tidak menjawab (mungkin dijeda). Buka dashboard dan **Restore** proyek. |
| `/api/health` menjawab `gagal` (503) | Database tidak terjangkau atau kunci rahasia salah/kosong. |

## Yang sudah diuji dan yang belum

Diuji di lingkungan uji: logika SQL pada PostgreSQL 16 asli (39 pemeriksaan, termasuk 150 pendaftaran
serentak ke kuota yang sama: tidak ada kuota terlampaui dan tidak ada deadlock), build produksi, header
keamanan, alur login (salah sandi, 429, server down), route admin, impor Excel/CSV, dan hapus kelompok/mahasiswa
dengan browser sungguhan terhadap Supabase tiruan.

Belum bisa diuji dari sini: beban nyata terhadap Supabase dan Vercel milik Anda (batas laju sebenarnya bergantung
pada paket dan konfigurasi proyek Anda). Karena itu gladi resik di bagian 5 penting.
