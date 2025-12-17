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
    
    // Waktu & Tanggal
    const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    const date = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    
    // Info VPS
    const platform = os.platform();
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2) + " GB";

    // --- LOGIKA BACA STATUS MODE (SELF/PUBLIC) ---
    let modeStatus = "PUBLIC 🟢"; // Default
    try {
        if (fs.existsSync('./DATABASE/settings.json')) {
            const db = JSON.parse(fs.readFileSync('./DATABASE/settings.json'));
            if (db.mode === 'self') {
                modeStatus = "SELF 🔴 (Private)";
            }
        }
    } catch (e) {}

    // --- TAMPILAN MENU ---
    const menuText = `
╔══════════════════════════╗
║ 🤖 *WINTUNELING BOT V3*
╠══════════════════════════╣
║ 👋 *Hi, ${pushName}*
║ ${getGreeting()}
║
║ 🔒 *Mode* : ${modeStatus}
║ 🕒 *Jam* : ${time}
║ 📅 *Tgl* : ${date}
║ ⏳ *Up* : ${getRuntime(process.uptime())}
║ 💻 *VPS* : ${platform} | RAM ${ram}
╚══════════════════════════╝

╭─「 🚀 *AUTO JPM PRO* 」
│ ➤ .autojpm <teks>
│ ➤ .autojpm time <menit>
│ ➤ .autojpm stop
╰──────────────────

╭─「 📡 *UTILITY* 」
│ ➤ .cekkuota <nomor>
│ ➤ .ping
│ ➤ .menu
╰──────────────────

╭─「 👑 *OWNER MENU* 」
│ ➤ .self / .public
│ ➤ .addowner <nomor>_
│ ➤ .delallhc
╰──────────────────

╭─「 🛡️ *GROUP SEC* 」
│ ➤ .antilink on/off
│ ➤ .autojoin on/off
│ ➤ .listgc
╰──────────────────

╭─「 📂 *DATABASE* 」
│ ➤ .listhc
│ ➤ #<namafile>
╰──────────────────
`;

    // Mengirim pesan menu
    await sock.sendMessage(chatId, { 
        text: menuText,
        mentions: [messageEvent.key.participant || chatId]
    }, { quoted: messageEvent });
}

export default menu;
