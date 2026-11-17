/*
 * auth.js
 * Akun login lokal (entitas PENGGUNA pada ERD).
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
  const ACCOUNT_KEY = 'kripto.akun';
  const SESSION_KEY = 'kripto.sesi';
  const LOCK_KEY = 'kripto.login-gagal';
  const MAX_ATTEMPTS = 5;
  const LOCK_MS = 30 * 1000;

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

  function getAccount() {
    return readJSON(localStorage, ACCOUNT_KEY);
  }

  async function register({ nama, username, password, confirm }) {
    nama = String(nama || '').trim();
    username = String(username || '').trim().toLowerCase();
    if (nama.length < 2) throw new AuthError('Nama minimal 2 karakter.');
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new AuthError('Nama pengguna 3–32 karakter: huruf kecil, angka, titik, garis bawah, atau strip.');
    }
    if (!password || password.length < 8) throw new AuthError('Kata sandi minimal 8 karakter.');
    if (password !== confirm) throw new AuthError('Konfirmasi kata sandi tidak sama.');

    const salt = crypto.getRandomValues(new Uint8Array(K.SALT_LEN));
    const hash = await K.hashPassword(password, salt);
    writeJSON(localStorage, ACCOUNT_KEY, {
      nama,
      username,
      salt: K.toHex(salt),
      hash,
      iterasi: K.ITERATIONS,
      dibuat: new Date().toISOString(),
    });
    remove(localStorage, LOCK_KEY);
  }

  function lockState() {
    return readJSON(localStorage, LOCK_KEY) || { gagal: 0, sampai: 0 };
  }

  /** Sisa waktu kunci (ms) setelah terlalu banyak percobaan gagal. */
  function lockRemaining() {
    return Math.max(0, lockState().sampai - Date.now());
  }

  async function login(username, password) {
    const acc = getAccount();
    if (!acc) throw new AuthError('Belum ada akun. Silakan daftar terlebih dahulu.');

    const wait = lockRemaining();
    if (wait > 0) {
      throw new AuthError('Terlalu banyak percobaan gagal. Coba lagi dalam ' + Math.ceil(wait / 1000) + ' detik.');
    }

    // Hash selalu dihitung, bahkan jika nama pengguna salah, agar waktunya sama.
    const hash = await K.hashPassword(password || ' ', hexToBytes(acc.salt), acc.iterasi);
    const ok = String(username || '').trim().toLowerCase() === acc.username && safeEqual(hash, acc.hash);

    if (!ok) {
      const st = lockState();
      st.gagal += 1;
      if (st.gagal >= MAX_ATTEMPTS) {
        st.gagal = 0;
        st.sampai = Date.now() + LOCK_MS;
        writeJSON(localStorage, LOCK_KEY, st);
        throw new AuthError('Nama pengguna atau kata sandi salah. Login dikunci selama 30 detik.');
      }
      writeJSON(localStorage, LOCK_KEY, st);
      const sisa = MAX_ATTEMPTS - st.gagal;
      throw new AuthError('Nama pengguna atau kata sandi salah. Sisa percobaan: ' + sisa + '.');
    }

    remove(localStorage, LOCK_KEY);
    writeJSON(sessionStorage, SESSION_KEY, {
      username: acc.username,
      nama: acc.nama,
      masuk: new Date().toISOString(),
    });
    return acc;
  }

  function session() {
    return readJSON(sessionStorage, SESSION_KEY);
  }

  function logout() {
    remove(sessionStorage, SESSION_KEY);
  }

  /** Menghapus akun lokal (untuk "lupa kata sandi"). Data terenkripsi tidak terpengaruh. */
  function deleteAccount() {
    remove(localStorage, ACCOUNT_KEY);
    remove(localStorage, LOCK_KEY);
    remove(sessionStorage, SESSION_KEY);
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
    getAccount,
    register,
    login,
    session,
    logout,
    deleteAccount,
    lockRemaining,
    safeNext,
    passwordStrength,
  };
})(window);
