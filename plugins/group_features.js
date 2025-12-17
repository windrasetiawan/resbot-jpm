import fs from "fs";
import { isOwner } from "../lib/utils.js";
import { saveOwner } from "../config.js";

const settingsPath = './DATABASE/settings.json';
const schedulePath = './DATABASE/group_schedule.json';

// Load Helper
const getSettings = () => {
    if (!fs.existsSync(settingsPath)) return { mode: 'self', antilink: [], autojoin: false };
    return JSON.parse(fs.readFileSync(settingsPath));
};
const saveSettings = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

async function groupFeatures(sock, chatId, message, key, msg) {
    const isGroup = chatId.endsWith('@g.us');
    const sender = msg.key.participant || msg.key.remoteJid;
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1);
    const q = parts.slice(1).join(" ");

    // --- AUTOJOIN COMMAND ---
    if (command === "autojoin") {
        if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Perintah ini khusus Owner Bot!" }, { quoted: msg });

        let db = getSettings();

        // Jika user hanya ketik .autojoin tanpa on/off
        if (!q) {
            let status = db.autojoin ? "✅ AKTIF" : "⭕ MATI";
            let text = `🤖 *FITUR AUTO JOIN*\n\n`;
            text += `Status saat ini: ${status}\n\n`;
            text += `ℹ️ *Deskripsi:*\nFitur ini memungkinkan Bot masuk otomatis ke grup jika Owner mengirimkan link grup WhatsApp ke chat pribadi bot.\n\n`;
            text += `⚙️ *Cara Pakai:*\n- *.autojoin on* : Mengaktifkan\n- *.autojoin off* : Mematikan`;
            return sock.sendMessage(chatId, { text: text }, { quoted: msg });
        }
        
        if (q === "on") {
            db.autojoin = true;
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "✅ *Auto Join Global: ON*\nSilakan kirim link grup ke bot untuk test." }, { quoted: msg });
        } else if (q === "off") {
            db.autojoin = false;
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ *Auto Join Global: OFF*" }, { quoted: msg });
        }
    }

    // --- ANTILINK COMMAND ---
    if (command === "antilink") {
        if (!isGroup) return sock.sendMessage(chatId, { text: "❌ Hanya untuk grup!" }, { quoted: msg });
        
        let db = getSettings();
        if (q === "on") {
            if (db.antilink.includes(chatId)) return sock.sendMessage(chatId, { text: "⚠️ Antilink sudah aktif." }, { quoted: msg });
            db.antilink.push(chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "✅ *Antilink Diaktifkan!*" }, { quoted: msg });
        } else if (q === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ *Antilink Dimatikan.*" }, { quoted: msg });
        } else {
             return sock.sendMessage(chatId, { text: "Gunakan: .antilink on / off" }, { quoted: msg });
        }
    }
    
    // --- ADD OWNER ---
    if (command === "addowner") {
         if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });
         if (saveOwner(q)) return sock.sendMessage(chatId, { text: `✅ Nomor ${q} ditambahkan jadi Owner.` }, { quoted: msg });
         else return sock.sendMessage(chatId, { text: "❌ Gagal/Sudah ada." }, { quoted: msg });
    }
}

export default groupFeatures;
