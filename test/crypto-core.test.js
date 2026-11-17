/*
 * Pengujian otomatis sesuai skenario pengujian proposal (bagian 4.3).
 * Jalankan: node --test test/
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const K = require('../js/crypto-core.js');

const PASSWORD = 'rahasia-kuat-123';

test('Skenario 1: enkripsi lalu dekripsi teks dengan kata sandi benar', async () => {
  const pesan = 'Halo, ini pesan rahasia! 🔐';
  const { base64 } = await K.encryptText(pesan, PASSWORD);
  const { text } = await K.decryptText(base64, PASSWORD);
  assert.equal(text, pesan);
});

test('Skenario 2: dekripsi dengan kata sandi salah menghasilkan galat', async () => {
  const { base64 } = await K.encryptText('pesan', PASSWORD);
  await assert.rejects(K.decryptText(base64, 'sandi-salah'), K.CryptoError);
});

test('Skenario 3: mengubah satu byte ciphertext membuat dekripsi gagal', async () => {
  const { packet } = await K.encryptBytes(new TextEncoder().encode('data penting'), PASSWORD);
  const tampered = packet.slice();
  tampered[K.SALT_LEN + K.IV_LEN] ^= 0x01;
  await assert.rejects(K.decryptBytes(tampered, PASSWORD), K.CryptoError);
});

test('Skenario 3b: mengubah satu karakter Base64 membuat dekripsi gagal', async () => {
  const { base64 } = await K.encryptText('data penting', PASSWORD);
  const i = 50;
  const swapped = base64[i] === 'A' ? 'B' : 'A';
  const tampered = base64.slice(0, i) + swapped + base64.slice(i + 1);
  await assert.rejects(K.decryptText(tampered, PASSWORD), K.CryptoError);
});

test('Skenario 4: enkripsi teks yang sama dua kali menghasilkan ciphertext berbeda', async () => {
  const a = await K.encryptText('pesan sama', PASSWORD);
  const b = await K.encryptText('pesan sama', PASSWORD);
  assert.notEqual(a.base64, b.base64);
  assert.notEqual(a.details.salt, b.details.salt);
  assert.notEqual(a.details.iv, b.details.iv);
});

test('Skenario 5 & 6: file biner identik setelah dekripsi dan hash SHA-256 sama', async () => {
  const original = new Uint8Array(256 * 1024);
  for (let i = 0; i < original.length; i++) original[i] = (i * 31 + 7) & 0xff;

  const { packet } = await K.encryptBytes(original, PASSWORD);
  const { plainBytes } = await K.decryptBytes(packet, PASSWORD);

  assert.deepEqual(plainBytes, original);
  assert.equal(await K.sha256Hex(plainBytes), await K.sha256Hex(original));
});

test('Format paket: salt 16 B || IV 12 B || ciphertext + tag 16 B', async () => {
  const data = new Uint8Array(100);
  const { packet } = await K.encryptBytes(data, PASSWORD);
  assert.equal(packet.length, 16 + 12 + 100 + 16);
});

test('SHA-256 sesuai vektor uji standar', async () => {
  assert.equal(
    await K.sha256Hex(new Uint8Array(0)),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  );
  assert.equal(
    await K.sha256Hex(new TextEncoder().encode('abc')),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
  );
});

test('Validasi masukan: kata sandi kosong, Base64 rusak, data terlalu pendek', async () => {
  await assert.rejects(K.encryptText('pesan', ''), K.CryptoError);
  await assert.rejects(K.decryptText('bukan base64!!', PASSWORD), K.CryptoError);
  await assert.rejects(K.decryptBytes(new Uint8Array(10), PASSWORD), K.CryptoError);
});
