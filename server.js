// server.js
// Portal Kampus Fiktif - Aplikasi LATIHAN keamanan aplikasi web.
// Seluruh akun & data adalah SINTETIS. Jangan dipakai dengan data nyata,
// dan jangan di-deploy ke internet publik.
//
// Aplikasi ini SENGAJA mengandung 2 kerentanan untuk bahan latihan:
//   1) SQL Injection pada form login       -> lihat route POST /login
//   2) Stored XSS pada Forum Diskusi       -> lihat route POST /forum
// Setiap lokasi vulnerable diberi komentar "VULNERABLE (disengaja)".

const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const multer = require('multer');

const { getDb, initSchema } = require('./db/init');
const { seed } = require('./db/seed');

// Pastikan database ada & terisi data sintetis sebelum server jalan
initSchema(getDb());
seed();

const db = getDb();
const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Setup dasar ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: 'latihan-keamanan-portal-kampus-fiktif', // demo only
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 2 },
  })
);

// Buat variabel "user" otomatis tersedia di semua view EJS
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

// ---------- Upload tugas (multer) ----------
const uploadsDir = path.join(__dirname, 'uploads', 'tugas');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.zip', '.png', '.jpg', '.jpeg', '.txt'];
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBase = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .slice(0, 60);
    cb(null, `${Date.now()}_${safeBase}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return cb(new Error('Tipe file tidak diizinkan.'));
    }
    cb(null, true);
  },
});

// ---------- Helper auth ----------
function requireLogin(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.user) return res.redirect('/login');
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).render('error', { message: 'Akses ditolak untuk role Anda.' });
    }
    next();
  };
}

// =====================================================================
// HOME / LOGIN / LOGOUT
// =====================================================================

app.get('/', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const role = req.session.user.role;
  if (role === 'mahasiswa') return res.redirect('/mahasiswa/dashboard');
  if (role === 'dosen') return res.redirect('/dosen/dashboard');
  if (role === 'admin') return res.redirect('/admin/dashboard');
  return res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null, oldUsername: '' });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;

  // =====================================================================
  // VULNERABLE (disengaja): SQL Injection
  //
  // Input "username" dan "password" digabung langsung ke dalam string SQL
  // tanpa parameterized query, dan query inilah yang menentukan hasil
  // autentikasi. Contoh payload bypass login (isi di kolom Username,
  // password boleh diisi bebas):
  //
  //     admin' --
  //     ' OR '1'='1
  //     ' OR username='admin' --
  //
  // PERBAIKAN YANG BENAR: gunakan prepared statement / parameterized query,
  // misalnya dengan better-sqlite3:
  //     db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
  //       .get(username, password)
  // =====================================================================
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;

  let user;
  try {
    user = db.prepare(query).get();
  } catch (err) {
    return res.render('login', {
      error: 'Terjadi kesalahan query: ' + err.message,
      oldUsername: username,
    });
  }

  if (!user) {
    return res.render('login', { error: 'Username atau password salah.', oldUsername: username });
  }

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role,
    nama_lengkap: user.nama_lengkap,
  };
  res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

// =====================================================================
// MAHASISWA
// =====================================================================

app.get('/mahasiswa/dashboard', requireRole('mahasiswa'), (req, res) => {
  res.render('mahasiswa/dashboard');
});

app.get('/mahasiswa/nilai', requireRole('mahasiswa'), (req, res) => {
  const rows = db
    .prepare(
      `SELECT mk.kode, mk.nama AS mk_nama, mk.sks, n.nilai_huruf, n.nilai_angka
       FROM nilai n
       JOIN mata_kuliah mk ON mk.id = n.mata_kuliah_id
       WHERE n.mahasiswa_id = ?
       ORDER BY mk.kode`
    )
    .all(req.session.user.id);
  res.render('mahasiswa/nilai', { rows });
});

app.get('/mahasiswa/tugas', requireRole('mahasiswa'), (req, res) => {
  const tugasList = db
    .prepare(
      `SELECT t.id, t.judul, t.deskripsi, t.deadline, mk.nama AS mk_nama, mk.kode
       FROM tugas t JOIN mata_kuliah mk ON mk.id = t.mata_kuliah_id
       ORDER BY t.deadline`
    )
    .all();

  const submissions = db
    .prepare(`SELECT tugas_id, nama_file, uploaded_at FROM pengumpulan_tugas WHERE mahasiswa_id = ?`)
    .all(req.session.user.id);
  const submittedMap = {};
  for (const s of submissions) submittedMap[s.tugas_id] = s;

  res.render('mahasiswa/tugas', { tugasList, submittedMap, query: req.query });
});

app.post('/mahasiswa/tugas/:id/upload', requireRole('mahasiswa'), (req, res) => {
  upload.single('file_tugas')(req, res, (err) => {
    if (err) {
      return res.redirect(`/mahasiswa/tugas?error=${encodeURIComponent(err.message)}`);
    }
    if (!req.file) {
      return res.redirect('/mahasiswa/tugas?error=File%20tidak%20ditemukan');
    }
    const tugasId = req.params.id;
    db.prepare(
      `INSERT INTO pengumpulan_tugas (tugas_id, mahasiswa_id, nama_file, path_file)
       VALUES (?, ?, ?, ?)`
    ).run(tugasId, req.session.user.id, req.file.originalname, req.file.filename);
    res.redirect('/mahasiswa/tugas?ok=1');
  });
});

// =====================================================================
// FORUM DISKUSI (mahasiswa & dosen)
// =====================================================================

app.get('/forum', requireLogin, (req, res) => {
  const posts = db
    .prepare(
      `SELECT f.id, f.judul, f.isi, f.created_at, u.nama_lengkap, u.role
       FROM forum_post f JOIN users u ON u.id = f.user_id
       ORDER BY f.created_at DESC`
    )
    .all();
  res.render('forum', { posts });
});

app.post('/forum', requireLogin, (req, res) => {
  const { judul, isi } = req.body;
  if (!judul || !isi) return res.redirect('/forum');

  // Disimpan apa adanya (tanpa sanitasi) -> lihat catatan XSS di views/forum.ejs
  db.prepare(`INSERT INTO forum_post (user_id, judul, isi) VALUES (?, ?, ?)`).run(
    req.session.user.id,
    judul,
    isi
  );
  res.redirect('/forum');
});

// =====================================================================
// DOSEN
// =====================================================================

app.get('/dosen/dashboard', requireRole('dosen'), (req, res) => {
  const mataKuliah = db.prepare(`SELECT * FROM mata_kuliah WHERE dosen_id = ?`).all(req.session.user.id);
  res.render('dosen/dashboard', { mataKuliah });
});

app.get('/dosen/nilai', requireRole('dosen'), (req, res) => {
  const mataKuliah = db.prepare(`SELECT * FROM mata_kuliah WHERE dosen_id = ?`).all(req.session.user.id);
  const mahasiswa = db
    .prepare(
      `SELECT u.id, u.nama_lengkap, mp.nim FROM users u
       JOIN mahasiswa_profile mp ON mp.user_id = u.id
       WHERE u.role = 'mahasiswa' ORDER BY mp.nim`
    )
    .all();
  const nilaiRows = db
    .prepare(
      `SELECT n.mahasiswa_id, n.mata_kuliah_id, n.nilai_huruf, n.nilai_angka
       FROM nilai n JOIN mata_kuliah mk ON mk.id = n.mata_kuliah_id
       WHERE mk.dosen_id = ?`
    )
    .all(req.session.user.id);

  const nilaiMap = {};
  for (const n of nilaiRows) nilaiMap[`${n.mahasiswa_id}_${n.mata_kuliah_id}`] = n;

  res.render('dosen/nilai', { mataKuliah, mahasiswa, nilaiMap, query: req.query });
});

app.post('/dosen/nilai/update', requireRole('dosen'), (req, res) => {
  const { mahasiswa_id, mata_kuliah_id, nilai_huruf, nilai_angka } = req.body;

  // Pastikan dosen hanya boleh mengubah nilai mata kuliah yang dia ampu
  const mk = db
    .prepare(`SELECT * FROM mata_kuliah WHERE id = ? AND dosen_id = ?`)
    .get(mata_kuliah_id, req.session.user.id);
  if (!mk) {
    return res.status(403).render('error', { message: 'Anda tidak mengampu mata kuliah ini.' });
  }

  const existing = db
    .prepare(`SELECT id FROM nilai WHERE mahasiswa_id = ? AND mata_kuliah_id = ?`)
    .get(mahasiswa_id, mata_kuliah_id);

  if (existing) {
    db.prepare(
      `UPDATE nilai SET nilai_huruf = ?, nilai_angka = ?, diupdate_oleh = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(nilai_huruf, nilai_angka, req.session.user.id, existing.id);
  } else {
    db.prepare(
      `INSERT INTO nilai (mahasiswa_id, mata_kuliah_id, nilai_huruf, nilai_angka, diupdate_oleh)
       VALUES (?, ?, ?, ?, ?)`
    ).run(mahasiswa_id, mata_kuliah_id, nilai_huruf, nilai_angka, req.session.user.id);
  }

  res.redirect('/dosen/nilai?ok=1');
});

