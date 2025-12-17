import fs from 'fs';
import os from 'os';

// --- HELPER FUNCTIONS ---
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 4) return 'Selamat Malam 🌚';
    if (hour < 11) return 'Selamat Pagi 🌞';
    if (hour < 15) return 'Selamat Siang 🌤️';
    if (hour < 19) return 'Selamat Sore 🌇';
    return 'Selamat Malam 🌚';
}

function getRuntime(seconds) {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    var dDisplay = d > 0 ? d + "d " : "";
    var hDisplay = h > 0 ? h + "h " : "";
    var mDisplay = m > 0 ? m + "m " : "";
    var sDisplay = s > 0 ? s + "s" : "";
    return dDisplay + hDisplay + mDisplay + sDisplay;
}

// PERBAIKAN: Menyesuaikan argumen dengan utils.js (5 argumen)
async function menu(sock, chatId, text, key, messageEvent) {
    // Ambil Pushname dari object messageEvent (msg)
    const pushName = messageEvent.pushName || "Kak";
    
    // Waktu & Tanggal
    const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    const date = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    // Tampilan Menu
    const menuText = `
╔══════════════════════════╗
║    *WINTUNELING VPN*
╠══════════════════════════╣
║ 👋 *Hi, ${pushName}*
║ ${getGreeting()}
║
║ 🕒 *Jam* : ${time}
║ 📅 *Tgl* : ${date}
║ ⏳ *Uptime*: ${getRuntime(process.uptime())}
╚══════════════════════════╝

╭─「 🔥 *POPULAR* 」
│ ➤ .autojpm
│ ➤ .ping
│ ➤ .menu
╰──────────────────

╭─「 🏢 *GROUP MENU* 」
│ ➤ .antilink on/off
│ ➤ .open / .close
│ ➤ .setopen <jam>
│ ➤ .setclose <jam>
│ ➤ .addowner <nomor>
│ ➤ .listgc
╰──────────────────

╭─「 ⚙️ *CONFIG / HC* 」
│ ➤ .listhc (Cek File)
│ ➤ .gethc <namafile>
│ ➤ .autojoin on/off
╰──────────────────

╭─「 📝 *NOTE* 」
│ Gunakan fitur dengan bijak.
│ Bot ini berjalan otomatis.
╰──────────────────
`;

    // Mengirim pesan
    await sock.sendMessage(chatId, { 
        text: menuText,
        mentions: [messageEvent.key.participant || messageEvent.key.remoteJid]
    }, { quoted: messageEvent });
}

export default menu;
