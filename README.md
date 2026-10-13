# Portal Kampus Fiktif — Aplikasi Latihan Keamanan Web

Aplikasi web portal kampus **fiktif** untuk latihan/tugas keamanan aplikasi. Seluruh akun dan
data (nama mahasiswa, dosen, NIM, NIP, nilai, dsb.) bersifat **sintetis** — tidak ada yang
merepresentasikan orang atau institusi nyata.

> ⚠️ **PERINGATAN**: Aplikasi ini **sengaja dibuat rentan** untuk keperluan pembelajaran.
> Jangan deploy ke internet publik, jangan pakai dengan data asli/nyata, dan jangan pakai pola
> kodenya sebagai contoh best practice.

## Fitur

| Role | Fitur |
|---|---|
| **Mahasiswa** | Login, lihat nilai, unggah tugas, berdiskusi di forum |
| **Dosen** | Login, input/ubah nilai mahasiswa, buat tugas, lihat pengumpulan tugas, berdiskusi di forum |
| **Admin** | Login, kelola akun (tambah/hapus/reset password) |

## Teknologi

- Node.js + Express
- EJS (server-side rendering) + Bootstrap 5 (CDN)
- SQLite lewat modul bawaan Node.js **`node:sqlite`** — database file lokal, **tidak perlu
  instalasi server DB terpisah dan tidak perlu kompilasi native module apapun** (jadi tidak
  akan terkendala `node-gyp`/Visual Studio Build Tools di Windows). Modul ini tersedia built-in
  mulai Node.js v22.5, jadi tidak muncul sebagai dependency di `package.json`.
- Multer — untuk upload file tugas

> Catatan: saat server pertama kali start, Node mungkin menampilkan baris kuning
> `ExperimentalWarning: SQLite is an experimental feature...`. Itu **bukan error**, hanya
> peringatan dari Node bahwa `node:sqlite` masih berstatus eksperimental — aplikasi tetap
> berjalan normal. Menjalankan lewat `npm start` (bukan `node server.js` langsung) akan
> menyembunyikan peringatan ini.

---

## 🚀 Cara Menjalankan di VSCode (Step by Step)

### 1. Prasyarat
- Install **Node.js versi 22.5 ke atas** (disarankan versi LTS terbaru) dari https://nodejs.org
  — cek versi dengan `node -v` di terminal. Modul `node:sqlite` yang dipakai aplikasi ini butuh
  minimal Node v22.5.
- Install **Visual Studio Code** dari https://code.visualstudio.com
- Koneksi internet (untuk `npm install` pertama kali, dan untuk memuat Bootstrap dari CDN)
- **Tidak perlu XAMPP, MySQL, atau software database apapun** — aplikasi ini tidak pakai PHP
  maupun MySQL, semua database jalan otomatis lewat SQLite bawaan Node.js.

### 2. Ekstrak & buka project
1. Ekstrak file `campus-portal-vuln-demo.zip` ke folder pilihan Anda.
2. Buka **VSCode** → `File` → `Open Folder...` → pilih folder hasil ekstrak
   (`campus-portal-vuln-demo`).

### 3. Install dependency
Buka terminal di VSCode (`Terminal` → `New Terminal`), lalu jalankan:

```bash
npm install
```

Tunggu sampai proses selesai (akan membuat folder `node_modules/`).

### 4. Jalankan aplikasi

```bash
npm start
```

Jika berhasil, akan muncul pesan:

```
Portal Kampus Fiktif (latihan) berjalan di: http://localhost:3000
```

Database SQLite (`db/campus.db`) dan data sintetis akan **dibuat otomatis** saat pertama kali
dijalankan (lewat `db/seed.js`), jadi Anda tidak perlu setup database manual.

### 5. Buka di browser

Buka **http://localhost:3000** di browser.

### 6. Login dengan akun demo

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `Admin#2026` |
| Dosen | `dosen.sari` | `Dosen#2026` |
| Dosen | `dosen.bayu` | `Dosen#2026` |
| Mahasiswa | `mhs.andi` | `Mhs#2026` |
| Mahasiswa | `mhs.putri` | `Mhs#2026` |
| Mahasiswa | `mhs.rizky` | `Mhs#2026` |
| Mahasiswa | `mhs.dewi` | `Mhs#2026` |

### 7. Menghentikan server
Tekan `Ctrl + C` di terminal VSCode.

### 8. Reset data (opsional)
Untuk mengembalikan data ke kondisi awal, hapus file database lalu jalankan ulang:

```bash
rm db/campus.db        # di Windows: del db\campus.db
npm start
```

---

## 🔓 Kerentanan yang Disengaja (untuk Tugas Latihan)

Sesuai instruksi tugas, aplikasi ini memuat **2 kerentanan yang dibuat secara sengaja**:

### 1. SQL Injection — pada Form Login

**Lokasi kode:** `server.js`, route `POST /login`

Input `username` dan `password` digabung langsung ke string query SQL tanpa parameterized
query/prepared statement, dan query tersebut yang menentukan hasil login:

```js
const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
user = db.prepare(query).get();
```

**Cara demo (bypass login tanpa tahu password):**
1. Buka halaman **/login**
2. Isi kolom **Username** dengan salah satu payload berikut (kolom password boleh diisi bebas):
   - `admin' --`
   - `' OR '1'='1`
   - `' OR username='admin' --`
