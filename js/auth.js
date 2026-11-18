/*
 * auth.js
 * Akun login lokal (entitas PENGGUNA pada ERD) dan riwayat login.
 *
 * Aplikasi berjalan tanpa server, jadi akun disimpan di localStorage peramban
 * ini. Kata sandi TIDAK disimpan: yang disimpan hanya salt acak dan hash
 * PBKDF2-HMAC-SHA256 (200.000 iterasi). Sesi login disimpan di sessionStorage
 * sehingga otomatis berakhir saat tab ditutup.
 *
 * Catatan: ini gerbang akses di sisi klien, bukan pengganti autentikasi server.
 * Kerahasiaan data tetap dijamin oleh enkripsi AES-256-GCM per pesan/file.
 */
(function (root) {
  'use strict';

  const K = root.KriptoCore;
  const ACCOUNTS_KEY = 'kripto.akun-list';
  const LEGACY_ACCOUNT_KEY = 'kripto.akun';
  const HISTORY_KEY = 'kripto.riwayat-login';
  const LAST_USER_KEY = 'kripto.akun-terakhir';
  const SESSION_KEY = 'kripto.sesi';
  const LOCK_KEY = 'kripto.login-gagal';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 30 * 1000;
  const MAX_HISTORY = 100;

  class AuthError extends Error {
    constructor(message) {
      super(message);
      this.name = 'AuthError';
    }
  }

  function readJSON(storage, key) {
    try {
      const raw = storage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeJSON(storage, key, value) {
    try {
      storage.setItem(key, JSON.stringify(value));
    } catch (e) {
      throw new AuthError('Penyimpanan peramban tidak tersedia (mode privat atau diblokir).');
    }
  }

  function remove(storage, key) {
    try {
      storage.removeItem(key);
    } catch (e) {
      // Abaikan: tidak ada yang perlu dihapus.
    }
  }

  function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
  }

  /** Perbandingan waktu-konstan agar lama proses tidak membocorkan isi hash. */
  function safeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  function normalize(username) {
    return String(username || '').trim().toLowerCase();
  }

  // ---------- Akun ----------

  function getAccounts() {
    const list = readJSON(localStorage, ACCOUNTS_KEY);
    if (list) return list;
    // Migrasi dari versi lama yang hanya menyimpan satu akun.
    const legacy = readJSON(localStorage, LEGACY_ACCOUNT_KEY);
    if (legacy && legacy.username) {
      const migrated = [legacy];
      writeJSON(localStorage, ACCOUNTS_KEY, migrated);
      remove(localStorage, LEGACY_ACCOUNT_KEY);
      return migrated;
    }
    return [];
  }

  function saveAccounts(list) {
    writeJSON(localStorage, ACCOUNTS_KEY, list);
  }

  function getAccount(username) {
    const u = normalize(username);
    return getAccounts().find((a) => a.username === u) || null;
  }

  // ---------- Riwayat login ----------

  function loginHistory() {
    return readJSON(localStorage, HISTORY_KEY) || [];
  }

  /** aksi: 'daftar' | 'masuk' | 'gagal' | 'terkunci' | 'keluar' | 'hapus' */
  function record(aksi, username, nama, keterangan) {
    const list = loginHistory();
    list.unshift({
      waktu: new Date().toISOString(),
      aksi,
      username: normalize(username),
      nama: nama || '',
      keterangan: keterangan || '',
    });
    if (list.length > MAX_HISTORY) list.length = MAX_HISTORY;
    try {
      writeJSON(localStorage, HISTORY_KEY, list);
    } catch (e) {
      // Riwayat bersifat pelengkap; kegagalan menyimpan tidak menghentikan login.
    }
  }

  function clearHistory() {
    remove(localStorage, HISTORY_KEY);
  }

  // ---------- Daftar ----------

  async function register({ nama, username, password, confirm }) {
    nama = String(nama || '').trim();
    username = normalize(username);
    if (nama.length < 2) throw new AuthError('Nama minimal 2 karakter.');
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new AuthError('Nama pengguna 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.');
    }
    if (getAccount(username)) throw new AuthError('Nama pengguna @' + username + ' sudah dipakai.');
    if (!password || password.length < 8) throw new AuthError('Kata sandi minimal 8 karakter.');
    if (password !== confirm) throw new AuthError('Konfirmasi kata sandi tidak sama.');

    const salt = crypto.getRandomValues(new Uint8Array(K.SALT_LEN));
    const hash = await K.hashPassword(password, salt);
    const list = getAccounts();
    list.push({
      nama,
      username,
      salt: K.toHex(salt),
      hash,
      iterasi: K.ITERATIONS,
      dibuat: new Date().toISOString(),
      terakhirMasuk: null,
    });
    saveAccounts(list);
    record('daftar', username, nama);
  }

  // ---------- Kunci setelah gagal ----------

  function lockState(username) {
    const all = readJSON(localStorage, LOCK_KEY) || {};
    return all[normalize(username)] || { gagal: 0, sampai: 0 };
  }

  function saveLock(username, state) {
    const all = readJSON(localStorage, LOCK_KEY) || {};
    if (state) all[normalize(username)] = state;
    else delete all[normalize(username)];
    writeJSON(localStorage, LOCK_KEY, all);
  }

  /** Sisa waktu kunci (ms) untuk nama pengguna setelah terlalu banyak percobaan gagal. */
  function lockRemaining(username) {
    return Math.max(0, lockState(username).sampai - Date.now());
  }

  // ---------- Masuk / keluar ----------

  async function login(username, password) {
    const u = normalize(username);
    if (!getAccounts().length) throw new AuthError('Belum ada akun. Silakan daftar terlebih dahulu.');

    const wait = lockRemaining(u);
    if (wait > 0) {
      throw new AuthError('Terlalu banyak percobaan gagal. Coba lagi dalam ' + Math.ceil(wait / 1000) + ' detik.');
    }

    // Hash selalu dihitung, bahkan jika akun tidak ada, agar lamanya sama.
    const acc = getAccount(u);
    const salt = acc ? hexToBytes(acc.salt) : new Uint8Array(K.SALT_LEN);
    const hash = await K.hashPassword(password || ' ', salt, acc ? acc.iterasi : K.ITERATIONS);
    const ok = !!acc && safeEqual(hash, acc.hash);

    if (!ok) {
      const st = lockState(u);
      st.gagal += 1;
      if (st.gagal >= MAX_ATTEMPTS) {
        saveLock(u, { gagal: 0, sampai: Date.now() + LOCK_MS });
        record('terkunci', u, acc && acc.nama, '5 kali gagal, dikunci 30 detik');
        throw new AuthError('Nama pengguna atau kata sandi salah. Login dikunci selama 30 detik.');
      }
      saveLock(u, st);
      record('gagal', u, acc && acc.nama, acc ? 'Kata sandi salah' : 'Akun tidak ditemukan');
      throw new AuthError('Nama pengguna atau kata sandi salah. Sisa percobaan: ' + (MAX_ATTEMPTS - st.gagal) + '.');
    }

    saveLock(u, null);
    const list = getAccounts();
    const stored = list.find((a) => a.username === u);
    stored.terakhirMasuk = new Date().toISOString();
    saveAccounts(list);
    writeJSON(sessionStorage, SESSION_KEY, { username: u, nama: acc.nama, masuk: stored.terakhirMasuk });
    try {
      localStorage.setItem(LAST_USER_KEY, u);
    } catch (e) {
      // Hanya kenyamanan pengisian otomatis.
    }
    record('masuk', u, acc.nama);
    return acc;
  }

  function session() {
    return readJSON(sessionStorage, SESSION_KEY);
  }

  function logout() {
    const s = session();
    if (s) record('keluar', s.username, s.nama);
    remove(sessionStorage, SESSION_KEY);
  }

  function lastUsername() {
    try {
      return localStorage.getItem(LAST_USER_KEY) || '';
    } catch (e) {
      return '';
    }
  }

  /** Menghapus satu akun lokal. Data yang sudah dienkripsi tidak terpengaruh. */
  function deleteAccount(username) {
    const u = normalize(username);
    const acc = getAccount(u);
    if (!acc) throw new AuthError('Akun @' + u + ' tidak ditemukan.');
    saveAccounts(getAccounts().filter((a) => a.username !== u));
    saveLock(u, null);
    const s = session();
    if (s && s.username === u) remove(sessionStorage, SESSION_KEY);
    if (lastUsername() === u) remove(localStorage, LAST_USER_KEY);
    record('hapus', u, acc.nama, 'Akun dihapus');
  }

  /** Hanya izinkan kembali ke halaman aplikasi (mencegah open redirect). */
  function safeNext(next) {
    return /^app\.html(#[a-z]+)?$/.test(next || '') ? next : 'app.html';
  }

  /** Skor kekuatan kata sandi 0–4 untuk pengukur di halaman daftar. */
  function passwordStrength(pw) {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
    if (pw.length < 8) score = Math.min(score, 1);
    return score;
  }

  root.Auth = {
    AuthError,
    getAccounts,
    getAccount,
    register,
    login,
    session,
    logout,
    lastUsername,
    deleteAccount,
    loginHistory,
    clearHistory,
    lockRemaining,
    safeNext,
    passwordStrength,
  };
})(window);
