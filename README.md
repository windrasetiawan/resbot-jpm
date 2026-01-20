# 🤖 WINTUNELING VPN (WhatsApp Bot)

![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow?style=for-the-badge&logo=javascript)
![NodeJS](https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=node.js)
![Baileys](https://img.shields.io/badge/Baileys-Library-blue?style=for-the-badge&logo=whatsapp)

**ResBot JPM** adalah bot WhatsApp otomatisasi canggih yang dibangun menggunakan library [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys). Bot ini dikhususkan untuk kebutuhan **Broadcast (JPM)**, **Manajemen Grup**, dan **Manajemen File Config (VPN/SSH)**.

---

## ✨ Fitur Unggulan

### 📢 Broadcast & Marketing
- [x] **Auto JPM**: Broadcast otomatis ke seluruh grup dengan interval waktu yang dapat diatur.
- [x] **Manual JPM**: Kirim pesan broadcast (teks/gambar) sekali jalan.
- [x] **Push Kontak**: Kirim pesan pribadi (PC) ke seluruh member grup (Member Grabbing).
- [x] **JPM Tag**: Broadcast ke grup dengan *tag all* member.

### 🛡️ Manajemen Grup
- [x] **Anti Link**: Otomatis hapus link grup lain & kick pengirim (Max warning).
- [x] **Auto Join**: Bot otomatis masuk ke grup via link invite.
- [x] **Auto Open/Close**: Jadwal buka-tutup grup otomatis berdasarkan jam.
- [x] **List Grup**: Pantau daftar grup bot.

### 📂 Database & Store (HTTP Custom)
- [x] **Cloud Config**: Upload & simpan file `.hc` (HTTP Custom) di database bot.
- [x] **Cari & Hapus**: Cari file config atau hapus dari database.
- [x] **Broadcast Config**: Command khusus untuk menyebarkan semua file config tersimpan.

### 📥 Downloader & Tools
- [x] **TikTok No-Watermark**
- [x] **Instagram Downloader**
- [x] **Cek Kuota XL/Axis**
- [x] **Speed Test (Ping)**

---

## 🛠️ Persyaratan Sistem

* **Node.js**: v18.0.0 atau lebih baru.
* **FFmpeg**: (Opsional) Untuk fitur media/stiker.
* **Koneksi Internet**: Stabil untuk menjalan bot 24/7.

---

## 🚀 Instalasi & Penggunaan

Ikuti langkah-langkah ini untuk menjalankan bot di VPS atau komputer lokal:

### 1. Clone Repositori
```bash
git clone https://github.com/windrase/resbot-jpm.git
cd resbot-jpm
```
### 2. Instal Dependensi
```bash
npm install
```
### 3. Konfigurasi
Edit file config.js untuk menambahkan nomor WhatsApp Anda sebagai owner.
```bash
JavaScript
// config.js
global.owner = [
  "628xxxxxxxxxx", // Ganti dengan nomor Anda
  "628xxxxxxxxxx"
]
```
### 4. Jalankan Bot
```bash
npm start
```
