# MIJ ERP - Sistem Cloud ERP Berbasis Cloudflare Pages & D1

Sistem ERP modern yang dibangun menggunakan **Astro (SSR)**, dideploy di **Cloudflare Pages**, memanfaatkan **Cloudflare D1 Database** untuk data relasional, dan **Google Drive API** untuk penyimpanan video/foto pengerjaan klien.

---

## 🛠️ Arsitektur Teknologi
1. **Frontend & Backend API**: Astro SSR (@astrojs/cloudflare)
2. **Database**: Cloudflare D1 (SQLite serverless)
3. **Penyimpanan Berkas**: Google Drive API (via Service Account)
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
npx wrangler d1 migrations apply erp_db --local
```

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
| `npx wrangler d1 migrations apply erp_db --local` | Menjalankan migrasi database lokal |

---

## 🚀 Panduan Deployment Produksi (Cloudflare Pages)

Sistem ini didesain khusus untuk berjalan secara otomatis menggunakan **Git Integration** pada Cloudflare Pages.

### 1. Buat Database D1 di Cloudflare
- Buka dashboard Cloudflare > **Storage & databases** > **D1**.
- Buat database baru bernama `erp_db`.
- Masuk ke tab **Console** database tersebut, lalu jalankan query SQL berikut untuk membuat tabel dan user demo:
  ```sql
  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT CHECK(role IN ('client', 'prof', 'admin')) NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL, video_url TEXT, image_url TEXT, status TEXT CHECK(status IN ('proses', 'review', 'selesai')) DEFAULT 'proses' NOT NULL, conclusion TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE);
  INSERT OR IGNORE INTO users (id, code, name, role) VALUES ('client-1', 'CLIENT123', 'Mij Digital Client', 'client'), ('prof-1', 'PROF123', 'Mij Professional Tech', 'prof'), ('admin-1', 'ADMIN123', 'Mij Main Admin', 'admin');
  ```

### 2. Konfigurasi Proyek Cloudflare Pages
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

### 3. Sambungkan Subdomain (`erp.mijdigital.my`)
- Buka tab **Custom Domains** di proyek Pages Anda.
- Klik **Set up a custom domain** > masukkan `erp.mijdigital.my` > pilih metode **My DNS provider**.
- Buka **cPanel Zone Editor** GBNetwork Anda, lalu tambahkan record CNAME untuk subdomain `erp` yang mengarah ke `erp-mij.pages.dev` (atau domain default Pages Anda).
