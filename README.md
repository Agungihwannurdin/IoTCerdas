# Dashboard AQMS Kelompok A — lokal + cloud

Buka `index.html` dari laptop atau unggah folder dashboard ke GitHub Pages. Vue telah disertakan secara lokal di `lib/`.

## Mode sumber data
- **Cloud ThingSpeak (direkomendasikan untuk online)**: Isi Channel ID numerik, pilih *Hubungkan*. Channel ThingSpeak wajib **Public**, tidak perlu API key baca.
- **ESP32 langsung**: akses melalui `http://IP_ESP32/api/data` hanya saat browser dan ESP32 berada di jaringan yang sama. Mode ini memang tidak berfungsi dari website HTTPS GitHub Pages karena mixed content/private network.
- **Berkas CSV**: pilih CSV dari SPIFFS, tidak perlu ESP32 online.
- **Demo**: simulasi grafik tanpa alat.

## Informasi penting
- ESP32 mengirim langsung ke ThingSpeak setiap **2 menit** dan **tetap** mengirim ketiga payload ke server RnD BiruLangit sesuai TOR.
- ThingSpeak memakai 8 field: CO2, PM2.5, suhu, RH, serta 4 flag validasi masing-masing.
- `created_at` berzona WIB +07:00 agar data cloud sesuai waktu slot ESP32.
- Dashboard cloud menampilkan flag outlier/range/sensor (tetap memakai raw value), tetapi **tidak** menampilkan data 1h_valid secara terpisah.
- Saat koneksi ThingSpeak gagal, tidak ada retry otomatis dalam firmware ke cloud. Data resmi tetap masuk antrean SPIFFS.
- Harap tidak meletakkan **Write API Key** atau password Wi-Fi di berkas dashboard yang diunggah ke GitHub. Dashboard hanya memerlukan Channel ID PUBLIK.
- Status "berbahaya/sehat" pada dashboard bersifat indikatif; CO2 dan PM2.5 adalah **data simulasi**, bukan pengukuran fisik.

Lihat `../PANDUAN_ONLINE.md` untuk konfigurasi firmware, ThingSpeak, dan GitHub Pages.
