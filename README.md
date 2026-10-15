# Dashboard AQMS Kelompok A v3 (GitHub Pages)

Tiga menu tetap: **Monitoring Online**, **Riwayat CSV**, **Demo**. Grafik membandingkan Raw, Validated, Hourly ESP32. Channel publik ThingSpeak: **3538727**.

Untuk unggah: pilih seluruh **isi folder** ini dan letakkan di root repository `IoTCerdas` yang sudah ada, bukan folder pembungkus.

Catatan: data backlog dikirim lewat ThingSpeak Bulk Write dengan timestamp asli WIB (`created_at` menggunakan `+07:00`). Data Hourly ESP32 berada dalam `status` format `indoor|H1|epoch|mask|co2|pm25|temp|rh`.

**Jangan menaruh Write API Key di website atau repository publik.**


## Unduh CSV (pembaruan)

Pada menu **Riwayat CSV** sekarang tersedia:

1. **Unduh CSV ThingSpeak:** membuka endpoint publik `https://api.thingspeak.com/channels/3538727/feeds.csv?results=8000&days=365&status=true` untuk maksimal 8.000 entri terbaru dalam 365 hari terakhir. CSV ini berisi Field 1–8 dan status H1 jika tersedia; **bukan** salinan identik CSV asli SPIFFS. Browser dapat menampilkan isi CSV terlebih dahulu; gunakan Save As bila perlu. Unduhan melalui API tidak dipengaruhi pilihan 1/6/24 jam pada grafik.
2. **CSV Asli ESP32 (LAN):** isi alamat IP lokal ESP32 (contoh `192.168.1.100`) dari Serial Monitor, lalu klik **Buka daftar CSV**. Browser membuka halaman web ESP32 yang disediakan `Web.h`, dengan link `mYYYYMMDD.csv` dan `hYYYYMMDD.csv`. Perangkat pembuka harus berada di jaringan lokal ESP32 yang bisa mengakses IP tersebut. Karena dashboard GitHub Pages HTTPS tidak membaca API HTTP lokal, pengguna diarahkan melalui tautan navigasi, bukan `fetch`.
3. **Pilih berkas CSV:** buka file dari komputer untuk memvisualisasikannya. Parser dashboard saat ini mengenali format CSV SPIFFS; CSV ekspor ThingSpeak memiliki struktur berbeda sehingga untuk visualisasi gunakan menu Monitoring Online.

**Tidak ada perubahan pada firmware**, server RnD BiruLangit, komunikasi ThingSpeak, tiga mode dashboard, maupun penyimpanan SPIFFS. Akses unduh ESP32 lokal belum menggunakan autentikasi, maka jangan meneruskan port 80 router ke internet. Jangan masukkan Write API Key di GitHub Pages.
