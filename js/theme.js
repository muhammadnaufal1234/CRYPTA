/*
 * theme.js
 * Tombol tema gelap / terang, dipakai di halaman aplikasi dan halaman login.
 */
(function () {
  'use strict';

  // ---------- Tema gelap / terang ----------
  // Tanpa pilihan manual, tema mengikuti pengaturan sistem.
  // Pilihan manual disimpan di localStorage (hanya preferensi tampilan).

  const THEME_KEY = 'kripto.theme';
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const themeToggle = document.getElementById('theme-toggle');
  if (!themeToggle) return;

  function currentTheme() {
    return root.getAttribute('data-theme') || (systemDark.matches ? 'dark' : 'light');
  }

  function renderThemeToggle() {
    const dark = currentTheme() === 'dark';
    themeToggle.classList.toggle('is-dark', dark);
    themeToggle.setAttribute('aria-label', dark ? 'Ganti ke tema terang' : 'Ganti ke tema gelap');
    themeToggle.title = themeToggle.getAttribute('aria-label');
  }

  themeToggle.addEventListener('click', () => {
    const next = currentTheme() === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (e) {
      // Penyimpanan tidak tersedia: tema tetap berlaku sampai halaman ditutup.
    }
    renderThemeToggle();
  });

  systemDark.addEventListener('change', renderThemeToggle);
  renderThemeToggle();
})();
