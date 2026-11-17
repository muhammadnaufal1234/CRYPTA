/*
 * Pengujian akun login lokal (js/auth.js).
 * Jalankan: node --test test/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { webcrypto } = require('node:crypto');

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: (k) => data.delete(k),
    clear: () => data.clear(),
  };
}

// Lingkungan peramban tiruan untuk auth.js.
global.window = global;
if (!global.crypto) Object.defineProperty(global, 'crypto', { value: webcrypto });
global.localStorage = memoryStorage();
global.sessionStorage = memoryStorage();
global.KriptoCore = require('../js/crypto-core.js');
require('../js/auth.js');
const A = global.Auth;

const AKUN = { nama: 'Muhammad Naufal', username: 'Naufal', password: 'Rahasia#2026', confirm: 'Rahasia#2026' };

test.beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

test('Daftar menyimpan hash PBKDF2 + salt, bukan kata sandi asli', async () => {
  await A.register(AKUN);
  const raw = localStorage.getItem('kripto.akun');
  const acc = JSON.parse(raw);
  assert.equal(acc.username, 'naufal');
  assert.match(acc.salt, /^[0-9a-f]{32}$/);
  assert.match(acc.hash, /^[0-9a-f]{64}$/);
  assert.equal(acc.iterasi, 200000);
  assert.ok(!raw.includes(AKUN.password), 'kata sandi asli tidak boleh tersimpan');
});

test('Validasi daftar: sandi pendek, konfirmasi beda, nama pengguna tidak valid', async () => {
  await assert.rejects(A.register({ ...AKUN, password: 'pendek', confirm: 'pendek' }), A.AuthError);
  await assert.rejects(A.register({ ...AKUN, confirm: 'lain12345' }), A.AuthError);
  await assert.rejects(A.register({ ...AKUN, username: 'a b' }), A.AuthError);
});

test('Masuk dengan sandi benar membuat sesi; keluar menghapusnya', async () => {
  await A.register(AKUN);
  assert.equal(A.session(), null);
  await A.login('NAUFAL', AKUN.password);
  assert.equal(A.session().nama, 'Muhammad Naufal');
  A.logout();
  assert.equal(A.session(), null);
});

test('Sandi salah ditolak; setelah 5 kali gagal login dikunci', async () => {
  await A.register(AKUN);
  for (let i = 1; i <= 4; i++) {
    await assert.rejects(A.login('naufal', 'salah-' + i), /Sisa percobaan: \d/);
  }
  await assert.rejects(A.login('naufal', 'salah-5'), /dikunci/);
  assert.ok(A.lockRemaining() > 0);
  // Saat terkunci, sandi yang benar pun ditolak.
  await assert.rejects(A.login('naufal', AKUN.password), /Coba lagi dalam/);
  assert.equal(A.session(), null);
});

test('Nama pengguna salah ditolak meski sandi benar', async () => {
  await A.register(AKUN);
  await assert.rejects(A.login('orang-lain', AKUN.password), A.AuthError);
});

test('Hapus akun lokal menghapus akun dan sesi', async () => {
  await A.register(AKUN);
  await A.login('naufal', AKUN.password);
  A.deleteAccount();
  assert.equal(A.getAccount(), null);
  assert.equal(A.session(), null);
});

test('Redirect setelah masuk hanya ke halaman aplikasi', () => {
  assert.equal(A.safeNext('app.html#file'), 'app.html#file');
  assert.equal(A.safeNext('https://contoh-jahat.com'), 'app.html');
  assert.equal(A.safeNext('javascript:alert(1)'), 'app.html');
  assert.equal(A.safeNext(null), 'app.html');
});

test('Pengukur kekuatan kata sandi', () => {
  assert.equal(A.passwordStrength(''), 0);
  assert.equal(A.passwordStrength('abc'), 0);
  assert.equal(A.passwordStrength('abcdefgh'), 1);
  assert.equal(A.passwordStrength('Abcdefghijkl'), 3);
  assert.equal(A.passwordStrength('Abcdefghij1!'), 4);
});