app.get('/dosen/tugas', requireRole('dosen'), (req, res) => {
  const mataKuliah = db.prepare(`SELECT * FROM mata_kuliah WHERE dosen_id = ?`).all(req.session.user.id);
  const tugasList = db
    .prepare(
      `SELECT t.*, mk.nama AS mk_nama FROM tugas t
       JOIN mata_kuliah mk ON mk.id = t.mata_kuliah_id
       WHERE mk.dosen_id = ? ORDER BY t.deadline`
    )
    .all(req.session.user.id);

  const submissionsByTugas = {};
  for (const t of tugasList) {
    submissionsByTugas[t.id] = db
      .prepare(
        `SELECT p.*, u.nama_lengkap, mp.nim FROM pengumpulan_tugas p
         JOIN users u ON u.id = p.mahasiswa_id
         JOIN mahasiswa_profile mp ON mp.user_id = u.id
         WHERE p.tugas_id = ? ORDER BY p.uploaded_at DESC`
      )
      .all(t.id);
  }

  res.render('dosen/tugas', { mataKuliah, tugasList, submissionsByTugas, query: req.query });
});

app.post('/dosen/tugas/create', requireRole('dosen'), (req, res) => {
  const { mata_kuliah_id, judul, deskripsi, deadline } = req.body;
  const mk = db
    .prepare(`SELECT * FROM mata_kuliah WHERE id = ? AND dosen_id = ?`)
    .get(mata_kuliah_id, req.session.user.id);
  if (!mk) {
    return res.status(403).render('error', { message: 'Anda tidak mengampu mata kuliah ini.' });
  }
  db.prepare(
    `INSERT INTO tugas (mata_kuliah_id, judul, deskripsi, deadline, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?)`
  ).run(mata_kuliah_id, judul, deskripsi, deadline, req.session.user.id);
  res.redirect('/dosen/tugas?ok=1');
});

