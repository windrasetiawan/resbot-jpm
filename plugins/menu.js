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

async function menu(sock, sender, message) {
    // Data Pengguna & Bot
    const pushName = message.pushName || "User";
    const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    const date = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    // Tampilan Menu Estetik
    const text = `
╔══════════════════════════╗
║ 🤖 *WINTUNELING VPN BOT*
╠══════════════════════════╣
║ 👋 *Hi, ${pushName}*
║ ${getGreeting()}
║
║ 🕒 *Jam* : ${time}
║ 📅 *Tgl* : ${date}
║ ⏳ *Uptime*: ${getRuntime(process.uptime())}
║ 🚀 *Mode* : Public / Pairing
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

    // Mengirim pesan dengan mention agar lebih personal
    await sock.sendMessage(sender, { 
        text: text,
        mentions: [sender]
    });
}

export default menu;
