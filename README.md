# AQMS Kelompok A — Monitoring Online + CSV + Demo

Dashboard GitHub Pages telah disederhanakan menjadi tiga sumber data:

- **Monitoring Online**: membaca feed publik **ThingSpeak Channel ID `3538727`** melalui HTTPS, refresh setiap ~40 detik. Pembacaan langsung saat website dibuka, tidak memerlukan laptop selalu menyala.
- **Riwayat CSV**: memilih file `m<dayKey>.csv` dari penyimpanan SPIFFS.
- **Demo**: simulasi tampilan (bukan data sensor nyata), bergerak setiap ~4 detik.

Mode `ESP32 langsung` dari website dihilangkan. Ini tidak mematikan atau menghapus server web yang ada pada firmware ESP32 dan tidak mengubah pengiriman tugas ke server RnD BiruLangit.

## Cara pasang ke repository GitHub `IoTCerdas`
1. Ekstrak ZIP dashboard ini.
2. Perbarui `index.html`, `app.js`, dan `style.css` pada root repository `IoTCerdas`. Pastikan subfolder `lib/` beserta Vue.js tetap ada.
3. Bila pengunggahan nama file yang sama tidak berhasil dari GitHub web, edit file di repository atau gunakan GitHub Desktop untuk mengganti file, Commit dan Push. Jangan menaruh ZIP sebagai satu file di repository.
4. Tunggu tab **Actions** menunjukkan GitHub Pages berhasil, lalu buka website Anda dan tekan `Ctrl+F5`.
5. Klik **Demo** untuk memeriksa grafik; klik **Monitoring Online** untuk membaca channel publik ThingSpeak.

## Konfigurasi / keamanan
- Channel ID berada pada konstanta `PUBLIC_CHANNEL_ID` di `app.js`, sudah berisi `3538727` (boleh publik).
- **Jangan taruh `Write API Key`, password Wi-Fi, atau token firmware di file GitHub**. Kunci Write API yang terlihat dalam screenshot sebaiknya segera diganti di ThingSpeak. Setelah diganti, isi Write API Key baru pada firmware ESP32 yang mengirim data cloud, lalu unggah ulang firmware.
- Dashboard membutuhkan channel ThingSpeak berstatus **Public** agar feed bisa dibaca tanpa Read API Key.
- ESP32 masih harus menyala dan terhubung internet agar data aktual terus masuk. Menampilkan dashboard tidak membuktikan ESP32 sedang online; periksa waktu record terakhir.
- CO₂ dan PM2.5 dalam tugas berasal dari simulator, sedangkan SHT31 dibaca secara fisik.
- Jika data cloud kosong: periksa Field 1–8, status Public, firmware cloud aktif, Write API Key terbaru, Serial Monitor, dan feed channel.

## Alur arsitektur

ESP32 (Wi-Fi) ├→ HTTPS server RnD BiruLangit (tugas dosen)
             └→ HTTPS ThingSpeak → website GitHub Pages

Hosting statis GitHub Pages tidak menyimpan maupun mengirim data sensor sendiri.
