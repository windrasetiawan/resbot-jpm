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
async function menu(sock, chatId, text, key, messageEvent) {
    // Ambil Nama User
    const pushName = messageEvent.pushName || "Kak";
    
    // Waktu & Tanggal (Format Pendek agar tidak kepanjangan)
    const time = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) + " WIB";
    const date = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: '2-digit' });
    
    // Info VPS (Ambil RAM saja biar pendek)
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
│ ➤ .ping
│ ➤ .menu
╰──────────────────

╭─「 👑 *OWNER MENU* 」
│ ➤ .self / .public
│ ➤ .addowner <nomor>
╰──────────────────

╭─「 🛡️ *GROUP SETTING* 」
│ ➤ .antilink on/off
│ ➤ .autojoin on/off
│ ➤ .listgc
╰──────────────────

╭─「 📂 *DATABASE* 」
│ ➤ .listhc
│ ➤ .clearhc
│ ➤ .addfile
│ ➤ .delallhc
│ ➤ .updatehc (ZIP FILE)
│ ➤ #wintuneling (semua config .hc)
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