// =====================================================================
// ADMIN
// =====================================================================

app.get('/admin/dashboard', requireRole('admin'), (req, res) => {
  const counts = {
    mahasiswa: db.prepare(`SELECT COUNT(*) c FROM users WHERE role='mahasiswa'`).get().c,
    dosen: db.prepare(`SELECT COUNT(*) c FROM users WHERE role='dosen'`).get().c,
    admin: db.prepare(`SELECT COUNT(*) c FROM users WHERE role='admin'`).get().c,
  };
  res.render('admin/dashboard', { counts });
});

app.get('/admin/users', requireRole('admin'), (req, res) => {
  const users = db.prepare(`SELECT id, username, role, nama_lengkap, email, created_at FROM users ORDER BY id`).all();
  res.render('admin/users', { users, query: req.query });
});

app.post('/admin/users/create', requireRole('admin'), (req, res) => {
  const { username, password, role, nama_lengkap, email } = req.body;
  try {
    db.prepare(
      `INSERT INTO users (username, password, role, nama_lengkap, email) VALUES (?, ?, ?, ?, ?)`
    ).run(username, password, role, nama_lengkap, email || null);
    res.redirect('/admin/users?ok=1');
  } catch (err) {
    res.redirect(`/admin/users?error=${encodeURIComponent(err.message)}`);
  }
});

app.post('/admin/users/:id/delete', requireRole('admin'), (req, res) => {
  const id = req.params.id;
  if (Number(id) === req.session.user.id) {
    return res.redirect('/admin/users?error=Tidak%20bisa%20menghapus%20akun%20sendiri');
  }
  db.prepare(`DELETE FROM users WHERE id = ?`).run(id);
  res.redirect('/admin/users?ok=1');
});

app.post('/admin/users/:id/reset-password', requireRole('admin'), (req, res) => {
  const id = req.params.id;
  const { new_password } = req.body;
  db.prepare(`UPDATE users SET password = ? WHERE id = ?`).run(new_password, id);
  res.redirect('/admin/users?ok=1');
});

// =====================================================================
// 404 & error handler
// =====================================================================
app.use((req, res) => {
  res.status(404).render('error', { message: 'Halaman tidak ditemukan.' });
});

app.listen(PORT, () => {
  console.log('');
  console.log(`Portal Kampus Fiktif (latihan) berjalan di: http://localhost:${PORT}`);
  console.log('Tekan Ctrl+C untuk menghentikan server.');
});