3. Klik **Masuk** → Anda akan langsung masuk sebagai user pertama yang cocok (umumnya akun
   `admin`) tanpa mengetahui passwordnya.

**Dampak:** bypass autentikasi total, penyerang bisa login sebagai user manapun (termasuk
admin) tanpa kredensial yang valid.

**Perbaikan yang benar:**
- Gunakan **parameterized query / prepared statement**, contoh dengan `better-sqlite3`:
  ```js
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
                 .get(username, password);
  ```
- Jangan pernah menyimpan password sebagai plaintext — gunakan hashing (mis. `bcrypt`) dan
  bandingkan dengan `bcrypt.compare()` di sisi aplikasi, bukan di dalam query SQL.

### 2. Stored XSS — pada Forum Diskusi

**Lokasi kode:** `views/forum.ejs` (output `<%- p.isi %>` yang tidak di-escape) dan
`server.js` route `POST /forum` (input disimpan apa adanya tanpa sanitasi).

```ejs
<div class="isi"><%- p.isi %></div>
```

Tag EJS `<%- %>` menampilkan output **tanpa HTML-escaping**, sehingga HTML/JavaScript yang
dikirim lewat form "Buat Diskusi Baru" akan tersimpan ke database dan **dieksekusi langsung**
di browser setiap pengguna lain yang membuka halaman forum.

**Cara demo:**
1. Login dengan akun apa saja (mis. `mhs.andi`)
2. Buka halaman **/forum**
3. Pada form "Buat Diskusi Baru", isi kolom **isi** dengan salah satu payload berikut:
   - `<script>alert('Stored XSS oleh ' + document.cookie)</script>`
   - `<img src=x onerror="alert('XSS!')">`
4. Klik **Kirim** → setiap kali halaman `/forum` dibuka (oleh akun manapun, termasuk dosen/
   admin), script tersebut akan otomatis tereksekusi di browser mereka.

**Dampak:** pencurian session cookie, defacement halaman, phishing di dalam aplikasi, aksi atas
nama korban (jika dikombinasikan dengan CSRF), dsb.

**Perbaikan yang benar:**
- Gunakan output yang **di-escape** secara default, yaitu tag EJS `<%= %>` (bukan `<%- %>`),
  yang otomatis meng-escape karakter HTML seperti `<`, `>`, `"`.
- Jika memang butuh merender sebagian HTML (mis. formatting teks), gunakan library sanitasi
  seperti `sanitize-html` atau `DOMPurify` dengan **allowlist** tag yang ketat sebelum
  ditampilkan/disimpan.
- Tambahkan `Content-Security-Policy` header sebagai lapisan pertahanan tambahan (defense in
  depth).

---

## Struktur Folder

```
campus-portal-vuln-demo/
├── server.js              # Entry point aplikasi + semua route
├── package.json
├── db/
│   ├── init.js             # Skema database SQLite
│   ├── seed.js             # Data sintetis (akun, nilai, tugas, forum)
│   └── campus.db           # (dibuat otomatis saat pertama run)
├── views/                  # Template EJS
│   ├── login.ejs
│   ├── forum.ejs           # <- lokasi Stored XSS
│   ├── mahasiswa/
│   ├── dosen/
│   ├── admin/
│   └── partials/
├── public/css/style.css
└── uploads/tugas/          # File tugas yang diunggah mahasiswa
```

## 🔧 Troubleshooting

**`localhost:3000` / `ERR_CONNECTION_REFUSED`**
Artinya server Node belum/gagal berjalan. Lihat tab **Terminal** di VSCode, baca pesan error
paling atas (biasanya muncul tepat setelah `npm start`). Perbaiki errornya dulu, baru buka lagi
browser-nya — bukan masalah di browser/koneksi.

**`Cannot find module 'node:sqlite'` atau fitur SQLite tidak dikenali**
Berarti versi Node.js Anda terlalu lama. Cek dengan `node -v` — pastikan minimal v22.5.
Update Node.js dari https://nodejs.org (pilih versi LTS terbaru), lalu jalankan lagi
`npm install` dan `npm start`.

**Error terkait `node-gyp`, `bindings.js`, atau "Could not locate the bindings file"**
Ini adalah error versi lama project (saat masih memakai `better-sqlite3`, yang butuh kompilasi
native dan sering gagal di Windows tanpa Build Tools terpasang). Pastikan Anda memakai file ZIP
**versi terbaru** — buka `package.json`, dependency `better-sqlite3` seharusnya **tidak ada**
lagi di sana. Jika masih ada, Anda membuka folder project yang lama/salah.

**Port 3000 sudah dipakai aplikasi lain**
Jalankan dengan port berbeda, misalnya di terminal VSCode:
```bash
# Windows (cmd)
set PORT=4000 && npm start
# Windows (PowerShell)
$env:PORT=4000; npm start
# macOS/Linux
PORT=4000 npm start
```
Lalu buka `http://localhost:4000`.

## Catatan Tambahan

- Repo tugas (untuk submit): sesuaikan dengan link repo GitHub publik Anda sendiri saat
  mengunggah project ini (push folder ini ke repo GitHub Anda, lalu isi link repo & link
  deploy/URL pada form tugas).
- Jangan commit folder `node_modules/` ke Git (sudah diatur lewat `.gitignore`).
- Jika ingin mendemokan ulang dari kondisi bersih, hapus `db/campus.db` dan isi folder
  `uploads/tugas/` lalu jalankan `npm start` lagi.
