/*
 * app.js
 * Logika antarmuka: tab Teks, File, dan Hash.
 */
(function () {
  'use strict';

  const K = window.KriptoCore;
  const A = window.Activity;
  const MAX_FILE_SIZE = 50 * 1024 * 1024;
  const $ = (id) => document.getElementById(id);

  // ---------- Tema gelap / terang ----------
  // Tanpa pilihan manual, tema mengikuti pengaturan sistem.
  // Pilihan manual disimpan di localStorage (hanya preferensi tampilan).

  const THEME_KEY = 'kripto.theme';
  const root = document.documentElement;
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const themeToggle = $('theme-toggle');

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

  // ---------- Sidebar bisa diciutkan (hanya ikon) ----------

  const SIDEBAR_KEY = 'kripto.sidebar';
  const sidebarToggle = $('sidebar-toggle');
  const sidebarLabelled = document.querySelectorAll('.sidebar .tab, .sidebar .back-home, .sidebar .mode-local');

  function renderSidebar() {
    const collapsed = root.classList.contains('sb-collapsed');
    const label = collapsed ? 'Tampilkan menu' : 'Sembunyikan menu';
    sidebarToggle.setAttribute('aria-expanded', String(!collapsed));
    sidebarToggle.setAttribute('aria-label', label);
    sidebarToggle.title = label;
    // Saat diciutkan, nama menu tampil sebagai tooltip.
    sidebarLabelled.forEach((el) => {
      if (collapsed) el.title = el.textContent.trim();
      else el.removeAttribute('title');
    });
  }

  sidebarToggle.addEventListener('click', () => {
    const collapsed = root.classList.toggle('sb-collapsed');
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? 'collapsed' : 'expanded');
    } catch (e) {
      // Penyimpanan tidak tersedia: pilihan berlaku sampai halaman ditutup.
    }
    renderSidebar();
  });

  renderSidebar();

  if (!window.crypto || !window.crypto.subtle) {
    $('env-badge').className = 'badge err';
    $('env-badge').textContent = 'Web Crypto API tidak tersedia';
    document.querySelector('.stats').insertAdjacentHTML(
      'beforebegin',
      '<div class="status err">Peramban ini tidak mendukung Web Crypto API. ' +
        'Gunakan Chrome, Edge, atau Firefox versi terbaru.</div>'
    );
    return;
  }

  // ---------- Utilitas UI ----------

  function showStatus(el, type, message) {
    el.className = 'status ' + type;
    el.textContent = message;
    el.hidden = false;
  }

  function showDetails(detailsEl, rows) {
    const dl = detailsEl.querySelector('dl');
    dl.innerHTML = '';
    rows.forEach(([label, value]) => {
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      dl.append(dt, dd);
    });
    detailsEl.hidden = false;
  }

  function cryptoDetailRows(d) {
    return [
      ['Algoritma', 'AES-256-GCM'],
      ['KDF', 'PBKDF2-HMAC-SHA256, ' + d.iterations.toLocaleString('id-ID') + ' iterasi'],
      ['Salt (16 byte)', d.salt],
      ['IV / Nonce (12 byte)', d.iv],
      ['Auth tag (16 byte)', d.tag],
      ['Ukuran plaintext', formatSize(d.plainSize)],
      ['Ukuran paket', formatSize(d.packetSize) + ' (28 byte header + 16 byte tag)'],
    ];
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' byte';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  }

  async function withBusy(buttons, fn) {
    buttons.forEach((b) => (b.disabled = true));
    try {
      await fn();
    } finally {
      buttons.forEach((b) => (b.disabled = false));
    }
  }

  function errorMessage(err) {
    return err instanceof K.CryptoError ? err.message : 'Terjadi kesalahan: ' + err.message;
  }

  async function copyText(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const original = button.textContent;
    button.textContent = 'Tersalin!';
    setTimeout(() => (button.textContent = original), 1200);
  }

  function downloadBytes(bytes, filename) {
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function readFileBytes(file) {
    return file.arrayBuffer().then((buf) => new Uint8Array(buf));
  }

  // ---------- Navigasi ----------

  function showTab(name) {
    document.querySelectorAll('.tab').forEach((t) => {
      const active = t.dataset.tab === name;
      t.classList.toggle('active', active);
      t.setAttribute('aria-selected', String(active));
      $('tab-' + t.dataset.tab).hidden = !active;
    });
    history.replaceState(null, '', '#' + name);
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => showTab(tab.dataset.tab));
  });

  // Deep link dari halaman utama, mis. app.html#file
  const initialTab = location.hash.slice(1);
  if (initialTab && $('tab-' + initialTab)) showTab(initialTab);

  document.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => showTab(btn.dataset.goto));
  });

  // ---------- Dashboard ----------

  const PROSES_LABEL = { enkripsi: 'Enkripsi', dekripsi: 'Dekripsi', hash: 'Hash' };

  function cell(row, content, className) {
    const td = document.createElement('td');
    if (className) td.className = className;
    if (content instanceof Node) td.appendChild(content);
    else td.textContent = content;
    row.appendChild(td);
    return td;
  }

  function pill(text, className) {
    const span = document.createElement('span');
    span.className = 'pill ' + className;
    span.textContent = text;
    return span;
  }

  function renderDashboard() {
    const s = A.stats();
    $('stat-total').textContent = s.total;
    $('stat-enkripsi').textContent = s.enkripsi;
    $('stat-dekripsi').textContent = s.dekripsi;
    $('stat-hash').textContent = s.hash;
    $('stat-gagal').textContent = s.gagal;
    $('stat-bytes').textContent = formatSize(s.bytes);

    const body = $('history-body');
    body.innerHTML = '';
    const entries = A.all();
    $('history-empty').hidden = entries.length > 0;
    body.parentElement.hidden = entries.length === 0;

    entries.slice(0, 15).forEach((e) => {
      const tr = document.createElement('tr');
      const waktu = new Date(e.waktu);
      cell(tr, waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }), 'nowrap');
      cell(tr, pill(PROSES_LABEL[e.jenisProses], e.jenisProses));

      const data = document.createElement('div');
      data.textContent = e.jenisData === 'teks' ? 'Teks' : 'File';
      if (e.namaFile) {
        const name = document.createElement('span');
        name.className = 'file-name';
        name.textContent = e.namaFile;
        name.title = e.namaFile;
        data.appendChild(name);
      }
      cell(tr, data);
      cell(tr, e.ukuran ? formatSize(e.ukuran) : '-', 'nowrap');

      const status = pill(e.berhasil ? 'Berhasil' : 'Gagal', e.berhasil ? 'ok' : 'err');
      if (e.keterangan) status.title = e.keterangan;
      cell(tr, status);
      body.appendChild(tr);
    });
  }

  $('history-clear').addEventListener('click', () => A.clear());
  A.subscribe(renderDashboard);
  renderDashboard();

  document.querySelectorAll('.toggle-pw').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = $(btn.dataset.target);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Sembunyikan' : 'Tampilkan';
    });
  });

  // ---------- Tab Teks (F-01, F-02, F-06) ----------

  const textInput = $('text-input');
  const textPassword = $('text-password');
  const textOutput = $('text-output');
  const textStatus = $('text-status');
  const textDetails = $('text-details');
  const textButtons = [$('text-encrypt'), $('text-decrypt')];

  $('text-encrypt').addEventListener('click', () =>
    withBusy(textButtons, async () => {
      showStatus(textStatus, 'info', 'Menurunkan kunci dan mengenkripsi...');
      try {
        const { base64, details } = await K.encryptText(textInput.value, textPassword.value);
        textOutput.value = base64;
        showStatus(textStatus, 'ok', 'Enkripsi berhasil. Salin teks Base64 di bawah untuk dikirim.');
        showDetails(textDetails, cryptoDetailRows(details));
        A.log({ jenisProses: 'enkripsi', jenisData: 'teks', berhasil: true, ukuran: details.plainSize });
      } catch (err) {
        textOutput.value = '';
        textDetails.hidden = true;
        showStatus(textStatus, 'err', errorMessage(err));
        A.log({ jenisProses: 'enkripsi', jenisData: 'teks', berhasil: false, keterangan: errorMessage(err) });
      }
    })
  );

  $('text-decrypt').addEventListener('click', () =>
    withBusy(textButtons, async () => {
      showStatus(textStatus, 'info', 'Menurunkan kunci dan mendekripsi...');
      try {
        const { text, details } = await K.decryptText(textInput.value, textPassword.value);
        textOutput.value = text;
        showStatus(textStatus, 'ok', 'Dekripsi berhasil. Authentication tag valid, data utuh.');
        showDetails(textDetails, cryptoDetailRows(details));
        A.log({ jenisProses: 'dekripsi', jenisData: 'teks', berhasil: true, ukuran: details.packetSize });
      } catch (err) {
        textOutput.value = '';
        textDetails.hidden = true;
        showStatus(textStatus, 'err', errorMessage(err));
        A.log({ jenisProses: 'dekripsi', jenisData: 'teks', berhasil: false, keterangan: errorMessage(err) });
      }
    })
  );

  $('text-copy').addEventListener('click', (e) => {
    if (textOutput.value) copyText(textOutput.value, e.currentTarget);
  });

  $('text-swap').addEventListener('click', () => {
    if (!textOutput.value) return;
    textInput.value = textOutput.value;
    textOutput.value = '';
    textStatus.hidden = true;
    textDetails.hidden = true;
  });

  $('text-clear').addEventListener('click', () => {
    textInput.value = '';
    textOutput.value = '';
    textPassword.value = '';
    textStatus.hidden = true;
    textDetails.hidden = true;
  });

  // ---------- Tab File (F-03, F-04, F-06) ----------

  const fileInput = $('file-input');
  const filePassword = $('file-password');
  const fileStatus = $('file-status');
  const fileDetails = $('file-details');
  const fileButtons = [$('file-encrypt'), $('file-decrypt')];

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    fileStatus.hidden = true;
    fileDetails.hidden = true;
    if (!file) {
      $('file-info').textContent = 'Belum ada file dipilih. Batas uji sekitar 50 MB.';
      return;
    }
    $('file-info').textContent = file.name + ' · ' + formatSize(file.size);
    if (file.size > MAX_FILE_SIZE) {
      showStatus(fileStatus, 'err', 'Ukuran file melebihi batas 50 MB.');
    }
  });

  function selectedFile() {
    const file = fileInput.files[0];
    if (!file) throw new K.CryptoError('Pilih file terlebih dahulu.');
    if (file.size > MAX_FILE_SIZE) throw new K.CryptoError('Ukuran file melebihi batas 50 MB.');
    return file;
  }

  $('file-encrypt').addEventListener('click', () =>
    withBusy(fileButtons, async () => {
      const file = fileInput.files[0];
      try {
        selectedFile();
        showStatus(fileStatus, 'info', 'Mengenkripsi ' + file.name + '...');
        const { packet, details } = await K.encryptBytes(await readFileBytes(file), filePassword.value);
        const outName = file.name + '.enc';
        downloadBytes(packet, outName);
        showStatus(fileStatus, 'ok', 'Enkripsi berhasil. File "' + outName + '" telah diunduh.');
        showDetails(fileDetails, [['File asal', file.name]].concat(cryptoDetailRows(details)));
        A.log({ jenisProses: 'enkripsi', jenisData: 'file', berhasil: true, ukuran: file.size, namaFile: file.name });
      } catch (err) {
        fileDetails.hidden = true;
        showStatus(fileStatus, 'err', errorMessage(err));
        if (file) {
          A.log({ jenisProses: 'enkripsi', jenisData: 'file', berhasil: false, ukuran: file.size,
            namaFile: file.name, keterangan: errorMessage(err) });
        }
      }
    })
  );

  $('file-decrypt').addEventListener('click', () =>
    withBusy(fileButtons, async () => {
      const file = fileInput.files[0];
      try {
        selectedFile();
        showStatus(fileStatus, 'info', 'Mendekripsi ' + file.name + '...');
        const { plainBytes, details } = await K.decryptBytes(await readFileBytes(file), filePassword.value);
        const outName = /\.enc$/i.test(file.name) ? file.name.slice(0, -4) : file.name + '.dec';
        downloadBytes(plainBytes, outName);
        showStatus(fileStatus, 'ok', 'Dekripsi berhasil. Tag valid, file "' + outName + '" telah diunduh.');
        showDetails(fileDetails, [['File hasil', outName]].concat(cryptoDetailRows(details)));
        A.log({ jenisProses: 'dekripsi', jenisData: 'file', berhasil: true, ukuran: file.size, namaFile: file.name });
      } catch (err) {
        fileDetails.hidden = true;
        showStatus(fileStatus, 'err', errorMessage(err));
        if (file) {
          A.log({ jenisProses: 'dekripsi', jenisData: 'file', berhasil: false, ukuran: file.size,
            namaFile: file.name, keterangan: errorMessage(err) });
        }
      }
    })
  );

  // ---------- Tab Hash (F-05) ----------

  const hashFile = $('hash-file');
  const hashResult = $('hash-result');
  const hashCompareText = $('hash-compare-text');
  const hashCompareFile = $('hash-compare-file');
  const hashCompareResult = $('hash-compare-result');
  const hashStatus = $('hash-status');
  let mainHash = '';
  let compareFileHash = '';

  async function hashOf(input, outputEl) {
    const file = input.files[0];
    if (!file) {
      outputEl.textContent = '-';
      return '';
    }
    outputEl.textContent = 'Menghitung...';
    const hex = await K.sha256Hex(await readFileBytes(file));
    outputEl.textContent = hex;
    A.log({ jenisProses: 'hash', jenisData: 'file', berhasil: true, ukuran: file.size, namaFile: file.name });
    return hex;
  }

  function updateComparison() {
    const typed = hashCompareText.value.trim().toLowerCase();
    const reference = typed || compareFileHash;
    if (!mainHash || !reference) {
      hashStatus.hidden = true;
      return;
    }
    if (typed && !/^[0-9a-f]{64}$/.test(typed)) {
      showStatus(hashStatus, 'err', 'Hash pembanding harus 64 karakter heksadesimal.');
      return;
    }
    const source = typed ? 'hash yang ditempel' : 'file pembanding';
    if (reference === mainHash) {
      showStatus(hashStatus, 'ok', 'COCOK: hash sama dengan ' + source + '. File utuh.');
    } else {
      showStatus(hashStatus, 'err', 'BEDA: hash tidak sama dengan ' + source + '. File telah berubah.');
    }
  }

  hashFile.addEventListener('change', async () => {
    mainHash = await hashOf(hashFile, hashResult);
    $('hash-copy').disabled = !mainHash;
    updateComparison();
  });

  hashCompareFile.addEventListener('change', async () => {
    compareFileHash = await hashOf(hashCompareFile, hashCompareResult);
    updateComparison();
  });

  hashCompareText.addEventListener('input', updateComparison);

  $('hash-copy').addEventListener('click', (e) => {
    if (mainHash) copyText(mainHash, e.currentTarget);
  });
})();
