/*
 * login.js
 * Halaman masuk / daftar akun lokal.
 */
(function () {
  'use strict';

  const A = window.Auth;
  const $ = (id) => document.getElementById(id);
  const next = A.safeNext(new URLSearchParams(location.search).get('next'));

  // Sudah masuk? Langsung ke aplikasi.
  if (A.session()) {
    location.replace(next);
    return;
  }

  const formMasuk = $('form-masuk');
  const formDaftar = $('form-daftar');
  const statusEl = $('auth-status');
  const tabs = document.querySelectorAll('.auth-tab');

  function showStatus(type, message) {
    statusEl.className = 'status ' + type;
    statusEl.textContent = message;
    statusEl.hidden = false;
  }

  function setMode(mode) {
    const masuk = mode === 'masuk';
    tabs.forEach((t) => {
      const active = t.dataset.mode === mode;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
    });
    formMasuk.hidden = !masuk;
    formDaftar.hidden = masuk;
    $('login-title').textContent = masuk ? 'Masuk ke CRYPTA' : 'Buat akun CRYPTA';
    $('login-subtitle').textContent = masuk
      ? 'Gunakan akun yang sudah Anda daftarkan di peramban ini.'
      : 'Akun dibuat sekali dan disimpan lokal di peramban ini.';
    statusEl.hidden = true;
    (masuk ? $('login-username') : $('reg-nama')).focus();
  }

  function refreshForAccount() {
    const acc = A.getAccount();
    // Hanya satu akun lokal per peramban: pilihan Daftar disembunyikan jika sudah ada akun.
    document.querySelector('.auth-tabs').hidden = !!acc;
    if (acc) {
      $('login-username').value = acc.username;
      setMode('masuk');
      $('login-password').focus();
    } else {
      setMode('daftar');
    }
  }

  tabs.forEach((t) => t.addEventListener('click', () => setMode(t.dataset.mode)));

  document.querySelectorAll('.toggle-pw').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Sembunyikan' : 'Tampilkan';
    });
  });

  async function busy(form, label, fn) {
    const btn = form.querySelector('.auth-submit');
    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = label;
    try {
      await fn();
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  }

  function message(err) {
    return err instanceof A.AuthError || err.name === 'CryptoError'
      ? err.message
      : 'Terjadi kesalahan: ' + err.message;
  }

  // ---------- Masuk ----------

  formMasuk.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(formMasuk, 'Memverifikasi…', async () => {
      try {
        await A.login($('login-username').value, $('login-password').value);
        showStatus('ok', 'Berhasil masuk. Membuka aplikasi…');
        location.replace(next);
      } catch (err) {
        $('login-password').value = '';
        showStatus('err', message(err));
      }
    });
  });

  // ---------- Lupa kata sandi ----------

  const deleteBtn = $('delete-account');
  let confirmDelete = false;

  $('forgot-link').addEventListener('click', () => {
    $('forgot-box').hidden = !$('forgot-box').hidden;
  });

  deleteBtn.addEventListener('click', () => {
    if (!confirmDelete) {
      confirmDelete = true;
      deleteBtn.textContent = 'Yakin? Klik sekali lagi untuk menghapus';
      setTimeout(() => {
        confirmDelete = false;
        deleteBtn.textContent = 'Hapus akun lokal';
      }, 4000);
      return;
    }
    A.deleteAccount();
    $('forgot-box').hidden = true;
    confirmDelete = false;
    deleteBtn.textContent = 'Hapus akun lokal';
    refreshForAccount();
    showStatus('info', 'Akun lokal sudah dihapus. Silakan daftar ulang.');
  });

  // ---------- Daftar ----------

  const LEVELS = [
    ['Terlalu lemah', 'w0'],
    ['Lemah', 'w1'],
    ['Sedang', 'w2'],
    ['Kuat', 'w3'],
    ['Sangat kuat', 'w4'],
  ];

  $('reg-password').addEventListener('input', (e) => {
    const pw = e.target.value;
    const score = A.passwordStrength(pw);
    const [label, cls] = LEVELS[score];
    $('strength-fill').className = pw ? cls : '';
    $('strength-label').textContent = pw ? 'Kekuatan: ' + label : 'Kekuatan kata sandi';
  });

  formDaftar.addEventListener('submit', (e) => {
    e.preventDefault();
    busy(formDaftar, 'Membuat akun…', async () => {
      try {
        await A.register({
          nama: $('reg-nama').value,
          username: $('reg-username').value,
          password: $('reg-password').value,
          confirm: $('reg-confirm').value,
        });
        formDaftar.reset();
        $('strength-fill').className = '';
        $('strength-label').textContent = 'Kekuatan kata sandi';
        refreshForAccount();
        showStatus('ok', 'Akun berhasil dibuat. Silakan masuk dengan kata sandi Anda.');
      } catch (err) {
        showStatus('err', message(err));
      }
    });
  });

  refreshForAccount();

  if (!window.crypto || !window.crypto.subtle) {
    showStatus('err', 'Peramban ini tidak mendukung Web Crypto API. Gunakan Chrome, Edge, atau Firefox versi terbaru.');
  }
})();
