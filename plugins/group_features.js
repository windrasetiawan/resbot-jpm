import fs from "fs";
import { isOwner } from "../lib/utils.js";
import { saveOwner } from "../config.js";

const settingsPath = './DATABASE/settings.json';
const schedulePath = './DATABASE/group_schedule.json';

// DATABASE MEMORY (Reset setiap restart bot, atau reset harian via kode)
global.antilinkData = global.antilinkData || {
    date: new Date().getDate(),
    users: {} 
};

// Helper
const getSettings = () => fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath)) : { antilink: [], autojoin: false };
const saveSettings = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

if (!fs.existsSync(schedulePath)) fs.writeFileSync(schedulePath, JSON.stringify({}));

// --- FUNGSI UTAMA PENGECEKAN (Dipanggil Index.js) ---
export async function checkAntilink(sock, chatId, message, msg, sender, isAdmin) {
    // 1. Cek Reset Harian
    const today = new Date().getDate();
    if (global.antilinkData.date !== today) {
        global.antilinkData.date = today;
        global.antilinkData.users = {}; // Bersihkan semua dosa member
        console.log('[ANTILINK] Data di-reset (Ganti Hari)');
    }

    // 2. Cek DB & Admin
    let db = getSettings();
    if (!db.antilink.includes(chatId)) return false; // Fitur mati di grup ini
    if (isAdmin || isOwner(sender)) return false;    // Admin bebas

    // 3. Deteksi Link (Hanya True/False, dihitung 1x)
    const isLink = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i.test(message);

    if (isLink) {
        let count = (global.antilinkData.users[sender] || 0) + 1;
        global.antilinkData.users[sender] = count;

        if (count >= 3) {
            // === PELANGGARAN KE-3 (ACTION) ===
            // Hapus Pesan
            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch {}
            
            // Kirim Peringatan
            await sock.sendMessage(chatId, { 
                text: `⚠️ *BATAS PROMOSI HABIS (3/3)*\n@${sender.split('@')[0]} Jatah share link hari ini sudah habis.`,
                mentions: [sender]
            }, { quoted: msg });
            
            return true; // Stop proses
        } else {
            // === PELANGGARAN 1 & 2 (ALLOW) ===
            // Dibiarkan (Tidak dihapus)
            console.log(`[ANTILINK] @${sender.split('@')[0]} Link ke-${count} (Dibiarkan)`);
            return false;
        }
    }
    return false;
}

// --- COMMAND HANDLER (Setting Menu) ---
async function groupFeatures(sock, chatId, message, key, msg) {
    const isGroup = chatId.endsWith('@g.us');
    const sender = msg.key?.participant || msg.key?.remoteJid;
    if (!message) return;

    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1);
    const q = parts.slice(1).join(" ");

    // 1. AUTOJOIN
    if (command === "autojoin") {
        if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Khusus Owner" });
        let db = getSettings();
        if (q === "on") { db.autojoin = true; saveSettings(db); return sock.sendMessage(chatId, { text: "✅ Auto Join ON" }); }
        if (q === "off") { db.autojoin = false; saveSettings(db); return sock.sendMessage(chatId, { text: "⭕ Auto Join OFF" }); }
        return sock.sendMessage(chatId, { text: `Status AutoJoin: ${db.autojoin ? 'ON' : 'OFF'}` });
    }

    // 2. ANTILINK ON/OFF
    if (command === "antilink") {
        if (!isGroup) return;
        let db = getSettings();
        if (q === "on") {
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "✅ Antilink ON (Mode: 2x Bebas, 3x Hapus)" });
        }
        if (q === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ Antilink OFF" });
        }
        return sock.sendMessage(chatId, { text: "Gunakan: .antilink on/off" });
    }

    // 3. FITUR LAIN (Open/Close/AddOwner)
    if (command === "addowner" && isOwner(sender)) {
        saveOwner(q); return sock.sendMessage(chatId, { text: "✅ Owner ditambahkan" });
    }
    if ((command === "open" || command === "close") && isGroup) {
        try { await sock.groupSettingUpdate(chatId, command === "close" ? "announcement" : "not_announcement"); 
        sock.sendMessage(chatId, { text: "✅ Sukses" }); } catch {}
    }
}
export default groupFeatures;
