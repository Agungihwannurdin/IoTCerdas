# Dashboard AQMS Rev4 — CSV Fix v8

Perbaikan pada ZIP Rev4 yang Anda unggah. Tidak perlu mengganti firmware ESP32.

## Ubah website GitHub Pages
1. Buka repo GitHub `IoTCerdas`.
2. Ganti `app.js` dan `index.html` di ROOT repository dengan file baru dari ZIP ini. `style.css` dan folder `lib` tetap bisa digunakan seperti semula.
3. Commit, tunggu workflow Pages selesai (`Actions`), buka website dan tekan Ctrl+Shift+R atau gunakan tab InPrivate.
4. Pada Riwayat CSV pilih `feeds.csv` ThingSpeak atau `mYYYYMMDD.csv` ESP32.
5. Jika gagal, pesan harus diawali **CSV FIX v8**; kirim teks error itu beserta `feeds.csv` asli supaya struktur data dapat diperiksa.

## Penting
- `feeds.csv` ThingSpeak berbeda dengan file CSV asli SPIFFS; keduanya didukung.
- Jika masih tampil error yang berbunyi `Tidak ada baris data yang dikenali. Pastikan berkas m<tanggal>.csv`, itu berarti browser atau Github Pages **masih menggunakan kode lama**.
- Hanya Channel ID publik yang boleh disimpan di dashboard; jangan taruh Write API Key ThingSpeak di repository publik.
