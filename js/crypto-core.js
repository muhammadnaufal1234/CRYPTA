/*
 * crypto-core.js
 * Inti kriptografi aplikasi: AES-256-GCM, PBKDF2-HMAC-SHA256, dan SHA-256
 * memakai Web Crypto API bawaan peramban.
 *
 * Format paket terenkripsi (proposal bagian 3.5):
 *   salt (16 byte) || IV (12 byte) || ciphertext + authentication tag (16 byte)
 */
(function (root) {
  'use strict';

  const SALT_LEN = 16;
  const IV_LEN = 12;
  const TAG_LEN = 16;
  const ITERATIONS = 200000;
  const HEADER_LEN = SALT_LEN + IV_LEN;

  const webcrypto =
    (root.crypto && root.crypto.subtle) ? root.crypto : require('node:crypto').webcrypto;
  const subtle = webcrypto.subtle;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder('utf-8', { fatal: true });

  class CryptoError extends Error {
    constructor(message) {
      super(message);
      this.name = 'CryptoError';
    }
  }

  function randomBytes(length) {
    return webcrypto.getRandomValues(new Uint8Array(length));
  }

  /** Menurunkan kunci AES-256 dari kata sandi + salt dengan PBKDF2-HMAC-SHA256. */
  async function deriveKey(password, salt) {
    if (!password) throw new CryptoError('Kata sandi tidak boleh kosong.');
    const baseKey = await subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']
    );
    return subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Enkripsi byte mentah. Mengembalikan paket salt || IV || ciphertext+tag
   * beserta rincian proses untuk ditampilkan di antarmuka.
   */
  async function encryptBytes(plainBytes, password) {
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = await deriveKey(password, salt);
    const cipher = new Uint8Array(
      await subtle.encrypt({ name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 }, key, plainBytes)
    );

    const packet = new Uint8Array(HEADER_LEN + cipher.length);
    packet.set(salt, 0);
    packet.set(iv, SALT_LEN);
    packet.set(cipher, HEADER_LEN);

    return {
      packet,
      details: {
        salt: toHex(salt),
        iv: toHex(iv),
        tag: toHex(cipher.slice(cipher.length - TAG_LEN)),
        iterations: ITERATIONS,
        plainSize: plainBytes.length,
        packetSize: packet.length,
      },
    };
  }

  /** Dekripsi paket salt || IV || ciphertext+tag. Gagal jika tag tidak valid. */
  async function decryptBytes(packet, password) {
    if (!(packet instanceof Uint8Array)) packet = new Uint8Array(packet);
    if (packet.length < HEADER_LEN + TAG_LEN) {
      throw new CryptoError('Data terlalu pendek, bukan paket terenkripsi yang valid.');
    }

    const salt = packet.slice(0, SALT_LEN);
    const iv = packet.slice(SALT_LEN, HEADER_LEN);
    const cipher = packet.slice(HEADER_LEN);
    const key = await deriveKey(password, salt);

    let plain;
    try {
      plain = await subtle.decrypt({ name: 'AES-GCM', iv, tagLength: TAG_LEN * 8 }, key, cipher);
    } catch (e) {
      throw new CryptoError(
        'Dekripsi gagal: kata sandi salah atau data telah diubah (authentication tag tidak valid).'
      );
    }

    return {
      plainBytes: new Uint8Array(plain),
      details: {
        salt: toHex(salt),
        iv: toHex(iv),
        tag: toHex(cipher.slice(cipher.length - TAG_LEN)),
        iterations: ITERATIONS,
        plainSize: plain.byteLength,
        packetSize: packet.length,
      },
    };
  }

  /** Enkripsi teks menjadi string Base64 (F-01). */
  async function encryptText(text, password) {
    if (!text) throw new CryptoError('Pesan tidak boleh kosong.');
    const { packet, details } = await encryptBytes(encoder.encode(text), password);
    return { base64: bytesToBase64(packet), details };
  }

  /** Dekripsi string Base64 kembali menjadi teks (F-02). */
  async function decryptText(base64, password) {
    const packet = base64ToBytes(base64);
    const { plainBytes, details } = await decryptBytes(packet, password);
    let text;
    try {
      text = decoder.decode(plainBytes);
    } catch (e) {
      throw new CryptoError('Hasil dekripsi bukan teks UTF-8 yang valid.');
    }
    return { text, details };
  }

  /** Hash SHA-256 dalam format heksadesimal (F-05). */
  async function sha256Hex(bytes) {
    return toHex(new Uint8Array(await subtle.digest('SHA-256', bytes)));
  }

  function toHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, '0');
    return hex;
  }

  function bytesToBase64(bytes) {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    const clean = String(base64 || '').replace(/\s+/g, '');
    if (!clean) throw new CryptoError('Teks terenkripsi tidak boleh kosong.');
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(clean)) {
      throw new CryptoError('Format Base64 tidak valid.');
    }
    let binary;
    try {
      binary = atob(clean);
    } catch (e) {
      throw new CryptoError('Format Base64 tidak valid.');
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const api = {
    SALT_LEN, IV_LEN, TAG_LEN, ITERATIONS,
    CryptoError,
    deriveKey, encryptBytes, decryptBytes,
    encryptText, decryptText, sha256Hex,
    toHex, bytesToBase64, base64ToBytes,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.KriptoCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
