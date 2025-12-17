import fs from "fs";
import { isOwner } from "../lib/utils.js";

// Lokasi Database
const settingsPath = './DATABASE/settings.json';

// Helper Baca/Tulis DB
const getDb = () => {
    if (!fs.existsSync(settingsPath)) return { mode: 'self', antilink: [], autojoin: false };
    return JSON.parse(fs.readFileSync(settingsPath));
};
const saveDb = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

async function admin(sock, chatId, message, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1);

    // --- MODE SELF (Hanya Owner) ---
    if (command === "self") {
        if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });
        
        let db = getDb();
        db.mode = 'self';
        saveDb(db);
        return sock.sendMessage(chatId, { text: "🔒 *MODE SELF AKTIF*\nHanya Owner yang bisa menggunakan bot." }, { quoted: msg });
    }

    // --- MODE PUBLIC (Semua Orang) ---
    if (command === "public") {
        if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });
        
        let db = getDb();
        db.mode = 'public';
        saveDb(db);
        return sock.sendMessage(chatId, { text: "🔓 *MODE PUBLIC AKTIF*\nSemua orang bisa menggunakan bot." }, { quoted: msg });
    }
}

export default admin;
