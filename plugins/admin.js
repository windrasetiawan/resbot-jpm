import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

// Arahkan ke file database yang benar
const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");

async function admin(sock, chatId, message, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const parts = message.trim().split(" ");
    
    // Handle prefix . atau # atau tanpa prefix
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }
    const args = parts[1]?.toLowerCase();

    // Validasi Owner (Wajib)
    if (!isOwner(sender)) return; 

    // Baca database saat ini
    let db = {};
    if (fs.existsSync(settingsPath)) {
        db = JSON.parse(fs.readFileSync(settingsPath));
    } else {
        db = { mode: 'public', antilink: [], autojoin: false, owners: [], schedule: {} };
    }

    // --- MENU AUTOJOIN ---
    if (command === "autojoin") {
        if (args === "on") {
            db.autojoin = true;
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *Auto Join: ON*\nBot akan otomatis masuk jika ada link grup." }, { quoted: msg });
        } else if (args === "off") {
            db.autojoin = false;
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "🛑 *Auto Join: OFF*" }, { quoted: msg });
        } else {
            return sock.sendMessage(chatId, { text: `Status Auto Join: *${db.autojoin ? 'ON' : 'OFF'}*\n\nKetik: *.autojoin on* atau *.autojoin off*` }, { quoted: msg });
        }
    }

    // --- MODE SELF/PUBLIC ---
    if (command === "self") {
        db.mode = 'self';
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: "🔒 *MODE SELF AKTIF*\nHanya Owner yang bisa menggunakan bot." }, { quoted: msg });
    }

    if (command === "public") {
        db.mode = 'public';
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: "🔓 *MODE PUBLIC AKTIF*\nSemua orang bisa menggunakan bot." }, { quoted: msg });
    }
}

export default admin;
