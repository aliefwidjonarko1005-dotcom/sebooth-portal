# 🌟 Topologi Ekosistem Hardware Sebooth (Pro Setup)

Selamat! Dengan menambahkan **Laptop ke-2**, Anda baru saja meng- *upgrade* sistem Anda dari *Photobooth Rumahan* menjadi sistem *Production-Grade Enterprise*. Arsitektur ini **100% menyelesaikan masalah kursor lompat** tanpa perlu lagi menggunakan sistem pihak ketiga rumit seperti Aster.

Berikut adalah panduan *setup* peran dari masing-masing alat Anda di acara (*venue*):

---

## 1. LAPTOP 1 (Julukan: *The Engine / Server / Mesin Kolong*)
Ini adalah kuda pekerja utama Anda. Komputer ini melakukan semua pekerjaan berat (Render CPU, Koneksi Alat Berat) namun justru "diasingkan" dan disembunyikan.

* **Fungsi Utama:** Menjalankan aplikasi `.exe` Sebooth, memutar server ExpressJS lokal, dan memproses PDF printer.
* **Koneksi Fisik (Kabel):**
    * 📷 Colok kabel USB ke Kamera DSLR.
    * 🖨️ Colok kabel USB ke Printer Thermal/Photo.
* **Tindakan Operator di Awal Acara:**
    1. Nyalakan WiFi Portable Hotspot (Tethering) dari Laptop 1, misal dengan nama `Sebooth-Staff-Network`.
    2. Buka aplikasi Spacedesk (sebagai Host).
    3. Jalankan aplikasi `Sebooth.exe`.
    4. Setelah menyala, "geser" jendela aplikasi Sebooth ke layar Tablet (Monitor Eksternal Spacedesk) dan maksimalkan/Fullscreen (Alt+Enter / Tombol Toggle Fullscreen).
    5. Tutup layar laptop setengah, selipkan di bawah meja printer. **Selesai. Anda tidak akan pernah menyentuh *mouse/keyboard* laptop ini lagi selama acara berlangsung!**

---

## 2. TABLET (Julukan: *The Kiosk / Etalase Pengunjung*)
Ini adalah satu-satunya benda yang dilihat dan disentuh oleh para tamu.

* **Fungsi Utama:** Layar sentuh pengunjung (Pilih Frame, Timer, Retake, Klaim QR).
* **Koneksi:**
    * 🛜 Tersambung ke Spacedesk Client melalui USB (atau WiFi Hotspot Laptop 1).
    * Bertindak murni sebagai "Layar Eksternal" (Monitor ke-2) tambahan dari Laptop 1.
* **Tindakan Pengunjung:** Bebas menekan layar. Karena tidak ada yang sedang memegang *mouse* fisik di Laptop 1 (karena Laptop 1 disimpan di bawah meja), sentuhan tablet tidak akan menggangu siapapun.

---

## 3. LAPTOP 2 (Julukan: *The Operator Command Center*)
Inilah tahta Anda selaku Admin/Operator selama acara. Laptop ini berdiri merdeka secara perangkat keras.

* **Fungsi Utama:** Portal nirkabel untuk merubah Harga, mengaktifkan Frame, memonitor ☁️ Cloud Queue yang tertunda, dan melancarkan tembakan "Force Print" (Remote Print) jika kertas printer sempat habis.
* **Koneksi:**
    * 🛜 Hubungkan WiFi Laptop 2 ini ke `Sebooth-Staff-Network` (Hotspot yang dipancarkan oleh Laptop 1).
* **Tindakan Operator:**
    1. Anda **TIDAK PERLU** menginstal `Sebooth.exe` di sini. 
    2. Buka `Google Chrome`.
    3. Ketikkan alamat IP Laptop 1 di *address bar*, contoh: `http://192.168.137.1:5050/admin`.
    4. *BOOM!* Admin Dashboard Sebooth akan terbuka dengan antarmuka penuh, sama seperti versi lokal. 
    5. Karena Laptop 2 memiliki *mouse* dan OS Windows-nya sendiri yang terpisah secara genetik dari Laptop 1, Anda bebas mengklik apa pun, bekerja, bermain Spotify, selagi pengunjung berebut menyentuh Tablet Kiosk di depan.

---

### Kenapa Formasi Ini Jauh Lebih Sakti Daripada Aster?
- **Zero Configuration OS:** Anda tidak pusing berkutat dengan *virtual desktop* / partisi *virtual PC*.
- **Tanpa Batasan Kecepatan:** Kamera DSLR tetap terkoneksi secara PTP dengan kecepatan 30fps di mesin utama. Tidak ada *lag streaming* webcam.
- **Skalabilitas:** Kalau tiba-tiba Anda kebelet Pipis/Toilet, Anda bisa menitipkan Laptop 2 ke kru lain, lalu Anda mengamati mesin dari jauh memakai Handphone Pribadi (dengan Login ke WiFi yang sama)! Semuanya terhubung via Web Server.
