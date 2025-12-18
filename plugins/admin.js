import { isOwner } from "../lib/utils.js";

async function admin(sock, chatId, message, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const parts = message.trim().split(" ");
    
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }
    const args = parts[1]?.toLowerCase();

    // Validasi Owner
    if (!isOwner(sender)) return; 

    // --- MENU AUTOJOIN ---
    if (command === "autojoin") {
        let db = global.db.settings; // Ambil RAM Global

        if (args === "on") {
            db.autojoin = true;
            global.saveSettings(); // Simpan Permanent
            return sock.sendMessage(chatId, { text: "✅ *Auto Join: ON*\nBot akan masuk ke semua link grup yang terdeteksi." }, { quoted: msg });
        } else if (args === "off") {
            db.autojoin = false;
            global.saveSettings(); // Simpan Permanent
            return sock.sendMessage(chatId, { text: "🛑 *Auto Join: OFF*" }, { quoted: msg });
        } else {
            return sock.sendMessage(chatId, { text: `Status Auto Join: *${db.autojoin ? 'ON' : 'OFF'}*\n\nKetik: *.autojoin on* atau *.autojoin off*` }, { quoted: msg });
        }
    }

    // --- MODE SELF/PUBLIC ---
    if (command === "self") {
        let db = global.db.settings;
        db.mode = 'self';
        global.saveSettings();
        return sock.sendMessage(chatId, { text: "🔒 *MODE SELF AKTIF*\nHanya Owner yang bisa menggunakan bot." }, { quoted: msg });
    }

    if (command === "public") {
        let db = global.db.settings;
        db.mode = 'public';
        global.saveSettings();
        return sock.sendMessage(chatId, { text: "🔓 *MODE PUBLIC AKTIF*\nSemua orang bisa menggunakan bot." }, { quoted: msg });
    }
}

export default admin;
