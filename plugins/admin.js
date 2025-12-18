import fs from "fs";
import { isOwner } from "../lib/utils.js";

const settingsPath = './DATABASE/settings.json';

const getDb = () => {
    if (!fs.existsSync(settingsPath)) return { mode: 'public', antilink: [], autojoin: false, owners: [] };
    return JSON.parse(fs.readFileSync(settingsPath));
};
const saveDb = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

async function admin(sock, chatId, message, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1); 
    const args = parts[1]?.toLowerCase();

    // 1. Validasi Owner di awal (Agar tidak perlu ditulis ulang di setiap if)
    if (!isOwner(sender)) return; 

    // --- MENU AUTOJOIN ---
    if (command === "autojoin") {
        let db = getDb();
        if (args === "on") {
            db.autojoin = true;
            saveDb(db);
            return sock.sendMessage(chatId, { text: "✅ *Auto Join: ON*\nBot akan masuk ke semua link grup yang terdeteksi." }, { quoted: msg });
        } else if (args === "off") {
            db.autojoin = false;
            saveDb(db);
            return sock.sendMessage(chatId, { text: "🛑 *Auto Join: OFF*" }, { quoted: msg });
        } else {
            return sock.sendMessage(chatId, { text: `Status Auto Join: *${db.autojoin ? 'ON' : 'OFF'}*\n\nKetik: *.autojoin on* atau *.autojoin off*` }, { quoted: msg });
        }
    }

    // --- MODE SELF ---
    if (command === "self") {
        let db = getDb();
        db.mode = 'self';
        saveDb(db);
        return sock.sendMessage(chatId, { text: "🔒 *MODE SELF AKTIF*\nHanya Owner yang bisa menggunakan bot." }, { quoted: msg });
    }

    // --- MODE PUBLIC ---
    if (command === "public") {
        let db = getDb();
        db.mode = 'public';
        saveDb(db);
        return sock.sendMessage(chatId, { text: "🔓 *MODE PUBLIC AKTIF*\nSemua orang bisa menggunakan bot." }, { quoted: msg });
    }
} // <--- Penutup fungsi admin HARUS ada di paling bawah

export default admin;
