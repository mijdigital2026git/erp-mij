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
3. Jalankan query SQL berikut untuk membuat seluruh tabel dengan skema terbaru (termasuk fitur multi-proyek, riwayat story, status proyek, dan relasi tugas):
   ```sql
   -- 1. Pembuatan Tabel Users (Klien / Admin)
   CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY, 
     code TEXT UNIQUE NOT NULL, 
     name TEXT NOT NULL, 
     role TEXT CHECK(role IN ('client', 'prof', 'admin')) NOT NULL, 
     project_name TEXT,
     project_deadline_date TEXT,
     project_deadline_time TEXT,
     contact TEXT,
     project_info TEXT,
     project_status TEXT DEFAULT 'aktif',
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP
   );

   -- 2. Pembuatan Tabel Projects (Multi-Project)
   CREATE TABLE IF NOT EXISTS projects (
     id TEXT PRIMARY KEY,
     client_id TEXT NOT NULL,
     name TEXT NOT NULL,
     deadline_date TEXT,
     deadline_time TEXT,
     contact TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE
   );

   -- 3. Pembuatan Tabel Project Updates (Pengumuman & Sprint Updates)
   CREATE TABLE IF NOT EXISTS project_updates (
     id TEXT PRIMARY KEY,
     client_id TEXT NOT NULL,
     project_id TEXT,
     title TEXT NOT NULL,
     content TEXT NOT NULL,
     images TEXT, -- Menyimpan JSON array berisi list file URL
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
   );

   -- 4. Pembuatan Tabel Tasks (Complaint / Pekerjaan)
   CREATE TABLE IF NOT EXISTS tasks (
     id TEXT PRIMARY KEY, 
     client_id TEXT NOT NULL, 
     project_id TEXT,
     category TEXT NOT NULL, 
     description TEXT NOT NULL, 
     video_url TEXT, 
     image_url TEXT, 
     status TEXT CHECK(status IN ('proses', 'review', 'selesai')) DEFAULT 'proses' NOT NULL, 
     conclusion TEXT, 
     parent_task_id TEXT,
     story TEXT,
     project_update_id TEXT,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, 
     FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
     FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
     FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
     FOREIGN KEY (project_update_id) REFERENCES project_updates(id) ON DELETE SET NULL
   );

   -- 5. Pembuatan Tabel User Sessions (Sistem Login Cookie)
   CREATE TABLE IF NOT EXISTS user_sessions (
     id TEXT PRIMARY KEY,
     user_id TEXT NOT NULL,
     token TEXT NOT NULL UNIQUE,
     created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
   );

   -- 6. Suntik Data Akun Default Awal
   INSERT OR IGNORE INTO users (id, code, name, role) VALUES 
     ('client-1', 'CLIENT123', 'Mij Digital Client', 'client'), 
     ('prof-1', 'PROF123', 'Mij Professional Tech', 'prof'), 
     ('admin-1', 'ADMIN123', 'Mij Main Admin', 'admin');
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

---

## 📌 Aturan Penting & Panduan Alur Kerja VPS

### 1. Aturan Push ke GitHub
> ⚠️ **PENTING**: Jangan melakukan `git push` ke GitHub secara otomatis. Lakukan `git push` **HANYA JIKA diminta secara eksplisit oleh Pengguna**.

### 2. Menjalankan Server Dev Realtime di VPS
Untuk melihat dan mengedit tampilan secara *real-time* dari VPS di browser:
```sh
npm run dev -- --host 0.0.0.0 --port 4321
```
Atau menggunakan emulator Wrangler Cloudflare D1 lokal:
```sh
npx wrangler dev --host 0.0.0.0 --port 8787
```
Buka di browser via: `http://<IP_VPS_ANDA>:4321` atau `http://<IP_VPS_ANDA>:8787`

### 3. Migrasi Database Cloudflare D1
Database dapat dimigrasi kapan saja menggunakan file SQL di folder `migrations/`:
* **Migrasi Database Lokal (Dev)**:
  ```sh
  npm run db:migrate:local
  ```
* **Migrasi Database Production (Cloudflare D1 Remote)**:
  ```sh
  npm run db:migrate:remote
  ```
* **Metode Manual (Cloudflare Console)**: Masuk ke Dashboard Cloudflare > D1 > `erp_db` > Console, lalu paste query SQL dari folder `migrations/`.

