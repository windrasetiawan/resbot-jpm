import os from 'os';

async function menu(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".menu")) return;
    const ram = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) + "GB";
    
    const txt = `╭───「 *WINTUNELINGVPN* 」
│ 🤖 *Status*: ONLINE
│ 💻 *RAM*: ${ram}
╰──────────────────────
╭─「 🚀 *BROADCAST* 」
│ ➤ .jpm <teks>
│ ➤ .pushkontak <teks>
│ ➤ .autojpm on/off/set
╰──────────────────────
╭─「 📂 *DATABASE HC* 」
│ ➤ .addhc (Reply File)
│ ➤ .listhc
│ ➤ .delhc <nama>
│ ➤ #namafile
│ ➤ #wintuneling (All Zip)
│ ➤ #uploadhc (Reply Zip)
╰──────────────────────
╭─「 🛠️ *UTILITIES* 」
│ ➤ .cekkuota <nomor>
│ ➤ .addowner <nomor>
╰──────────────────────`;

    await sock.sendMessage(chatId, { text: txt }, { quoted: msg });
}
export default menu;
