/*
 * landing.js
 * Halaman utama: mockup layar aplikasi yang beranimasi, menu mobile,
 * dan animasi saat discroll. Hasil enkripsi dan hash pada mockup dihitung
 * sungguhan memakai crypto-core.js.
 */
(function () {
  'use strict';

  const K = window.KriptoCore;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasIO = 'IntersectionObserver' in window;

  const HEX = '0123456789abcdef';
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@';
  const DEMO_PASSWORD = 'demo-crypta';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function randomFrom(chars, n) {
    const bytes = crypto.getRandomValues(new Uint8Array(n));
    let s = '';
    for (const b of bytes) s += chars[b % chars.length];
    return s;
  }

  /** Efek "dekripsi": karakter acak berangsur berubah menjadi teks akhir. */
  function scramble(el, finalText, duration, chars) {
    return new Promise((resolve) => {
      const start = performance.now();
      function frame(now) {
        const p = Math.min(1, (now - start) / duration);
        const revealed = Math.floor(finalText.length * p);
        let out = finalText.slice(0, revealed);
        for (let i = revealed; i < finalText.length; i++) {
          out += finalText[i] === ' ' ? ' ' : chars[(Math.random() * chars.length) | 0];
        }
        el.textContent = out;
        if (p < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
  }

  // ---------- Mockup layar ----------

  const STATUS_BAR =
    '<div class="m-status"><span>9:41</span><span class="m-notch"></span><span>●●● ▮</span></div>';

  const MOCKS = {
    dashboard: `
      ${STATUS_BAR}
      <div class="m-head"><span class="m-back">‹</span><b>Dashboard</b><span class="m-dots">···</span></div>
      <div class="m-badge ok"><span class="m-live"></span> Web Crypto API aktif</div>
      <div class="m-stats">
        <div><small>Total proses</small><b data-stat="total">12</b></div>
        <div><small>Enkripsi</small><b class="t-blue" data-stat="enkripsi">6</b></div>
        <div><small>Dekripsi</small><b class="t-green" data-stat="dekripsi">4</b></div>
        <div><small>Ditolak</small><b class="t-red" data-stat="gagal">2</b></div>
      </div>
      <div class="m-ring">
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="38" class="r-bg"/>
          <circle cx="50" cy="50" r="38" class="r-fg" data-role="ring" stroke-dasharray="199 239"/>
        </svg>
        <div><b data-role="pct">83%</b><small>berhasil</small></div>
      </div>
      <small class="m-label">Format paket</small>
      <div class="m-packet"><i class="p-salt"></i><i class="p-iv"></i><i class="p-ct"></i><i class="p-tag"></i></div>
      <small class="m-label">Riwayat</small>
      <div data-role="rows">
        <div class="m-row"><span class="m-pill blue">Enkripsi</span><span>laporan.pdf</span><span class="m-ok">✓</span></div>
        <div class="m-row"><span class="m-pill green">Dekripsi</span><span>Teks</span><span class="m-ok">✓</span></div>
        <div class="m-row"><span class="m-pill purple">Hash</span><span>foto.jpg</span><span class="m-ok">✓</span></div>
      </div>`,

    teks: `
      ${STATUS_BAR}
      <div class="m-head"><span class="m-back">‹</span><b>Amankan Pesan</b><span class="m-dots">···</span></div>
      <small class="m-label">Pesan</small>
      <div class="m-input tall"><span data-role="msg">Rapat proyek dipindah ke jam 10 pagi, ruang 3B.</span><span class="m-caret"></span></div>
      <small class="m-label">Kata sandi</small>
      <div class="m-input">••••••••••</div>
      <div class="m-btns"><span class="m-btn blue" data-role="btn">Enkripsi</span><span class="m-btn green">Dekripsi</span></div>
      <div class="m-alert ok" data-role="alert">Enkripsi berhasil</div>
      <small class="m-label">Hasil (Base64)</small>
      <div class="m-input mono tall" data-role="out">q3Vt8fK2pXz0LmA9cB7eR1yWnH4sJdUg6oTiQ5vZaE8kNbMxCfYr2hPw...</div>
      <div class="m-btn dark full">Salin hasil</div>`,

    file: `
      ${STATUS_BAR}
      <div class="m-head"><span class="m-back">‹</span><b>Amankan File</b><span class="m-dots">···</span></div>
      <div class="m-drop">
        <span class="m-file-icon" data-role="icon">PDF</span>
        <div><b data-role="name">laporan_keuangan.pdf</b><small data-role="size">2.40 MB</small></div>
      </div>
      <div class="m-progress"><i data-role="bar"></i></div>
      <small class="m-label">Kata sandi</small>
      <div class="m-input">••••••••••</div>
      <div class="m-btn blue full" data-role="btn">Enkripsi &amp; unduh .enc</div>
      <div class="m-btn green full">Dekripsi &amp; unduh asli</div>
      <div class="m-alert ok" data-role="alert">laporan_keuangan.pdf.enc diunduh</div>
      <small class="m-label">Detail proses</small>
      <div class="m-kv"><span>Salt</span><code data-role="salt">9f2c…a71e</code></div>
      <div class="m-kv"><span>IV</span><code data-role="iv">4be0…13d8</code></div>
      <div class="m-kv"><span>Iterasi</span><code>200.000</code></div>`,

    hash: `
      ${STATUS_BAR}
      <div class="m-head"><span class="m-back">‹</span><b>Cek Keutuhan</b><span class="m-dots">···</span></div>
      <div class="m-drop">
        <span class="m-file-icon purple">IMG</span>
        <div><b data-role="name">foto_ktp.jpg</b><small>824 KB</small></div>
      </div>
      <small class="m-label">SHA-256</small>
      <div class="m-input mono" data-role="h1">3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b</div>
      <small class="m-label">Pembanding</small>
      <div class="m-input mono" data-role="h2">3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b</div>
      <div class="m-match" data-role="match">
        <span data-role="icon">✓</span>
        <div><b data-role="verdict">COCOK</b><small data-role="desc">File utuh, tidak berubah</small></div>
      </div>
      <div class="m-btn dark full">Salin hash</div>`,
  };

  // Animasi hanya berjalan saat mockup terlihat di layar.
  const visible = new WeakMap();
  const visIO = hasIO
    ? new IntersectionObserver(
        (entries) => entries.forEach((e) => visible.set(e.target, e.isIntersecting)),
        { threshold: 0.2 }
      )
    : null;

  async function waitVisible(el) {
    while ((visIO && !visible.get(el)) || document.hidden) await sleep(250);
  }

  function loop(el, step) {
    if (visIO) visIO.observe(el);
    (async () => {
      for (;;) {
        await waitVisible(el);
        try {
          await step();
        } catch (e) {
          await sleep(2000);
        }
      }
    })();
  }

  function press(btn) {
    btn.classList.add('press');
    return sleep(220).then(() => btn.classList.remove('press'));
  }

  const ANIMATORS = {
    teks(s) {
      const MESSAGES = [
        'Rapat proyek dipindah ke jam 10 pagi, ruang 3B.',
        'Kode akses brankas lantai 2: 7731-ALFA.',
        'Dana sudah ditransfer, cek surel ya.',
      ];
      const msg = s.querySelector('[data-role=msg]');
      const out = s.querySelector('[data-role=out]');
      const alert = s.querySelector('[data-role=alert]');
      const btn = s.querySelector('[data-role=btn]');
      let i = 0;

      loop(s, async () => {
        const text = MESSAGES[i++ % MESSAGES.length];
        alert.classList.add('m-hide');
        out.textContent = '';
        msg.textContent = '';
        for (const ch of text) {
          msg.textContent += ch;
          await sleep(38);
        }
        await sleep(350);
        await press(btn);
        const result = K
          ? (await K.encryptText(text, DEMO_PASSWORD)).base64
          : randomFrom(B64, 120);
        await scramble(out, result, 1000, B64);
        alert.classList.remove('m-hide');
        await sleep(3500);
      });
    },

    dashboard(s) {
      const state = { total: 12, enkripsi: 6, dekripsi: 4, gagal: 2 };
      const EVENTS = [
        ['enkripsi', 'kontrak.docx'],
        ['hash', 'foto.jpg'],
        ['dekripsi', 'Teks'],
        ['enkripsi', 'Teks'],
        ['gagal', 'arsip.zip.enc'],
        ['dekripsi', 'laporan.pdf.enc'],
      ];
      const PILL = {
        enkripsi: ['blue', 'Enkripsi'],
        dekripsi: ['green', 'Dekripsi'],
        hash: ['purple', 'Hash'],
        gagal: ['red', 'Dekripsi'],
      };
      const ring = s.querySelector('[data-role=ring]');
      const pct = s.querySelector('[data-role=pct]');
      const rows = s.querySelector('[data-role=rows]');
      const stat = (k) => s.querySelector('[data-stat=' + k + ']');
      let i = 0;
      let started = false;

      function ratio() {
        return (state.total - state.gagal) / state.total;
      }

      function setRing(r) {
        ring.setAttribute('stroke-dasharray', Math.round(239 * r) + ' 239');
        pct.textContent = Math.round(r * 100) + '%';
      }

      async function countUp() {
        const keys = Object.keys(state);
        const start = performance.now();
        const D = 1100;
        await new Promise((resolve) => {
          function frame(now) {
            const p = Math.min(1, (now - start) / D);
            const e = 1 - Math.pow(1 - p, 3);
            keys.forEach((k) => (stat(k).textContent = Math.round(state[k] * e)));
            ring.setAttribute('stroke-dasharray', Math.round(239 * ratio() * e) + ' 239');
            pct.textContent = Math.round(ratio() * 100 * e) + '%';
            if (p < 1) requestAnimationFrame(frame);
            else resolve();
          }
          requestAnimationFrame(frame);
        });
      }

      function bump(el) {
        el.classList.remove('bump');
        void el.offsetWidth;
        el.classList.add('bump');
      }

      loop(s, async () => {
        if (!started) {
          started = true;
          await countUp();
          await sleep(1800);
          return;
        }
        const [type, name] = EVENTS[i++ % EVENTS.length];
        state.total++;
        if (type !== 'hash') state[type]++;

        const row = document.createElement('div');
        row.className = 'm-row row-in';
        const [color, label] = PILL[type];
        row.innerHTML =
          '<span class="m-pill ' + color + '">' + label + '</span><span></span>' +
          (type === 'gagal' ? '<span class="m-fail">✗</span>' : '<span class="m-ok">✓</span>');
        row.children[1].textContent = name;
        rows.prepend(row);
        while (rows.children.length > 3) rows.lastElementChild.remove();

        stat('total').textContent = state.total;
        bump(stat('total'));
        if (type !== 'hash') {
          stat(type).textContent = state[type];
          bump(stat(type));
        }
        setRing(ratio());
        await sleep(2600);
      });
    },

    file(s) {
      const FILES = [
        ['laporan_keuangan.pdf', '2.40 MB', 'PDF', ''],
        ['foto_liburan.jpg', '1.12 MB', 'IMG', 'purple'],
        ['kontrak_kerja.docx', '86 KB', 'DOC', 'blue'],
      ];
      const icon = s.querySelector('[data-role=icon]');
      const name = s.querySelector('[data-role=name]');
      const size = s.querySelector('[data-role=size]');
      const bar = s.querySelector('[data-role=bar]');
      const btn = s.querySelector('[data-role=btn]');
      const alert = s.querySelector('[data-role=alert]');
      const salt = s.querySelector('[data-role=salt]');
      const iv = s.querySelector('[data-role=iv]');
      let i = 0;

      loop(s, async () => {
        const [fname, fsize, ftype, color] = FILES[i++ % FILES.length];
        alert.classList.add('m-hide');
        bar.style.transition = 'none';
        bar.style.width = '0';
        icon.className = 'm-file-icon pop ' + color;
        icon.textContent = ftype;
        name.textContent = fname;
        size.textContent = fsize;
        await sleep(700);
        await press(btn);
        void bar.offsetWidth;
        bar.style.transition = 'width 1.3s cubic-bezier(.4,0,.2,1)';
        bar.style.width = '100%';
        await Promise.all([
          scramble(salt, randomFrom(HEX, 4) + '…' + randomFrom(HEX, 4), 1200, HEX),
          scramble(iv, randomFrom(HEX, 4) + '…' + randomFrom(HEX, 4), 1200, HEX),
        ]);
        alert.textContent = fname + '.enc diunduh';
        alert.classList.remove('m-hide');
        await sleep(3000);
      });
    },

    hash(s) {
      const NAMES = ['foto_ktp.jpg', 'ijazah.pdf', 'backup.zip'];
      const name = s.querySelector('[data-role=name]');
      const h1 = s.querySelector('[data-role=h1]');
      const h2 = s.querySelector('[data-role=h2]');
      const match = s.querySelector('[data-role=match]');
      const icon = s.querySelector('[data-role=icon]');
      const verdict = s.querySelector('[data-role=verdict]');
      const desc = s.querySelector('[data-role=desc]');
      let i = 0;

      async function digest(bytes) {
        return K ? K.sha256Hex(bytes) : randomFrom(HEX, 64);
      }

      loop(s, async () => {
        const n = i++;
        const same = n % 3 !== 2;
        name.textContent = NAMES[n % NAMES.length];
        match.classList.add('m-hide');

        const data = crypto.getRandomValues(new Uint8Array(64));
        const hashA = await digest(data);
        let hashB = hashA;
        if (!same) {
          data[0] ^= 1;
          hashB = await digest(data);
        }

        await scramble(h1, hashA, 900, HEX);
        await sleep(300);
        await scramble(h2, hashB, 900, HEX);

        match.classList.toggle('bad', !same);
        icon.textContent = same ? '✓' : '✗';
        verdict.textContent = same ? 'COCOK' : 'BEDA';
        desc.textContent = same ? 'File utuh, tidak berubah' : 'File telah berubah (1 bit)';
        match.classList.remove('m-hide');
        await sleep(3200);
      });
    },
  };

  document.querySelectorAll('[data-mock]').forEach((el) => {
    const type = el.dataset.mock;
    if (!MOCKS[type]) return;
    el.innerHTML = '<div class="screen">' + MOCKS[type] + '</div>';
    el.setAttribute('aria-hidden', 'true');
    if (!reduceMotion) ANIMATORS[type](el.firstElementChild);
  });

  // ---------- Menu mobile ----------

  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.querySelectorAll('a').forEach((a) =>
    a.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );

  // ---------- Progress bar scroll ----------

  const progress = document.querySelector('.scroll-progress');
  let ticking = false;
  function updateProgress() {
    const max = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? scrollY / max : 0) + ')';
    ticking = false;
  }
  addEventListener('scroll', () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(updateProgress);
    }
  }, { passive: true });
  updateProgress();

  // ---------- Tab alur cara kerja ----------

  const flowTabs = document.querySelectorAll('.flow-tab');
  flowTabs.forEach((tab) =>
    tab.addEventListener('click', () => {
      flowTabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
        const panel = document.getElementById('flow-' + t.dataset.flow);
        panel.hidden = !active;
        if (active) panel.querySelectorAll('.reveal').forEach((el) => el.classList.add('shown'));
      });
    })
  );

  // ---------- Demo langsung ----------

  const demoMsg = document.getElementById('demo-msg');
  const demoPw = document.getElementById('demo-pw');
  const demoRun = document.getElementById('demo-run');
  const demoOut = document.getElementById('demo-output');
  const demoTests = document.getElementById('demo-tests');
  const demoVerdict = document.getElementById('demo-verdict');
  const encoder = new TextEncoder();
  let lastPacket = null;
  let lastPassword = '';

  function hexSpan(bytes, cls) {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = K.toHex(bytes);
    return span;
  }

  function demoRow(title, note, content) {
    const row = document.createElement('div');
    row.className = 'demo-row';
    const head = document.createElement('div');
    head.className = 'dr-head';
    const a = document.createElement('span');
    a.textContent = title;
    const b = document.createElement('span');
    b.textContent = note;
    head.append(a, b);
    const code = document.createElement('code');
    if (typeof content === 'string') code.textContent = content;
    else content.forEach((c) => code.appendChild(c));
    row.append(head, code);
    return row;
  }

  function showVerdict(ok, html) {
    demoVerdict.className = 'demo-verdict ' + (ok ? 'ok' : 'bad');
    demoVerdict.innerHTML = html;
    demoVerdict.hidden = false;
  }

  if (K && demoRun) {
    demoRun.addEventListener('click', async () => {
      const msg = demoMsg.value;
      const pw = demoPw.value;
      if (!msg || !pw) {
        demoOut.innerHTML = '<div class="demo-empty">Pesan dan kata sandi tidak boleh kosong.</div>';
        return;
      }
      demoRun.disabled = true;
      demoRun.textContent = 'Menghitung…';
      try {
        const plain = encoder.encode(msg);
        const t0 = performance.now();
        const { packet } = await K.encryptBytes(plain, pw);
        const ms = Math.round(performance.now() - t0);

        const H = K.SALT_LEN + K.IV_LEN;
        const salt = packet.slice(0, K.SALT_LEN);
        const iv = packet.slice(K.SALT_LEN, H);
        const ct = packet.slice(H, packet.length - K.TAG_LEN);
        const tag = packet.slice(packet.length - K.TAG_LEN);

        demoOut.innerHTML = '';
        demoOut.append(
          demoRow('1 · Plaintext (UTF-8)', plain.length + ' byte', K.toHex(plain)),
          demoRow('2 · Salt acak', '16 byte', [hexSpan(salt, 'hx-salt')]),
          demoRow('2 · IV / nonce acak', '12 byte', [hexSpan(iv, 'hx-iv')]),
          demoRow('3 · Kunci AES-256 (PBKDF2)', '200.000 iterasi · ' + ms + ' ms',
            'Kunci 256-bit tersimpan di memori sebagai CryptoKey yang tidak bisa diekspor, sehingga nilainya tidak bisa dibaca bahkan oleh halaman ini.'),
          demoRow('4 · Ciphertext', ct.length + ' byte (sama dengan plaintext)', [hexSpan(ct, 'hx-ct')]),
          demoRow('4 · Authentication tag', '16 byte', [hexSpan(tag, 'hx-tag')]),
          demoRow('5 · Paket lengkap (hex)', packet.length + ' byte = ' + plain.length + ' + 44',
            [hexSpan(salt, 'hx-salt'), hexSpan(iv, 'hx-iv'), hexSpan(ct, 'hx-ct'), hexSpan(tag, 'hx-tag')]),
          demoRow('5 · Hasil akhir (Base64)', 'siap disalin', K.bytesToBase64(packet))
        );

        lastPacket = packet;
        lastPassword = pw;
        demoTests.hidden = false;
        demoVerdict.hidden = true;
      } catch (err) {
        demoOut.innerHTML = '';
        demoOut.append(demoRow('Galat', '', err.message));
      } finally {
        demoRun.disabled = false;
        demoRun.textContent = 'Jalankan enkripsi';
      }
    });

    demoTests.querySelectorAll('[data-test]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!lastPacket) return;
        const test = btn.dataset.test;
        let packet = lastPacket;
        let pw = lastPassword;
        if (test === 'wrong') pw = lastPassword + 'x';
        if (test === 'tamper') {
          packet = lastPacket.slice();
          packet[K.SALT_LEN + K.IV_LEN] ^= 0x01;
        }
        try {
          const { plainBytes } = await K.decryptBytes(packet, pw);
          const text = new TextDecoder().decode(plainBytes);
          const span = document.createElement('span');
          span.textContent = text;
          showVerdict(true, '<b>✓ Dekripsi berhasil.</b> Tag cocok, pesan asli: <code>' + span.innerHTML + '</code>');
        } catch (err) {
          const why = test === 'wrong'
            ? 'Kata sandi <code>' + lastPassword.replace(/[&<>"]/g, '') + 'x</code> menghasilkan kunci yang berbeda.'
            : 'Satu bit pertama ciphertext dibalik, sehingga tag hasil hitung ulang tidak cocok.';
          showVerdict(false, '<b>✗ Dekripsi ditolak.</b> ' + why + ' Tidak ada data yang dikeluarkan.');
        }
      })
    );
  }

  if (reduceMotion) return;

  // ---------- Judul hero "didekripsi" ----------

  document.querySelectorAll('.scramble').forEach((el, idx) => {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    sleep(250 + idx * 350).then(() => scramble(el, text, 1300, GLYPHS));
  });

  // ---------- Angka statistik hero naik ----------

  document.querySelectorAll('.sc-num[data-to]').forEach((el, idx) => {
    const to = Number(el.dataset.to);
    const suffix = el.dataset.suffix || '';
    el.textContent = '0' + suffix;
    sleep(1100 + idx * 100).then(() => {
      const start = performance.now();
      const D = 1400;
      function frame(now) {
        const p = Math.min(1, (now - start) / D);
        el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))) + suffix;
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  });

  // ---------- Partikel hex di hero ----------

  const TOKENS = ['0x3F', 'AES', '1011', 'SHA-256', 'salt', '0xA9', 'GCM', 'IV', '0110', 'key', 'tag', '0x7E', 'PBKDF2', '256'];
  const particles = document.querySelector('.particles');
  TOKENS.forEach((t, idx) => {
    const p = document.createElement('span');
    p.className = 'particle';
    p.textContent = t;
    p.style.left = ((idx * 7.3 + Math.random() * 5) % 96) + '%';
    p.style.fontSize = 10 + Math.random() * 6 + 'px';
    p.style.animationDuration = 14 + Math.random() * 12 + 's';
    p.style.animationDelay = -Math.random() * 24 + 's';
    particles.appendChild(p);
  });

  // ---------- Strip teknologi berjalan ----------

  const marquee = document.querySelector('.marquee');
  const list = marquee.querySelector('.tech-list');
  Array.from(list.children).forEach((li) => {
    const clone = li.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    list.appendChild(clone);
  });
  marquee.classList.add('marquee-on');

  // ---------- Animasi muncul saat discroll ----------

  if (!hasIO) return;

  const groups = ['.flow-step', '.test-card', '.faq-list details', '.gloss-grid > div', '.why-card'];
  groups.forEach((sel) =>
    document.querySelectorAll(sel).forEach((el, idx) => {
      el.style.transitionDelay = (idx % 4) * 110 + 'ms';
    })
  );

  const curves = document.querySelectorAll('.curve path');
  curves.forEach((p) => {
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
  });

  const targets = document.querySelectorAll(
    '.feature, .flow-step, .test-card, .faq-list details, .cta-banner, .packet, ' +
      '.section-heading, .section-sub, .marquee, .curve, .gloss-grid > div, .why-card, .demo-card, .academic-card'
  );
  targets.forEach((el) => el.classList.add('reveal'));

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        el.classList.add('shown');
        if (el.classList.contains('curve')) {
          const path = el.querySelector('path');
          path.style.transition = 'stroke-dashoffset 3.2s ease';
          path.style.strokeDashoffset = '0';
        }
        io.unobserve(el);
      });
    },
    { threshold: 0.15 }
  );
  targets.forEach((el) => io.observe(el));
})();
