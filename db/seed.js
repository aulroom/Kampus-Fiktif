// db/seed.js
// Mengisi database dengan akun & data SINTETIS (fiktif) untuk latihan.
// Jalankan: npm run seed  (otomatis juga dipanggil saat server.js pertama kali start
// jika database belum ada / masih kosong)
//
// CATATAN: password sengaja disimpan plaintext (lihat db/init.js) sebagai bagian
// dari skenario latihan SQL Injection pada form login. JANGAN TIRU pola ini
// di aplikasi nyata.

const path = require('path');
const fs = require('fs');
const { getDb, initSchema, DB_PATH } = require('./init');

function seed() {
  const db = getDb();
  initSchema(db);

  const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (userCount > 0) {
    console.log('[seed] Database sudah berisi data, seed dilewati.');
    db.close();
    return;
  }

  console.log('[seed] Mengisi data sintetis...');

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, role, nama_lengkap, email)
    VALUES (?, ?, ?, ?, ?)
  `);

  // ---- ADMIN ----
  insertUser.run(
    'admin',
    'Admin#2026',
    'admin',
    'Rangga Saputra (Admin Sistem)',
    'admin.sistem@kampusfiktif.ac.id'
  );

  // ---- DOSEN (sintetis) ----
  const dosenData = [
    { username: 'dosen.sari', pw: 'Dosen#2026', nama: 'Dr. Sari Wulandari, M.Kom.', nip: '198501012010012001', bidang: 'Rekayasa Perangkat Lunak' },
    { username: 'dosen.bayu', pw: 'Dosen#2026', nama: 'Bayu Pratama, S.T., M.T.', nip: '198803152012031002', bidang: 'Jaringan Komputer' },
  ];
  const insertDosenProfile = db.prepare(`INSERT INTO dosen_profile (user_id, nip, bidang_keahlian) VALUES (?, ?, ?)`);
  const dosenIds = {};
  for (const d of dosenData) {
    const id = insertUser.run(d.username, d.pw, 'dosen', d.nama, `${d.username}@kampusfiktif.ac.id`).lastInsertRowid;
    insertDosenProfile.run(id, d.nip, d.bidang);
    dosenIds[d.username] = id;
  }

  // ---- MATA KULIAH ----
  const insertMk = db.prepare(`INSERT INTO mata_kuliah (kode, nama, sks, dosen_id) VALUES (?, ?, ?, ?)`);
  const mkWebId = insertMk.run('IF301', 'Pemrograman Web', 3, dosenIds['dosen.sari']).lastInsertRowid;
  const mkJarkomId = insertMk.run('IF302', 'Jaringan Komputer', 3, dosenIds['dosen.bayu']).lastInsertRowid;
  const mkBasdatId = insertMk.run('IF303', 'Basis Data', 3, dosenIds['dosen.sari']).lastInsertRowid;

  // ---- MAHASISWA (sintetis) ----
  const mhsData = [
    { username: 'mhs.andi', pw: 'Mhs#2026', nama: 'Andi Firmansyah', nim: '2301010001', prodi: 'D4 Teknik Informatika', semester: 5 },
    { username: 'mhs.putri', pw: 'Mhs#2026', nama: 'Putri Ayu Lestari', nim: '2301010002', prodi: 'D4 Teknik Informatika', semester: 5 },
    { username: 'mhs.rizky', pw: 'Mhs#2026', nama: 'Rizky Ramadhan', nim: '2301010003', prodi: 'D4 Teknik Informatika', semester: 5 },
    { username: 'mhs.dewi', pw: 'Mhs#2026', nama: 'Dewi Anggraini', nim: '2301010004', prodi: 'D3 Manajemen Informatika', semester: 3 },
  ];
  const insertMhsProfile = db.prepare(`INSERT INTO mahasiswa_profile (user_id, nim, prodi, semester) VALUES (?, ?, ?, ?)`);
  const mhsIds = [];
  for (const m of mhsData) {
    const id = insertUser.run(m.username, m.pw, 'mahasiswa', m.nama, `${m.username}@mhs.kampusfiktif.ac.id`).lastInsertRowid;
    insertMhsProfile.run(id, m.nim, m.prodi, m.semester);
    mhsIds.push(id);
  }

  // ---- NILAI (sebagian sudah diisi, agar ada contoh data) ----
  const insertNilai = db.prepare(`
    INSERT INTO nilai (mahasiswa_id, mata_kuliah_id, nilai_huruf, nilai_angka, diupdate_oleh)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertNilai.run(mhsIds[0], mkWebId, 'A', 88, dosenIds['dosen.sari']);
  insertNilai.run(mhsIds[1], mkWebId, 'B+', 81, dosenIds['dosen.sari']);
  insertNilai.run(mhsIds[0], mkBasdatId, 'A-', 85, dosenIds['dosen.sari']);
  insertNilai.run(mhsIds[2], mkJarkomId, 'B', 75, dosenIds['dosen.bayu']);

  // ---- TUGAS ----
  const insertTugas = db.prepare(`
    INSERT INTO tugas (mata_kuliah_id, judul, deskripsi, deadline, dibuat_oleh)
    VALUES (?, ?, ?, ?, ?)
  `);
  const tugas1 = insertTugas.run(
    mkWebId,
    'Tugas 1: Membuat Landing Page',
    'Buat landing page sederhana menggunakan HTML & CSS, kumpulkan dalam format .zip atau .pdf laporan.',
    '2026-10-30',
    dosenIds['dosen.sari']
  ).lastInsertRowid;

  insertTugas.run(
    mkBasdatId,
    'Tugas 2: Normalisasi Basis Data',
    'Kerjakan studi kasus normalisasi 1NF-3NF, kumpulkan laporan dalam format PDF.',
    '2026-11-05',
    dosenIds['dosen.sari']
  );

  // Contoh pengumpulan tugas dari mahasiswa Andi
  const uploadsDir = path.join(__dirname, '..', 'uploads', 'tugas');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const contohFile = 'contoh_tugas_andi.txt';
  fs.writeFileSync(path.join(uploadsDir, contohFile), 'Ini adalah contoh file tugas sintetis untuk keperluan latihan.\n');
  db.prepare(`
    INSERT INTO pengumpulan_tugas (tugas_id, mahasiswa_id, nama_file, path_file)
    VALUES (?, ?, ?, ?)
  `).run(tugas1, mhsIds[0], 'tugas_landing_page_andi.txt', contohFile);

  // ---- FORUM DISKUSI (contoh post awal) ----
  const insertForum = db.prepare(`INSERT INTO forum_post (user_id, judul, isi) VALUES (?, ?, ?)`);
  insertForum.run(
    dosenIds['dosen.sari'],
    'Selamat datang di Forum Diskusi Pemrograman Web',
    'Halo semua, silakan gunakan forum ini untuk bertanya seputar materi perkuliahan Pemrograman Web. Semangat belajar!'
  );
  insertForum.run(
    mhsIds[1],
    'Tanya: Deadline Tugas 1',
    'Izin bertanya Bu, apakah deadline Tugas 1 bisa diperpanjang? Terima kasih.'
  );

  console.log('[seed] Selesai. Database dibuat di:', DB_PATH);
  console.log('');
  console.log('=== AKUN DEMO (SEMUA SINTETIS, HANYA UNTUK LATIHAN) ===');
  console.log('Admin  -> username: admin        | password: Admin#2026');
  console.log('Dosen  -> username: dosen.sari    | password: Dosen#2026');
  console.log('Dosen  -> username: dosen.bayu    | password: Dosen#2026');
  console.log('Mhs    -> username: mhs.andi      | password: Mhs#2026');
  console.log('Mhs    -> username: mhs.putri     | password: Mhs#2026');
  console.log('Mhs    -> username: mhs.rizky     | password: Mhs#2026');
  console.log('Mhs    -> username: mhs.dewi      | password: Mhs#2026');
  console.log('========================================================');

  db.close();
}

if (require.main === module) {
  seed();
}

module.exports = { seed };
