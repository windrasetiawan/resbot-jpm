import os from 'os';
import fs from 'fs';

async function menu(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".menu")) return;
    
    // Ambil info RAM
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) + "GB";
    
    // Cek Mode Public/Self dari Database
    let mode = 'PUBLIC';
    try {
        const db = JSON.parse(fs.readFileSync('./DATABASE/settings.json'));
        mode = db.mode ? db.mode.toUpperCase() : 'PUBLIC';
    } catch { }

    const txt = `╭───「 *WINTUNELINGVPN* 」
│ 🤖 *Status*: ONLINE
│ 🛡️ *Mode*: ${mode}
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
│ ➤ #namafile (No Caption)
│ ➤ #wintuneling (Send All)
│ ➤ #uploadhc (Delete All File)
│ ➤ #uploadhc (Reply Zip)
╰──────────────────────
╭─「 🛠️ *UTILITIES* 」
│ ➤ .cekxl <nomor>
│ ➤ .addowner <nomor>
│ ➤ .self / .public
╰──────────────────────`;

    await sock.sendMessage(chatId, { text: txt }, { quoted: msg });
}
export default menu;
