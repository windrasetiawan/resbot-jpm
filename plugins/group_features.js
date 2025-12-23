import fs from "fs";
import { isOwner } from "../lib/utils.js";

const promoStore = {}; // Memori harian

async function groupFeatures(sock, chatId, text, key, msg) {
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    const command = text.split(" ")[0].toLowerCase();
    const args = text.split(" ")[1];
    const isCreator = isOwner(sender);

    // Get Admin Status
    let isAdmin = false;
    try {
        const meta = await sock.groupMetadata(chatId);
        isAdmin = meta.participants.find(p => p.id === sender)?.admin !== null;
    } catch {}

    // --- COMMANDS ---
    const db = JSON.parse(fs.readFileSync("./DATABASE/settings.json"));
    
    if (command === ".antilink" && isCreator) {
        if (args === "on") {
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            fs.writeFileSync("./DATABASE/settings.json", JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "🛡️ Antilink ON (Max 2x/hari)" });
        }
        if (args === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            fs.writeFileSync("./DATABASE/settings.json", JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "⚠️ Antilink OFF" });
        }
    }

    if (command === ".autojoin" && isCreator) {
        db.autojoin = (args === "on");
        fs.writeFileSync("./DATABASE/settings.json", JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `🚀 Auto Join: ${db.autojoin ? "ON" : "OFF"}` });
    }

    // --- LOGIKA LIMIT PROMOSI 2X ---
    if (db.antilink.includes(chatId) && !isAdmin && !isCreator) {
        if (text.includes("chat.whatsapp.com") || text.includes("http")) {
            const today = new Date().toLocaleDateString();
            const userKey = `${chatId}-${sender}`;
            
            if (!promoStore[userKey] || promoStore[userKey].date !== today) {
                promoStore[userKey] = { count: 0, date: today };
            }

            promoStore[userKey].count++;

            if (promoStore[userKey].count > 2) {
                await sock.sendMessage(chatId, { delete: msg.key });
                return sock.sendMessage(chatId, { 
                    text: `⚠️ @${sender.split('@')[0]} PROMOSI MAX 2X AJA BOS, KALAU MAU PROMOSI LAGI BESOK LAGI YAH....`,
                    mentions: [sender]
                });
            }
        }
    }
}
export default groupFeatures;
