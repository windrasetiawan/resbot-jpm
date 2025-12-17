import fs from "fs";
import { saveOwner } from "../config.js"; // Pastikan path config benar

// Database Path
const schedulePath = './DATABASE/group_schedule.json';
const settingsPath = './DATABASE/settings.json';

// Helper Load DB Settings
const getSettings = () => {
    if (!fs.existsSync(settingsPath)) return { antilink: [], autojoin: false };
    return JSON.parse(fs.readFileSync(settingsPath));
};
const saveSettings = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

// Helper Load DB Schedule
if (!fs.existsSync(schedulePath)) fs.writeFileSync(schedulePath, JSON.stringify({}));

async function groupFeatures(sock, chatId, message, key, isGroup, sender) {
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1); // remove prefix
    const q = parts.slice(1).join(" ");

    // --- ANTILINK ON/OFF ---
    if (command === "antilink") {
        if (!isGroup) return sock.sendMessage(chatId, { text: "❌ Hanya untuk grup!" }, { quoted: key });
        // Tambahkan cek admin di sini jika perlu
        
        let db = getSettings();
        if (q === "on") {
            if (db.antilink.includes(chatId)) return sock.sendMessage(chatId, { text: "⚠️ Sudah ON." }, { quoted: key });
            db.antilink.push(chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "✅ Antilink Aktif!" }, { quoted: key });
        } else if (q === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ Antilink Mati." }, { quoted: key });
        } else {
            return sock.sendMessage(chatId, { text: `Status: ${db.antilink.includes(chatId) ? 'ON' : 'OFF'}\nKetik: .antilink on/off` }, { quoted: key });
        }
    }

    // --- AUTOJOIN ON/OFF ---
    if (command === "autojoin") {
        // Tambahkan cek owner di sini (if (!isOwner) return ...)
        
        let db = getSettings();
        if (q === "on") {
            db.autojoin = true;
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "✅ Auto Join Global: ON" }, { quoted: key });
        } else if (q === "off") {
            db.autojoin = false;
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ Auto Join Global: OFF" }, { quoted: key });
        } else {
            return sock.sendMessage(chatId, { text: `Status: ${db.autojoin ? 'ON' : 'OFF'}\nKetik: .autojoin on/off` }, { quoted: key });
        }
    }

    // --- ADD OWNER (Bawaan Lama) ---
    if (command === "addowner") {
        if (!q) return sock.sendMessage(chatId, { text: "⚠️ Format: .addowner 628xxx" });
        if (saveOwner(q)) return sock.sendMessage(chatId, { text: `✅ ${q} sekarang adalah owner.` });
        else return sock.sendMessage(chatId, { text: "⚠️ Nomor sudah ada atau format salah." });
    }

    // --- OPEN / CLOSE MANUAL ---
    if ((command === "open" || command === "close") && isGroup) {
        try {
            await sock.groupSettingUpdate(chatId, command === "close" ? "announcement" : "not_announcement");
            return sock.sendMessage(chatId, { text: `✅ Grup berhasil di-${command}.` });
        } catch {
            return sock.sendMessage(chatId, { text: "❌ Bot bukan admin!" });
        }
    }

    // --- SET OPEN / CLOSE JAM ---
    if ((command === "setopen" || command === "setclose") && isGroup) {
        if (!q.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
            return sock.sendMessage(chatId, { text: "⚠️ Format jam salah. Contoh: .setclose 22:00" });
        }
        const db = JSON.parse(fs.readFileSync(schedulePath));
        if (!db[chatId]) db[chatId] = {};
        const type = command === "setopen" ? "open" : "close";
        db[chatId][type] = q;
        fs.writeFileSync(schedulePath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `✅ Jadwal ${type} grup diatur ke jam ${q}` });
    }
}

export default groupFeatures;
