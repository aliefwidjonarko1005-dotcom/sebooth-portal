# Sebooth - Photobooth Application

High-end desktop photobooth application built with Electron + React.

## Features

- **Camera Integration**: digiCamControl for PTP communication with DSLR/mirrorless cameras
- **Silent Printing**: Direct printing without dialog popup
- **Frame Overlays**: Customizable PNG frame overlays with flexible positioning
- **LUT Filters**: Apply .CUBE color grading filters
- **Supabase Backend**: Cloud storage and session logging

## 🚀 Cara Clone & Setup Project (Panduan Lengkap)

Ikuti langkah-langkah di bawah ini untuk meng-clone dan menjalankan project Sebooth di komputer/laptop baru:

### 1. Persiapan Requirement
Pastikan laptop/PC Anda sudah terinstall:
- **[Node.js](https://nodejs.org/)** (Rekomendasi versi LTS terbaru: v18 atau v20).
- **[Git](https://git-scm.com/)** untuk melakukan cloning.
- *Opsional tapi direkomendasikan:* **VS Code** sebagai Code Editor.

### 2. Clone Repository
Buka Terminal/Command Prompt (atau Git Bash), lalu jalankan perintah berikut:
```bash
# Clone repository dari github
git clone https://github.com/USERNAME_ANDA/Sebooth.git

# Masuk ke dalam folder project
cd Sebooth
```
*(Catatan: Ganti URL di atas dengan link repository GitHub Sebooth milik Anda)*

### 3. Install Dependencies
Setelah masuk ke folder `Sebooth`, install seluruh package yang dibutuhkan oleh Electron dan React:
```bash
npm install
```

### 4. Menjalankan Aplikasi (Development)
Untuk menjalankan Sebooth dalam mode development (bisa refresh otomatis saat diedit):
```bash
npm run dev
```

### 5. Build Aplikasi (.exe)
Jika Anda ingin membungkus aplikasi menjadi file `.exe` yang siap diinstall di PC klien/Photobooth:
```bash
npm run build:win
```
Hasil file installer akan muncul di dalam folder `dist/`.

## Camera Setup

1. Install [digiCamControl](http://digicamcontrol.com/download) on Windows
2. Connect your camera via USB
3. Set camera to "PC Connect" or "Tethered" mode
4. The app will auto-detect connected cameras

## Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Copy `.env.example` to `.env`
3. Fill in your Supabase URL and anon key

## Project Structure

```
src/
├── main/           # Electron main process
├── preload/        # Preload scripts (context bridge)
├── renderer/       # React frontend
└── shared/         # Shared types
```
