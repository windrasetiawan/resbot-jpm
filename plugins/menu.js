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
    
    // Informasi Platform
    const platform = os.platform();
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + " GB";

    // --- TAMPILAN MENU ---
    const menuText = `
╔══════════════════════════╗
║   🤖 *WINTUNELING VPN*
╠══════════════════════════╣
║ 👋 *Hi, ${pushName}*
║ ${getGreeting()}
║
║ 🕒 *Jam* : ${time}
║ 📅 *Tgl* : ${date}
║ ⏳ *Uptime*: ${getRuntime(process.uptime())}
║ 💻 *Info* : ${platform} | RAM ${ram}
╚══════════════════════════╝

╭─「 🚀 *AUTO JPM (BARU)* 」
│ ➤ .autojpm <teks/link>
│    _(Kirim pesan ke semua grup)_
│ ➤ .autojpmsettime <menit>
│    _(Atur waktu istirahat loop)_
│ ➤ .autojpm stop
│    _(Hentikan proses JPM)_
╰──────────────────

╭─「 🛡️ *GROUP SECURITY* 」
│ ➤ .antilink on
│    _(Mode: 1x-2x Aman, 3x Hapus)_
│ ➤ .antilink off
│ ➤ .autojoin on/off
│    _(Otomatis masuk via link)_
│ ➤ .listgc
╰──────────────────

╭─「 🏢 *GROUP ADMIN* 」
│ ➤ .open
│ ➤ .close
│ ➤ .setopen <jam>
│ ➤ .setclose <jam>
│ ➤ .addowner <nomor>
╰──────────────────

╭─「 ⚙️ *FILE / SYSTEM* 」
│ ➤ .ping
│ ➤ .menu
│ ➤ .listhc
│ ➤ .gethc <namafile>
╰──────────────────

╭─「 📝 *CATATAN* 」
│ • JPM support kirim Gambar.
│ • Antilink reset setiap jam 00:00.
╰──────────────────
`;

    // Mengirim pesan menu
    await sock.sendMessage(chatId, { 
        text: menuText,
        // Mention user agar notif masuk
        mentions: [messageEvent.key.participant || chatId]
    }, { quoted: messageEvent });
}

export default menu;
