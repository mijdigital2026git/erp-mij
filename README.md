# MIJ ERP - Sistem Cloud ERP Berbasis Cloudflare Pages & D1

Sistem ERP modern yang dibangun menggunakan **Astro (SSR)**, dideploy di **Cloudflare Pages**, memanfaatkan **Cloudflare D1 Database** untuk data relasional, dan **Google Drive API** untuk penyimpanan video/foto pengerjaan klien.

---

## 🛠️ Arsitektur Teknologi
1. **Frontend & Backend API**: Astro SSR (@astrojs/cloudflare)
2. **Database**: Cloudflare D1 (SQLite serverless)
3. **Penyimpanan Berkas**: Google Drive API (via Service Account / Refresh Token)
4. **Hosting & SSL**: Cloudflare Pages + CNAME DNS kustom

---

## 💻 Pengembangan Lokal (Local Development)

### 1. Persiapan Dependensi
Instal semua paket dependensi Node.js:
```sh
npm install
```

### 2. Konfigurasi Kredensial & Environment Variables
Buat file `.env` di root folder proyek Anda dengan isi sebagai berikut:
```env
GOOGLE_CLIENT_EMAIL="email-service-account-anda"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
GOOGLE_DRIVE_FOLDER_ID="id-folder-google-drive-tujuan"
```
*Catatan: Pastikan folder Google Drive Anda sudah dibagikan (share) ke email Service Account tersebut dengan hak akses **Editor**.*

### 3. Migrasi Database Lokal
Terapkan skema database lokal untuk emulator D1:
```sh
npm run db:migrate:local
```
*Catatan: Jika database lokal mengalami error seperti `duplicate column name`, Anda dapat mereset database lokal dengan menjalankan `rm -rf .wrangler/state/v3/d1` kemudian jalankan kembali perintah migrasi di atas.*

### 4. Jalankan Server Dev Lokal
Jalankan server lokal berbasis Astro dev:
```sh
npm run dev
```
Akses sistem di browser Anda melalui alamat: `http://localhost:4321`

---

## 🧞 Perintah Penting (Commands)

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server dev lokal |
| `npm run build` | Mengompilasi proyek Astro & memaketkan `_worker.js` untuk Cloudflare Pages |
| `npm run preview` | Meninjau hasil kompilasi (preview) secara lokal |
| `npm run db:migrate:local` | Menjalankan seluruh file migrasi SQL ke database D1 lokal |
| `npm run db:migrate:remote` | Menjalankan seluruh file migrasi SQL ke database D1 Remote Cloudflare |

---

## 🚀 Panduan Deployment Produksi & Migrasi Database Cloudflare D1

Sistem ini didesain khusus untuk berjalan secara otomatis menggunakan **Git Integration** pada Cloudflare Pages.

### 1. Inisialisasi Database D1 di Cloudflare
- Buka dashboard Cloudflare > **Storage & databases** > **D1**.
- Buat database baru bernama `erp_db`.

### 2. Cara Migrasi Database Remote (Production)

#### Cara A: Menggunakan CLI (Jika IP Aman/Tidak Terblokir)
Jalankan perintah berikut di terminal Anda:
```sh
npm run db:migrate:remote
```

#### Cara B: Menggunakan Cloudflare Web D1 Console (Solusi jika Terkena Bot Challenge / 403 Forbidden)
Jika IP VPS atau koneksi Anda diblokir oleh anti-bot Cloudflare saat menjalankan perintah CLI di atas, Anda dapat menerapkan migrasi secara manual:
1. Buka dashboard Cloudflare > **Storage & databases** > **D1** > klik database **`erp_db`** Anda.
2. Buka tab **Console**.
3. Jalankan query SQL berikut secara bertahap atau sekaligus untuk membuat tabel awal dan menyuntikkan user default (jika baru diinisialisasi):
   ```sql
   -- Pembuatan Tabel Awal & Seed Users
   CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT CHECK(role IN ('client', 'prof', 'admin')) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
   CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, video_url TEXT, image_url TEXT, status TEXT CHECK(status IN ('proses', 'review', 'selesai')) DEFAULT 'proses' NOT NULL, conclusion TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE);
   INSERT OR IGNORE INTO users (id, code, name, role) VALUES ('client-1', 'CLIENT123', 'Mij Digital Client', 'client'), ('prof-1', 'PROF123', 'Mij Professional Tech', 'prof'), ('admin-1', 'ADMIN123', 'Mij Main Admin', 'admin');
   ```
4. Jalankan query `ALTER TABLE` berikut untuk menerapkan migrasi kolom-kolom baru:
   ```sql
   -- Penambahan Kolom Project & Penugasan
   ALTER TABLE users ADD COLUMN project_name TEXT;
   ALTER TABLE users ADD COLUMN project_deadline_date TEXT;
   ALTER TABLE users ADD COLUMN project_deadline_time TEXT;
   ALTER TABLE users ADD COLUMN contact TEXT;
   ALTER TABLE users ADD COLUMN project_info TEXT;

   -- Penambahan Kolom Judul Tugas
   ALTER TABLE tasks ADD COLUMN title TEXT;
   ```
5. Jalankan query pembuatan tabel session untuk sistem login:
   ```sql
   -- Pembuatan Tabel Sesi Pengguna
   CREATE TABLE IF NOT EXISTS user_sessions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     token TEXT NOT NULL UNIQUE,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );
   ```

### 3. Konfigurasi Proyek Cloudflare Pages
- Buat proyek Pages baru di Cloudflare dengan menghubungkan repositori GitHub Anda.
- Di pengaturan proyek Pages, atur sebagai berikut:
  - **Framework preset**: `Astro`
  - **Build command**: `npm run build`
  - **Build output directory**: `dist`
- Di bawah tab **Settings** > **Environment variables**, tambahkan:
  - `GOOGLE_CLIENT_EMAIL`
  - `GOOGLE_PRIVATE_KEY`
  - `GOOGLE_DRIVE_FOLDER_ID`
- Di bawah tab **Settings** > **Functions** > **D1 database bindings**:
  - Hubungkan database `DB` (Variable name) ke database D1 `erp_db` Anda.
- Di bawah tab **Settings** > **Functions** > **Compatibility flags**:
  - Tambahkan flag `nodejs_compat`.

### 4. Sambungkan Subdomain (`erp.mijdigital.my`)
- Buka tab **Custom Domains** di proyek Pages Anda.
- Klik **Set up a custom domain** > masukkan `erp.mijdigital.my` > pilih metode **My DNS provider**.
- Buka **cPanel Zone Editor** GBNetwork Anda, lalu tambahkan record CNAME untuk subdomain `erp` yang mengarah ke `erp-mij.pages.dev` (atau domain default Pages Anda).
