// db/init.js
// Membuat skema database SQLite untuk Portal Kampus (Fiktif).
// File ini HANYA membuat tabel. Pengisian data sintetis ada di db/seed.js

const path = require('path');
// Memakai modul SQLite bawaan Node.js (node:sqlite) -> TIDAK butuh kompilasi
// native / build tools apapun, sehingga aman dijalankan di Windows, macOS,
// maupun Linux hanya dengan `npm install`. Tersedia sejak Node.js v22.5+.
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'campus.db');

function getDb() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

function initSchema(db) {
  db.exec(`
    -- CATATAN KEAMANAN (disengaja untuk bahan latihan):
    -- Kolom password di bawah ini menyimpan password dalam bentuk PLAINTEXT,
    -- dan dipakai langsung di dalam query SQL mentah pada proses login
    -- (lihat server.js, route POST /login) sehingga rentan SQL Injection.
    -- Pada aplikasi production, password WAJIB di-hash (mis. bcrypt) dan
    -- SELALU gunakan parameterized query / prepared statement.
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('mahasiswa','dosen','admin')),
      nama_lengkap TEXT NOT NULL,
      email TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mahasiswa_profile (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      nim TEXT UNIQUE NOT NULL,
      prodi TEXT NOT NULL,
      semester INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS dosen_profile (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      nip TEXT UNIQUE NOT NULL,
      bidang_keahlian TEXT
    );

    CREATE TABLE IF NOT EXISTS mata_kuliah (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kode TEXT UNIQUE NOT NULL,
      nama TEXT NOT NULL,
      sks INTEGER NOT NULL,
      dosen_id INTEGER REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS nilai (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mahasiswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mata_kuliah_id INTEGER NOT NULL REFERENCES mata_kuliah(id) ON DELETE CASCADE,
      nilai_huruf TEXT,
      nilai_angka REAL,
      diupdate_oleh INTEGER REFERENCES users(id),
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(mahasiswa_id, mata_kuliah_id)
    );

    CREATE TABLE IF NOT EXISTS tugas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mata_kuliah_id INTEGER NOT NULL REFERENCES mata_kuliah(id) ON DELETE CASCADE,
      judul TEXT NOT NULL,
      deskripsi TEXT,
      deadline TEXT,
      dibuat_oleh INTEGER REFERENCES users(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pengumpulan_tugas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tugas_id INTEGER NOT NULL REFERENCES tugas(id) ON DELETE CASCADE,
      mahasiswa_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      nama_file TEXT NOT NULL,
      path_file TEXT NOT NULL,
      uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS forum_post (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      judul TEXT NOT NULL,
      isi TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

module.exports = { getDb, initSchema, DB_PATH };
