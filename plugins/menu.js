import fs from "fs";

// FUNGSI WAKTU & TANGGAL
const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
const date = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

// FUNGSI UCAPAN
const ucapanWaktu = () => {
    const jam = new Date().getHours();
    if (jam >= 0 && jam < 4) return "Dini Hari 🌑";
    if (jam >= 4 && jam < 10) return "Selamat Pagi ☀️";
    if (jam >= 10 && jam < 15) return "Selamat Siang 🌤️";
    if (jam >= 15 && jam < 18) return "Selamat Sore 🌇";
    return "Selamat Malam 🌙";
};

// EXPORT MENU UTAMA
const menu = (prefix, pushname, runtime, latensibot) => {
    return `
${ucapanWaktu()} *${pushname}*! 👋

🤖 *WINTUNELING VPN*
│ 📅 *Tanggal:* ${date}
│ ⌚ *Jam:* ${time}
│ ⚡ *Speed:* ${latensibot} ms
│ ⏳ *Uptime:* ${runtime}
│ 🔒 *Mode:* Public/Self
╰───────────────────

🚀 *JPM & BROADCAST*
(Fitur Utama)
│ ${prefix}jpm [teks/image]
│ ${prefix}jpmtag [teks/image] (JPM + Tag)
│ ${prefix}autojpm [teks/image] (Looping)
│ ${prefix}autojpm stop (Hentikan Loop)
│ ${prefix}autojpmsettime [jam] (Set Delay)
╰───────────────────

👥 *PUSH KONTAK*
│ ${prefix}pushkontak [teks]
│ (Kirim pesan ke semua member grup ini)
╰───────────────────

📂 *FILE MANAGER (HC/CONFIG)*
│ ${prefix}addhc / ${prefix}addfile (Reply file)
│ ${prefix}gethc [namafile]
│ ${prefix}listhc / ${prefix}listconfig
│ ${prefix}delhc [namafile]
│ ${prefix}delallhc (Hapus semua)
╰───────────────────

🏢 *GROUP FEATURES*
│ ${prefix}listgc (Daftar semua grup)
│ ${prefix}open (Buka grup)
│ ${prefix}close (Tutup grup)
│ ${prefix}setopen [jam:menit]
│ ${prefix}setclose [jam:menit]
│ ${prefix}antilink on/off
╰───────────────────

👑 *OWNER & SYSTEM*
│ ${prefix}self (Mode Sendiri)
│ ${prefix}public (Mode Umum)
│ ${prefix}autojoin on/off
│ ${prefix}addowner [nomor]
│ ${prefix}send [nomor] [pesan]
│ ${prefix}ping
╰───────────────────

⚠️ *Note:* - Gunakan fitur JPM dengan jeda aman agar nomor awet.
- File .hc tersimpan di folder *ADDTIONAL/files*.
`;
};

export default menu;
