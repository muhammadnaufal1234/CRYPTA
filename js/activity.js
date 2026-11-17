/*
 * activity.js
 * Riwayat aktivitas (entitas SESI_PROSES pada ERD).
 * Hanya metadata yang dicatat: jenis proses, jenis data, nama file, ukuran,
 * waktu, dan status. Kata sandi, plaintext, maupun kunci TIDAK pernah dicatat.
 * Disimpan di sessionStorage sehingga otomatis terhapus saat tab ditutup.
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'kripto.sesi_proses';
  const MAX_ENTRIES = 100;
  const listeners = [];
  let entries = load();

  function load() {
    try {
      const raw = root.sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function save() {
    try {
      root.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      // Penyimpanan tidak tersedia: riwayat tetap ada di memori selama halaman terbuka.
    }
  }

  function notify() {
    listeners.forEach((fn) => fn(entries));
  }

  /**
   * @param {object} e
   * @param {'enkripsi'|'dekripsi'|'hash'} e.jenisProses
   * @param {'teks'|'file'} e.jenisData
   * @param {boolean} e.berhasil
   * @param {number} [e.ukuran]  ukuran data masukan dalam byte
   * @param {string} [e.namaFile]
   * @param {string} [e.keterangan]
   */
  function log(e) {
    entries.unshift({
      id: Date.now() + '-' + Math.random().toString(16).slice(2, 8),
      waktu: new Date().toISOString(),
      jenisProses: e.jenisProses,
      jenisData: e.jenisData,
      berhasil: e.berhasil,
      ukuran: e.ukuran || 0,
      namaFile: e.namaFile || '',
      keterangan: e.keterangan || '',
    });
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    save();
    notify();
  }

  function clear() {
    entries = [];
    save();
    notify();
  }

  function stats() {
    const s = { total: entries.length, enkripsi: 0, dekripsi: 0, hash: 0, gagal: 0, bytes: 0 };
    entries.forEach((e) => {
      if (!e.berhasil) {
        s.gagal++;
        return;
      }
      s[e.jenisProses]++;
      s.bytes += e.ukuran;
    });
    return s;
  }

  root.Activity = {
    log,
    clear,
    stats,
    all: () => entries.slice(),
    subscribe: (fn) => listeners.push(fn),
  };
})(window);
