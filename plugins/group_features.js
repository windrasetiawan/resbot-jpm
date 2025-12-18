import fs from "fs";
import { isOwner } from "../lib/utils.js";

const schedulePath = './DATABASE/group_schedule.json';

// RAM Khusus Antilink (Harian)
global.antilinkData = global.antilinkData || {
    date: new Date().getDate(),
    users: {} 
};

if (!fs.existsSync(schedulePath)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE', { recursive: true });
    fs.writeFileSync(schedulePath, JSON.stringify({}));
}

// FUNGSI CEK ANTILINK
export async function checkAntilink(sock, chatId, message, msg, sender, isAdmin) {
    const today = new Date().getDate();
    if (global.antilinkData.date !== today) {
        global.antilinkData.date = today;
        global.antilinkData.users = {}; 
    }

    const db = global.db.settings;
    if (!db.antilink || !db.antilink.includes(chatId)) return false;
    if (isAdmin || isOwner(sender)) return false;

    const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
    if (linkRegex.test(message)) {
        let count = global.antilinkData.users[sender] || 0;
        count++;
        global.antilinkData.users[sender] = count;

        if (count >= 3) {
            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch {}
            await sock.sendMessage(chatId, { 
                text: `⚠️ *BATAS PROMOSI HABIS*\n@${sender.split('@')[0]} Jangan spam link!`,
                mentions: [sender]
            }, { quoted: msg });
            return true; 
        }
    }
    return false;
}

// COMMAND HANDLER GRUP
async function groupFeatures(sock, chatId, message, key, msg) {
    if (!chatId.endsWith('@g.us')) return; 

    const parts = message.trim().split(" ");
    let command = parts[0]?.toLowerCase();
    if (command.startsWith(".") || command.startsWith("#")) command = command.substring(1);
    const args = parts.slice(1);
    const q = args.join(" ");
    const sender = msg.key.participant || msg.key.remoteJid;

    let isAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        const p = meta.participants.find(x => x.id === sender);
        isAdmin = (p?.admin === 'admin' || p?.admin === 'superadmin');
    } catch {}

    // Antilink
    if (command === "antilink") {
        if (!isAdmin) return sock.sendMessage(chatId, { text: "❌ Admin Only" }, { quoted: msg });
        let db = global.db.settings;
        if (!db.antilink) db.antilink = [];

        if (args[0] === "on") {
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            global.saveSettings();
            return sock.sendMessage(chatId, { text: "✅ Antilink ON" }, { quoted: msg });
        } else if (args[0] === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            global.saveSettings();
            return sock.sendMessage(chatId, { text: "⭕ Antilink OFF" }, { quoted: msg });
        }
    }

    // Open/Close
    if (command === "open" && isAdmin) {
        await sock.groupSettingUpdate(chatId, 'not_announcement');
        return sock.sendMessage(chatId, { text: "🔓 Grup Dibuka" });
    }
    if (command === "close" && isAdmin) {
        await sock.groupSettingUpdate(chatId, 'announcement');
        return sock.sendMessage(chatId, { text: "🔒 Grup Ditutup" });
    }

    // Hidetag
    if (command === "hidetag" && isAdmin) {
        const meta = await sock.groupMetadata(chatId);
        await sock.sendMessage(chatId, { text: q ? q : "📣", mentions: meta.participants.map(p => p.id) }, { quoted: msg });
    }
}

export default groupFeatures;
