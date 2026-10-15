# Dashboard AQMS Kelompok A v3 (GitHub Pages)

Tiga menu tetap: **Monitoring Online**, **Riwayat CSV**, **Demo**. Grafik membandingkan Raw, Validated, Hourly ESP32. Channel publik ThingSpeak: **3538727**.

Untuk unggah: pilih seluruh **isi folder** ini dan letakkan di root repository `IoTCerdas` yang sudah ada, bukan folder pembungkus.

Catatan: data backlog dikirim lewat ThingSpeak Bulk Write dengan timestamp asli WIB (`created_at` menggunakan `+07:00`). Data Hourly ESP32 berada dalam `status` format `indoor|H1|epoch|mask|co2|pm25|temp|rh`.

**Jangan menaruh Write API Key di website atau repository publik.**
