# AQMS Kelompok A — Dashboard Modern

Versi UI modern (navy/cyan) untuk GitHub Pages. Firmware ESP32 dan server dosen tidak berubah.

## Cara memperbarui repository `IoTCerdas`

1. Ekstrak ZIP terlebih dahulu.
2. Masuk ke repository GitHub `IoTCerdas` > tab **Code**.
3. Klik **Add file** > **Upload files**, lalu unggah **isi** folder dashboard (bukan ZIP, dan jangan menambah satu level folder). Jika GitHub meminta konfirmasi mengganti berkas bernama sama, setujui penggantian lalu Commit changes.
4. Pastikan `index.html`, `app.js`, dan `style.css` ada di root repository; `lib/vue.global.prod.js` berada di subfolder `lib`.
5. Buka kembali halaman GitHub Pages setelah deployment selesai (biasanya beberapa menit), lalu tekan **Ctrl + F5** untuk memuat versi terbaru.
6. Klik **Demo** untuk menampilkan contoh grafik tanpa ESP32. Ini **bukan** data sensor aktual.
7. Klik **Cloud ThingSpeak**, isi Channel ID publik, lalu klik **Hubungkan** untuk memantau data ESP32 sebenarnya dari cloud.

Jika repository GitHub menolak mengunggah file dengan nama sama, buka masing-masing berkas di GitHub dan edit/replace kontennya, atau gunakan GitHub Desktop untuk menyalin berkas baru dan Commit + Push.

## Menampilkan data otomatis untuk setiap pengunjung

Pada `app.js` baris awal, ubah:

```javascript
const PUBLIC_CHANNEL_ID = '';
```

menjadi:

```javascript
const PUBLIC_CHANNEL_ID = 'ISI_CHANNEL_ID_ANGKA';
```

Channel harus disetel **Public** di ThingSpeak. **Jangan** mengisi Write API Key atau password Wi-Fi di berkas website publik.

## Fungsi yang dipertahankan

- Cloud ThingSpeak: fetch HTTPS channel publik (refresh sekitar 40 detik)
- ESP32 langsung: hanya jaringan lokal (tidak melalui GitHub Pages HTTPS)
- CSV dari SPIFFS dan Demo
- Grafik suhu, kelembapan, CO₂, PM2.5 dengan outlier dan tooltip
- Ringkasan min, rata-rata, maks, status udara, rekomendasi otomatis, tabel data
- Tema gelap/terang/otomatis dan tampilan responsif untuk HP

**Penting:** CO₂ dan PM2.5 dari proyek tugas ini adalah nilai *simulasi*. Status kualitas udara bersifat indikatif untuk demonstrasi tugas, bukan penilaian kesehatan resmi.
