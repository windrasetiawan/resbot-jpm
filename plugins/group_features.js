import fs from "fs";
import { isOwner } from "../lib/utils.js";
// saveOwner dihapus karena fitur addowner sudah tidak di sini

const settingsPath = './DATABASE/settings.json';
const schedulePath = './DATABASE/group_schedule.json';

// --- DATABASE MEMORY (RAM) ---
// global.antilinkData menyimpan warning user hari ini
global.antilinkData = global.antilinkData || {
    date: new Date().getDate(), // Tanggal hari ini
    users: {}                   // { '628xxx': jumlah_warning }
};

// Helper Load Database
const getSettings = () => {
    try {
        if (!fs.existsSync(settingsPath)) return { mode: 'self', antilink: [], autojoin: false };
        return JSON.parse(fs.readFileSync(settingsPath));
    } catch { return {}; }
};
const saveSettings = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

if (!fs.existsSync(schedulePath)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE', { recursive: true });
    fs.writeFileSync(schedulePath, JSON.stringify({}));
}


// ==========================================
//  FUNGSI PENDETEKSI ANTILINK (Logika Baru)
// ==========================================
export async function checkAntilink(sock, chatId, message, msg, sender, isAdmin) {
    // 1. Cek RESET Harian (Jam 00:00)
    const today = new Date().getDate();
    if (global.antilinkData.date !== today) {
        console.log(`[ANTILINK] Reset data harian (${global.antilinkData.date} -> ${today})`);
        global.antilinkData.date = today;
        global.antilinkData.users = {}; // Reset semua ke 0
    }

    // 2. Cek apakah fitur Antilink aktif di grup ini
    let db = getSettings();
    if (!db.antilink || !db.antilink.includes(chatId)) return false;

    // 3. Admin & Owner bebas kirim link
    if (isAdmin || isOwner(sender)) return false;

    // 4. Cek Link Grup WhatsApp
    const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
    const isLink = linkRegex.test(message); 

    // 5. EKSEKUSI JIKA ADA LINK
    if (isLink) {
        // Ambil jumlah warning saat ini (default 0)
        let count = global.antilinkData.users[sender] || 0;
        
        // Tambah Warning
        count++;
        global.antilinkData.users[sender] = count;

        // --- LOGIKA HUKUMAN BERTAHAP ---
        if (count >= 3) {
            // == PELANGGARAN KE-3 (ACTION: DELETE + WARNING) ==
            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch {}

            await sock.sendMessage(chatId, { 
                text: `⚠️ *PROMOSI 2X AJA BRO*\n\n@${sender.split('@')[0]} Promosi jangan banyak banyak bang ulang besok lagi`,
                mentions: [sender]
            }, { quoted: msg });

            return true; // Stop proses (pesan dihapus)

        } else {
            // == PELANGGARAN KE-1 & KE-2 (ALLOW / BIARKAN) ==
            console.log(`[ANTILINK] ${sender.split('@')[0]} Promosi ke-${count} (Dibiarkan)`);
            return false; // Lanjut proses (pesan tidak dihapus)
        }
    }
    return false;
}


// ==========================================
//  COMMAND HANDLER (Menu Setting)
// ==========================================
async function groupFeatures(sock, chatId, message, key, msg) {
    const isGroup = chatId.endsWith('@g.us');
    const sender = msg.key?.participant || msg.key?.remoteJid;
    
    if (!message) return;
    const parts = message.trim().split(" ");
    let command = parts[0]?.toLowerCase();
    
    // Support prefix . atau #
    if (command.startsWith(".") || command.startsWith("#")) {
        command = command.substring(1);
    }
    
    const args = parts.slice(1);
    const q = args.join(" ");

    // Cek Admin Bot (untuk fitur open/close)
    let isBotAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        const bot = meta.participants.find(x => x.id === sock.user.id.split(':')[0] + '@s.whatsapp.net');
        isBotAdmin = (bot?.admin === 'admin' || bot?.admin === 'superadmin');
    } catch {}
    
    // Cek Admin Pengirim (untuk validasi akses)
    let isAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        const p = meta.participants.find(x => x.id === sender);
        isAdmin = (p?.admin === 'admin' || p?.admin === 'superadmin');
    } catch {}

    // [DIHAPUS] .autojoin (Sudah ada di admin.js)

    // --- ANTILINK SETTING ---
    if (command === "antilink") {
        if (!isGroup) return sock.sendMessage(chatId, { text: "❌ Hanya untuk grup!" }, { quoted: msg });
        if (!isAdmin) return sock.sendMessage(chatId, { text: "❌ Khusus Admin Grup!" }, { quoted: msg });
        
        let db = getSettings();
        if (!db.antilink) db.antilink = [];

        if (args[0] === "on") {
            if (db.antilink.includes(chatId)) return sock.sendMessage(chatId, { text: "⚠️ Sudah ON." }, { quoted: msg });
            db.antilink.push(chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { 
                text: "✅ *Antilink ON*\n\nAturan:\n- PROMOSI MAX 2X DALAM SEHARI JIKA MELEBIHI BATAS AKAN DI HAPUS OTOMATIS!!" 
            }, { quoted: msg });
        } else if (args[0] === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ Antilink OFF" }, { quoted: msg });
        } else {
             return sock.sendMessage(chatId, { text: "Gunakan: .antilink on/off" }, { quoted: msg });
        }
    }

    // [DIHAPUS] .addowner (Sudah ada di index.js)

    // --- GROUP OPEN/CLOSE ---
    if ((command === "open" || command === "close" || command === "grup" || command === "group") && isGroup) {
        if (!isAdmin) return sock.sendMessage(chatId, { text: "❌ Khusus Admin Grup!" }, { quoted: msg });
        if (!isBotAdmin) return sock.sendMessage(chatId, { text: "❌ Bot bukan Admin!" }, { quoted: msg });

        // Handle variasi command
        let action = command;
        if (command === "grup" || command === "group") action = args[0];

        if (action === "close") {
            await sock.groupSettingUpdate(chatId, 'announcement');
            return sock.sendMessage(chatId, { text: "🔒 Grup Ditutup." });
        } else if (action === "open") {
            await sock.groupSettingUpdate(chatId, 'not_announcement');
            return sock.sendMessage(chatId, { text: "🔓 Grup Dibuka." });
        }
    }

    // --- SET JADWAL ---
    if ((command === "setopen" || command === "setclose") && isGroup) {
        if (!isAdmin) return sock.sendMessage(chatId, { text: "❌ Khusus Admin Grup!" }, { quoted: msg });

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
