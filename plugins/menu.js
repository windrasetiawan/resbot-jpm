import fs from 'fs';
import os from 'os';

// --- HELPER: Ucapan Waktu ---
function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 4) return 'Malam 🌚';
    if (hour < 11) return 'Pagi 🌞';
    if (hour < 15) return 'Siang 🌤️';
    if (hour < 19) return 'Sore 🌇';
    return 'Malam 🌚';
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
async function menu(sock, chatId, message, key, msg) {
    // 1. Parsing Command
    const parts = message.trim().split(" ");
    let command = parts[0]?.toLowerCase();
    
    // Support prefix . atau #
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }

    // 2. Cek apakah user mengetik .menu atau .help
    if (command === "menu" || command === "help" || command === "list") {
        
        // Ambil Nama User
        const pushName = msg.pushName || "Kak";
        
        // Waktu & Tanggal
        const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + " WIB";
        const date = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: '2-digit' });
        
        // Info VPS
        const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) + "GB";

        // --- BACA STATUS MODE ---
        let modeStatus = "PUBLIC 🟢"; 
        try {
            if (fs.existsSync('./DATABASE/settings.json')) {
                const db = JSON.parse(fs.readFileSync('./DATABASE/settings.json'));
                if (db.mode === 'self') modeStatus = "SELF 🔴";
            }
        } catch (e) {}

        const menuText = `
╭───「 *WINTUNELING VPN* 」
│
│ 👋 *Hi, ${pushName}*
│ ${getGreeting()}
│
│ 🔒 *Mode* : ${modeStatus}
│ 🕒 *Jam* : ${time}
│ 📅 *Tgl* : ${date}
│ ⏳ *Up* : ${getRuntime(process.uptime())}
│ 💻 *Spec* : RAM ${ram}
╰────────────────────────

╭─「 🚀 *AUTO JPM* 」
│ ➤ .autojpm <teks>
│ ➤ .autojpm time <menit>
│ ➤ .autojpm stop
╰──────────────────

╭─「 📡 *UTILITY* 」
│ ➤ .cekkuota <nomor>
│ ➤ .tiktok <link>
│ ➤ .ping
│ ➤ .menu
╰──────────────────

╭─「 👑 *OWNER MENU* 」
│ ➤ .self / .public
│ ➤ .addowner <nomor>
╰──────────────────

╭─「 🛡️ *GROUP SETTING* 」
│ ➤ .antilink on/off
│ ➤ .add <nomor>
│ ➤ .group open/close
│ ➤ .setclose / .setopen <jam>
╰──────────────────

╭─「 📂 *DATABASE* 」
│ ➤ .listhc
│ ➤ .clearhc
│ ➤ .addhc <reply file>
│ ➤ .delhc <namafile>
│ ➤ .updatehc (Kirim ZIP)
│ ➤ #wintuneling (semua config)
│ ➤ #<namafile> (ambil satu)
╰──────────────────
`;

        // Mengirim pesan menu
        await sock.sendMessage(chatId, { 
            text: menuText,
            // Tambahkan gambar/video jika mau, ganti 'text' jadi 'caption'
            mentions: [msg.key.participant || chatId]
        }, { quoted: msg });
    }
}

export default menu;
