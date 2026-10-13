-- Migrasi 03: perkuatan keamanan dan kinerja.
-- Jalankan di Supabase > SQL Editor. Aman dijalankan berulang kali.
-- Tidak mengubah aturan jumlah anggota kelompok di daftar_slot (biarkan sesuai yang sudah Anda pakai).

-- 1) Akun hanya boleh lahir dari admin ------------------------------------------------------------------
-- Sebelumnya trigger ini menautkan akun baru ke baris mahasiswa berdasarkan email NIM (nim@student...).
-- Selama pendaftaran mandiri (sign-up) Supabase Auth aktif, siapa pun yang tahu NIM bisa membuat akun lebih
-- dulu daripada ketuanya dan menguasai barisnya.
--
-- Cara kerja sekarang: sebelum membuat akun, server (kunci rahasia) mencatat IZIN singkat (60 detik) untuk NIM itu
-- di tabel izin_akun. Trigger hanya menerima akun baru bila izinnya ada dan belum kedaluwarsa, lalu menghapus
-- izin itu (sekali pakai). Tabel izin_akun tidak bisa diakses anon maupun pengguna login; hanya service_role.
--
-- CATATAN: versi migrasi ini yang lama memeriksa tanda app_metadata.dibuat_admin. Itu keliru: Supabase Auth baru
-- mengisi app_metadata SESUDAH baris user dimasukkan, sehingga trigger selalu menolak dan pembuatan akun gagal
-- dengan "Database error creating new user". Menjalankan ulang file ini memperbaikinya.
create table if not exists izin_akun (
  nim text primary key,
  sampai timestamptz not null
);
alter table izin_akun enable row level security;  -- tanpa policy: tidak ada akses lewat API selain service_role
revoke all on izin_akun from anon, authenticated;
delete from izin_akun where sampai < now();

create or replace function tautkan_akun() returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nim text := lower(split_part(new.email, '@', 1));
begin
  if not exists (select 1 from izin_akun where nim = v_nim and sampai > now()) then
    raise exception 'Akun hanya dapat dibuat oleh admin';
  end if;
  update mahasiswa set user_id = new.id where lower(nim) = v_nim and user_id is null;
  if not found then raise exception 'NIM belum didaftarkan admin atau akun sudah ada'; end if;
  delete from izin_akun where nim = v_nim;
  return new;
end $$;

-- 2) Hak akses: pengunjung tanpa login (anon) tidak boleh menyentuh apa pun ------------------------------
-- Supabase memberi hak penuh ke anon secara bawaan. Tabel sudah terlindungi RLS, tetapi view slot_terisi
-- tidak, jadi sebelumnya kuota bisa dibaca siapa saja dengan anon key. Fungsi juga bisa dipanggil publik.
revoke all on all tables in schema public from anon;
grant select on slot_terisi to authenticated;

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig, p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('daftar_slot', 'batal_daftar', 'jadikan_ketua', 'is_admin', 'kelompok_saya', 'tautkan_akun', 'jaga_kuota')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname in ('tautkan_akun', 'jaga_kuota') then
      -- fungsi trigger: tidak perlu bisa dipanggil langsung oleh siapa pun
      execute format('revoke execute on function %s from authenticated', f.sig);
    else
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;

-- 3) Indeks untuk query yang dipakai tiap kali halaman dimuat dan tiap kali kuota dihitung -----------------
create index if not exists mahasiswa_kelompok_id_idx on mahasiswa (kelompok_id);
create index if not exists pendaftaran_slot_id_idx on pendaftaran (slot_id);

-- 4) Muat ulang cache skema PostgREST agar tabel baru (izin_akun) langsung dikenali API ------------------------
notify pgrst, 'reload schema';
