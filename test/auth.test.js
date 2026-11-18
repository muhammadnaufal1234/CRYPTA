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
  const raw = localStorage.getItem('kripto.akun-list');
  const acc = JSON.parse(raw)[0];
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
  assert.ok(A.lockRemaining('naufal') > 0);
  // Saat terkunci, sandi yang benar pun ditolak.
  await assert.rejects(A.login('naufal', AKUN.password), /Coba lagi dalam/);
  assert.equal(A.session(), null);
});

test('Nama pengguna salah ditolak meski sandi benar', async () => {
  await A.register(AKUN);
  await assert.rejects(A.login('orang-lain', AKUN.password), A.AuthError);
});

test('Hapus akun lokal menghapus akun dan sesinya saja', async () => {
  await A.register(AKUN);
  await A.register({ ...AKUN, nama: 'Budi', username: 'budi' });
  await A.login('naufal', AKUN.password);
  A.deleteAccount('naufal');
  assert.equal(A.getAccount('naufal'), null);
  assert.ok(A.getAccount('budi'));
  assert.equal(A.session(), null);
});

test('Banyak akun: nama pengguna unik, masing-masing bisa masuk', async () => {
  await A.register(AKUN);
  await A.register({ nama: 'Budi Santoso', username: 'budi', password: 'Budi#12345', confirm: 'Budi#12345' });
  await assert.rejects(A.register({ ...AKUN, nama: 'Lain' }), /sudah dipakai/);
  assert.equal(A.getAccounts().length, 2);
  await A.login('budi', 'Budi#12345');
  assert.equal(A.session().nama, 'Budi Santoso');
  // Sandi akun lain tidak bisa dipakai.
  A.logout();
  await assert.rejects(A.login('budi', AKUN.password), A.AuthError);
});

test('Riwayat login mencatat daftar, gagal, masuk, dan keluar', async () => {
  await A.register(AKUN);
  await assert.rejects(A.login('naufal', 'salah-sandi'));
  await A.login('naufal', AKUN.password);
  A.logout();
  const aksi = A.loginHistory().map((h) => h.aksi);
  assert.deepEqual(aksi, ['keluar', 'masuk', 'gagal', 'daftar']);
  assert.ok(A.getAccount('naufal').terakhirMasuk);
  assert.equal(A.lastUsername(), 'naufal');
  A.clearHistory();
  assert.equal(A.loginHistory().length, 0);
});

test('Kunci gagal login berlaku per pengguna', async () => {
  await A.register(AKUN);
  await A.register({ nama: 'Budi', username: 'budi', password: 'Budi#12345', confirm: 'Budi#12345' });
  for (let i = 0; i < 5; i++) await assert.rejects(A.login('naufal', 'salah'));
  assert.ok(A.lockRemaining('naufal') > 0);
  assert.equal(A.lockRemaining('budi'), 0);
  await A.login('budi', 'Budi#12345');
});

test('Migrasi akun tunggal versi lama ke daftar akun', () => {
  localStorage.setItem('kripto.akun', JSON.stringify({ nama: 'Lama', username: 'lama', salt: '00', hash: '00', iterasi: 1 }));
  assert.equal(A.getAccounts().length, 1);
  assert.equal(A.getAccount('lama').nama, 'Lama');
  assert.equal(localStorage.getItem('kripto.akun'), null);
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
