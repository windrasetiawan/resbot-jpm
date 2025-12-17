import fs from "fs";
import { isOwner } from "../lib/utils.js";
import { saveOwner } from "../config.js";

const settingsPath = './DATABASE/settings.json';
const schedulePath = './DATABASE/group_schedule.json';

// Helper DB
const getSettings = () => {
    if (!fs.existsSync(settingsPath)) return { mode: 'self', antilink: [], autojoin: false };
    return JSON.parse(fs.readFileSync(settingsPath));
};
const saveSettings = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

// Pastikan DB Jadwal Ada
if (!fs.existsSync(schedulePath)) fs.writeFileSync(schedulePath, JSON.stringify({}));

// PENTING: Menerima 5 argumen
async function groupFeatures(sock, chatId, message, key, msg) {
    const isGroup = chatId.endsWith('@g.us');
    
    // Ambil sender dari msg object agar aman
    const sender = msg.key?.participant || msg.key?.remoteJid;
    
    if (!message) return;
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1);
    const q = parts.slice(1).join(" ");

    // --- AUTOJOIN COMMAND ---
    if (command === "autojoin") {
        if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });

        let db = getSettings();

        // Info jika tanpa argumen
        if (!q) {
            let status = db.autojoin ? "✅ AKTIF" : "⭕ MATI";
            return sock.sendMessage(chatId, { 
                text: `🤖 *AUTO JOIN GLOBAL*\nStatus: ${status}\n\nCara: .autojoin on/off` 
            }, { quoted: msg });
        }
        
        if (q === "on") {
            db.autojoin = true;
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "✅ Auto Join ON" }, { quoted: msg });
        } else if (q === "off") {
            db.autojoin = false;
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ Auto Join OFF" }, { quoted: msg });
        }
    }

    // --- ANTILINK COMMAND ---
    if (command === "antilink") {
        if (!isGroup) return sock.sendMessage(chatId, { text: "❌ Hanya untuk grup!" }, { quoted: msg });
        
        let db = getSettings();
        if (q === "on") {
            if (db.antilink.includes(chatId)) return sock.sendMessage(chatId, { text: "⚠️ Sudah ON." }, { quoted: msg });
            db.antilink.push(chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "✅ Antilink ON" }, { quoted: msg });
        } else if (q === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ Antilink OFF" }, { quoted: msg });
        } else {
             return sock.sendMessage(chatId, { text: "Gunakan: .antilink on/off" }, { quoted: msg });
        }
    }

    // --- FITUR LAIN ---
    if (command === "addowner") {
         if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });
         if (saveOwner(q)) return sock.sendMessage(chatId, { text: `✅ Owner ditambahkan: ${q}` }, { quoted: msg });
         else return sock.sendMessage(chatId, { text: "❌ Gagal." }, { quoted: msg });
    }

    if ((command === "open" || command === "close") && isGroup) {
        try {
            await sock.groupSettingUpdate(chatId, command === "close" ? "announcement" : "not_announcement");
            return sock.sendMessage(chatId, { text: `✅ Grup di-${command}.` });
        } catch {
            return sock.sendMessage(chatId, { text: "❌ Bot bukan admin!" });
        }
    }

    if ((command === "setopen" || command === "setclose") && isGroup) {
        if (!q.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
            return sock.sendMessage(chatId, { text: "⚠️ Format salah. Contoh: .setclose 22:00" });
        }
        const db = JSON.parse(fs.readFileSync(schedulePath));
        if (!db[chatId]) db[chatId] = {};
        const type = command === "setopen" ? "open" : "close";
        db[chatId][type] = q;
        fs.writeFileSync(schedulePath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `✅ Jadwal ${type} diatur: ${q}` });
    }
}

export default groupFeatures;
