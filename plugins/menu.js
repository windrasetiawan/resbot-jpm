import os from 'os';
import fs from 'fs';

// Helper: Format Uptime
const formatUptime = (seconds) => {
    seconds = Number(seconds);
    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);
    return `${d}d ${h}h ${m}m ${s}s`;
};

async function menu(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".menu")) return;

    // 🔥 1. REACTION (Biar terlihat interaktif)
    await sock.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });

    // 🔥 2. SIMULASI MENGETIK (PENTING ANTI-BAN)
    await sock.sendPresenceUpdate('composing', chatId);

    // 🔥 3. DELAY RANDOM (1-2 Detik)
    await new Promise(r => setTimeout(r, 1000 + Math.random() * 1000));
    
    // Logic Data
    const date = new Date();
    const hour = date.getHours();
    let ucapan = "Malam 🌑";
    if (hour >= 4 && hour < 11) ucapan = "Pagi ☀️";
    else if (hour >= 11 && hour < 15) ucapan = "Siang 🌤️";
    else if (hour >= 15 && hour < 18) ucapan = "Sore 🌇";

    const jam = date.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' });
    const uptime = formatUptime(os.uptime());
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) + "GB";
    
    let osName = os.type(); 
    try {
        if (fs.existsSync('/etc/os-release')) {
            const data = fs.readFileSync('/etc/os-release', 'utf8');
            const match = data.match(/PRETTY_NAME="([^"]+)"/);
            if (match) osName = match[1]; 
        }
    } catch (e) { }

    let mode = 'PUBLIC';
    try {
        const db = JSON.parse(fs.readFileSync('./DATABASE/settings.json'));
        mode = db.mode ? db.mode.toUpperCase() : 'PUBLIC';
    } catch { }

    const txt = `╭───「 *WINTUNELING VPN* 」
│ 👋 *Selamat ${ucapan}*
│ 🤖 *Status*: ONLINE
│ 🛡️ *Mode*: ${mode}
│ ⌚ *Jam*: ${jam} WIB
│ 🖥️ *OS*: ${osName}
│ ⏳ *Uptime*: ${uptime}
│ 💻 *RAM*: ${ram}
╰──────────────────────
╭─「 🚀 *BROADCAST* 」
│ ➤ .jpm <teks>
│ ➤ .pushkontak <teks>
│ ➤ .autojpm on/off/set
╰──────────────────────
╭─「 🛡️ *GROUP SETTING* 」
│ ➤ .antilink on/off
│ ➤ .autojoin on/off
│ ➤ .setopen
│ ➤ .setclose
│ ➤ .cektime / .deltime
╰──────────────────────
╭─「 📂 *DATABASE HC* 」
│ ➤ .addhc (Reply File)
│ ➤ .listhc
│ ➤ .delhc <nama>
│ ➤ #delallhc (Delete All)
│ ➤ #namafile (No Caption)
│ ➤ #wintuneling (Send All)
│ ➤ #uploadhc (Reply Zip)
╰──────────────────────
╭─「 🛠️ *UTILITIES* 」
│ ➤ .cekxl <nomor>
│ ➤ .tt <link tiktok>
│ ➤ .ig <link instagram>
│ ➤ .addowner <nomor>
│ ➤ .self / .public
╰──────────────────────`;

    // Kirim Pesan
    await sock.sendMessage(chatId, { text: txt }, { quoted: msg });
    
    // Berhenti Mengetik
    await sock.sendPresenceUpdate('paused', chatId);
}
export default menu;
