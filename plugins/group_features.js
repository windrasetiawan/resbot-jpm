import fs from "fs";
import { isOwner } from "../lib/utils.js";

const schedulePath = './DATABASE/group_schedule.json';

// --- MEMORY RAM ANTILINK ---
global.antilinkData = global.antilinkData || {
    date: new Date().getDate(),
    users: {} 
};

// Pastikan file jadwal ada
if (!fs.existsSync(schedulePath)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE', { recursive: true });
    fs.writeFileSync(schedulePath, JSON.stringify({}));
}

// ==========================================
//  OPTIMASI ANTILINK (BACA DARI RAM)
// ==========================================
export async function checkAntilink(sock, chatId, message, msg, sender, isAdmin) {
    // 1. Cek RESET Harian
    const today = new Date().getDate();
    if (global.antilinkData.date !== today) {
        global.antilinkData.date = today;
        global.antilinkData.users = {}; 
    }

    // 2. AMBIL DARI RAM GLOBAL (Lebih Cepat)
    const db = global.db.settings; // <--- INI KUNCINYA AGAR TIDAK DELAY
    if (!db.antilink || !db.antilink.includes(chatId)) return false;

    // 3. Admin & Owner bebas
    if (isAdmin || isOwner(sender)) return false;

    // 4. Deteksi Link WA
    const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
    const isLink = linkRegex.test(message); 

    if (isLink) {
        let count = global.antilinkData.users[sender] || 0;
        count++;
        global.antilinkData.users[sender] = count;

        if (count >= 3) {
            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch {}
            await sock.sendMessage(chatId, { 
                text: `⚠️ *PROMOSI 2X AJA BRO*\n\n@${sender.split('@')[0]} Promosi jangan banyak banyak bang ulang besok lagi`,
                mentions: [sender]
            }, { quoted: msg });
            return true; 
        } else {
            console.log(`[ANTILINK] ${sender.split('@')[0]} Warning ke-${count} (Dibiarkan)`);
            return false; 
        }
    }
    return false;
}

// ==========================================
//  COMMAND HANDLER GRUP
// ==========================================
async function groupFeatures(sock, chatId, message, key, msg) {
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) return; 

    const parts = message.trim().split(" ");
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) command = command.substring(1);
    const args = parts.slice(1);
    const q = args.join(" ");

    const sender = msg.key.participant || msg.key.remoteJid;
    let isAdmin = false;
    let isBotAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        const p = meta.participants.find(x => x.id === sender);
        const bot = meta.participants.find(x => x.id === sock.user.id.split(':')[0] + '@s.whatsapp.net');
        isAdmin = (p?.admin === 'admin' || p?.admin === 'superadmin');
        isBotAdmin = (bot?.admin === 'admin' || bot?.admin === 'superadmin');
    } catch {}

    // --- ANTILINK SETTING (Tulis ke Global & File) ---
    if (command === "antilink") {
        if (!isAdmin) return sock.sendMessage(chatId, { text: "❌ Khusus Admin!" }, { quoted: msg });
        
        let db = global.db.settings; // Ambil dari RAM
        if (!db.antilink) db.antilink = [];

        if (args[0] === "on") {
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            global.saveSettings(); // Simpan
            return sock.sendMessage(chatId, { text: "✅ *Antilink AKTIF*" }, { quoted: msg });
        } else if (args[0] === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            global.saveSettings(); // Simpan
            return sock.sendMessage(chatId, { text: "⭕ Antilink MATI" }, { quoted: msg });
        } else {
            return sock.sendMessage(chatId, { text: "Gunakan: .antilink on/off" }, { quoted: msg });
        }
    }

    // --- GROUP OPEN/CLOSE ---
    if (command === "group" || command === "grup" || command === "open" || command === "close") {
        if (!isAdmin || !isBotAdmin) return; // Silent if fail

        let action = command;
        if (command === "grup" || command === "group") action = args[0];

        if (action === "close") {
            await sock.groupSettingUpdate(chatId, 'announcement');
            return sock.sendMessage(chatId, { text: "🔒 Grup Ditutup" });
        } else if (action === "open") {
            await sock.groupSettingUpdate(chatId, 'not_announcement');
            return sock.sendMessage(chatId, { text: "🔓 Grup Dibuka" });
        }
    }

    // --- FITUR LAIN ---
    if (command === "hidetag" && isAdmin) {
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, { text: q ? q : "📣", mentions: meta.participants.map(p => p.id) }, { quoted: msg });
    }
    if (command === "kick" && isAdmin && isBotAdmin) {
        const target = msg.message?.extendedTextMessage?.contextInfo?.participant || args[0]?.replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        if (target.includes('@s.whatsapp.net')) await sock.groupParticipantsUpdate(chatId, [target], "remove");
    }
    if (command === "add" && isAdmin) {
        if (args[0]) await sock.groupParticipantsUpdate(chatId, [args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net'], "add");
    }
}

export default groupFeatures;
