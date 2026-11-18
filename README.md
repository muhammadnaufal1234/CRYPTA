# CRYPTA: Pengaman Pesan dan File

<p align="center"><img src="assets/crypta-logo.png" alt="Logo CRYPTA" width="520"></p>

Aplikasi web untuk enkripsi/dekripsi teks dan file dengan **AES-256-GCM**, kunci dari kata sandi via **PBKDF2-HMAC-SHA256 (200.000 iterasi)**, serta cek keutuhan file dengan **SHA-256**. Semua proses berjalan lokal di peramban (Web Crypto API), tanpa server.

## Menjalankan
Buka `index.html` (halaman utama) di Chrome/Edge/Firefox terbaru, lalu klik **Buka Aplikasi**. Aplikasinya ada di `app.html`, dengan deep link per fitur: `app.html#dashboard`, `#teks`, `#file`, `#hash`.

## Struktur
```
index.html            Halaman utama (landing page)
app.html              Aplikasi (Dashboard, Teks, File, Hash, Pengguna), wajib login
login.html            Halaman masuk / daftar akun lokal
css/landing.css       Tampilan halaman utama
css/animations.css    Animasi halaman utama
css/style.css         Tampilan aplikasi
css/login.css         Tampilan halaman login
js/crypto-core.js     Inti kriptografi (AES-GCM, PBKDF2, SHA-256, Base64)
js/activity.js        Riwayat aktivitas (SESI_PROSES), hanya metadata
js/auth.js            Akun login lokal (banyak akun, hash PBKDF2 + salt), sesi, riwayat login
js/login.js           Logika halaman login & pengukur kekuatan sandi
js/theme.js           Tombol tema gelap/terang
js/app.js             Logika antarmuka & dashboard
js/landing.js         Mockup beranimasi & interaksi halaman utama
assets/               Logo CRYPTA (PNG asli + emblem SVG) dan logo Universitas Pelita Bangsa
test/                 Pengujian otomatis skenario 4.3 proposal + akun login
```

## Login
Aplikasi tanpa server, jadi akun disimpan **lokal di peramban** (`localStorage`). Kata sandi login **tidak disimpan**: yang disimpan hanya salt acak 16 byte dan hash PBKDF2-HMAC-SHA256 (200.000 iterasi). Sesi tersimpan di `sessionStorage` dan berakhir saat tab ditutup. Satu peramban bisa memiliki banyak akun; menu **Pengguna** menampilkan akun terdaftar dan riwayat login (daftar, masuk, gagal, terkunci, keluar). Setelah 5 kali gagal, login akun tersebut dikunci 30 detik. Login ini adalah gerbang akses di sisi klien; kerahasiaan data tetap dijamin oleh enkripsi AES-256-GCM per pesan/file.

## Format paket terenkripsi
`salt (16 B) || IV (12 B) || ciphertext + auth tag (16 B)`, berupa Base64 untuk teks atau file biner `.enc`.

## Pengujian
```
node --test test/
```
