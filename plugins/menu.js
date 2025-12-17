import fs from 'fs';
import os from 'os';

// --- HELPER: Ucapan Waktu ---
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 4) return 'Selamat Malam 🌚';
    if (hour < 11) return 'Selamat Pagi 🌞';
    if (hour < 15) return 'Selamat Siang 🌤️';
    if (hour < 19) return 'Selamat Sore 🌇';
    return 'Selamat Malam 🌚';
}

// --- HELPER: Uptime Bot ---
function getRuntime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    return `${d > 0 ? d + "h " : ""}${h > 0 ? h + "j " : ""}${m > 0 ? m + "m " : ""}${s}d`;
}

// --- FUNGSI UTAMA MENU ---
async function menu(sock, chatId, text, key, messageEvent) {
    // Ambil Nama User
    const pushName = messageEvent.pushName || "Kak";
    
    // Waktu & Tanggal (WIB)
    const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    const date = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    // Informasi Platform VPS
    const platform = os.platform();
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + " GB";

    // --- TAMPILAN MENU ---
    const menuText = `
╔══════════════════════════╗
║ 🤖 *WINTUNELING BOT V3*
╠══════════════════════════╣
║ 👋 *Hi, ${pushName}*
║ ${getGreeting()}
║
║ 🕒 *Jam* : ${time}
║ 📅 *Tgl* : ${date}
║ ⏳ *Uptime*: ${getRuntime(process.uptime())}
║ 💻 *VPS* : ${platform} | RAM ${ram}
╚══════════════════════════╝

╭─「 🚀 *AUTO JPM* 」
│ ➤ .autojpm <teks/link>
│    _(Kirim pesan + tombol join)_
│ ➤ .autojpm time <menit>
│    _(Atur waktu istirahat loop)_
│ ➤ .autojpm stop
│    _(Matikan JPM)_
╰──────────────────

╭─「 📡 *TOOLS & UTILITY* 」
│ ➤ .cekkuota <nomor>
│    _(Cek XL/Axis via Sidompul)_
│ ➤ .ping
│    _(Cek kecepatan bot)_
│ ➤ .menu
│    _(Tampilkan pesan ini)_
╰──────────────────

╭─「 🛡️ *GROUP SECURITY* 」
│ ➤ .antilink on
│    _(Mode: 1-2x Aman, 3x Hapus)_
│ ➤ .antilink off
│    _(Matikan Antilink)_
│ ➤ .autojoin on/off
│    _(Auto masuk grup via link)_
╰──────────────────

╭─「 🏢 *MANAJEMEN GRUP* 」
│ ➤ .open / .close
│    _(Buka/Tutup Grup)_
│ ➤ .setopen <jam>
│    _(Jadwal Buka Otomatis)_
│ ➤ .setclose <jam>
│    _(Jadwal Tutup Otomatis)_
│ ➤ .listgc
│    _(List Grup Bot)_
│ ➤ .addowner <nomor>
╰──────────────────

╭─「 📂 *DATABASE FILE* 」
│ ➤ .listhc
│ ➤ .gethc <namafile>
│ ➤ #<namafile>
│    _(Cara cepat ambil file)_
╰──────────────────

╭─「 📝 *CATATAN* 」
│ • JPM Native: Kirim teks berisi link
│   grup agar muncul tombol Join.
│ • Cek Kuota butuh waktu ±5 detik.
╰──────────────────
`;

    // Mengirim pesan menu
    await sock.sendMessage(chatId, { 
        text: menuText,
        // Mention user agar notif masuk (Bold nama user di menu)
        mentions: [messageEvent.key.participant || chatId]
    }, { quoted: messageEvent });
}

export default menu;
