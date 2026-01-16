import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const promoStore = {}; // Memori harian

async function groupFeatures(sock, chatId, text, key, msg) {
    const isGroup = chatId.endsWith('@g.us');
    if (!isGroup) return;

    const sender = msg.key.participant || msg.key.remoteJid;
    const args = text.trim().split(/ +/);
    const command = args[0].toLowerCase();
    const isCreator = isOwner(sender);

    // --- COMMAND SETTINGS ---
    if (!fs.existsSync(settingsPath)) return;
    let db = JSON.parse(fs.readFileSync(settingsPath));

    // A. JADWAL GRUP (.setopen / .setclose)
    if ((command === ".setopen" || command === ".setclose") && isCreator) {
        const time = args[1]; // 08:00
        if (!/^\d{2}:\d{2}$/.test(time)) return sock.sendMessage(chatId, { text: "⚠️ Format: .setopen 08:00" });
        
        if (!db.schedule) db.schedule = {};
        if (!db.schedule[chatId]) db.schedule[chatId] = { open: null, close: null };
        
        if (command === ".setopen") db.schedule[chatId].open = time;
        if (command === ".setclose") db.schedule[chatId].close = time;
        
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `✅ Jadwal diatur: ${time}` });
    }

    if (command === ".cektime") {
        const s = db.schedule?.[chatId];
        return sock.sendMessage(chatId, { text: `📅 Jadwal:\nOpen: ${s?.open||"-"}\nClose: ${s?.close||"-"}` });
    }

    // B. ANTILINK & AUTOJOIN TOGGLE
    if (command === ".antilink" && isCreator) {
        if (args[1] === "on") {
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "🛡️ Antilink ON (Limit 2x/hari)" });
        }
        if (args[1] === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "⚠️ Antilink OFF" });
        }
    }

    if (command === ".autojoin" && isCreator) {
        db.autojoin = (args[1] === "on");
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `🚀 Auto Join: ${db.autojoin ? "ON" : "OFF"}` });
    }

    // --- LOGIKA UTAMA: ANTILINK LIMIT 2X ---
    if (db.antilink.includes(chatId) && !isCreator) {
        // Cek Admin
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(chatId);
            isAdmin = meta.participants.find(p => p.id === sender)?.admin !== null;
        } catch {}

        if (!isAdmin) {
            // Cek Link (1 pesan = 1 hit)
            const containsLink = text.includes("chat.whatsapp.com") || text.includes("wa.me") || text.includes("http");
            
            if (containsLink) {
                const today = new Date().toLocaleDateString();
                const userKey = `${chatId}-${sender}`;

                if (!promoStore[userKey] || promoStore[userKey].date !== today) {
                    promoStore[userKey] = { count: 0, date: today };
                }

                promoStore[userKey].count++;

                // HUKUMAN JIKA LEBIH DARI 2
                if (promoStore[userKey].count > 2) {
                    await sock.sendMessage(chatId, { delete: key });
                    return sock.sendMessage(chatId, { 
                        text: `⚠️ @${sender.split('@')[0]} PROMOSI MAX 2X AJA BOS, KALAU MAU PROMOSI LAGI BESOK LAGI YAH....`,
                        mentions: [sender]
                    });
                }
            }
        }
    }
}

// CRON JOB (Dijalankan index.js)
export async function runGroupSchedule(sock) {
    if (!fs.existsSync(settingsPath)) return;
    let db = JSON.parse(fs.readFileSync(settingsPath));
    if (!db.schedule) return;

    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });

    for (const [id, t] of Object.entries(db.schedule)) {
        try {
            if (t.open === now) {
                await sock.groupSettingUpdate(id, 'not_announcement');
                await sock.sendMessage(id, { text: "🔓 *Grub sudah di buka kembali (Selamat Pagi)*\n> BY WINTUNELING VPN" });
            }
            if (t.close === now) {
                await sock.groupSettingUpdate(id, 'announcement');
                await sock.sendMessage(id, { text: "🔒 *Grup ditutup (Selamat Tidur)*\n> BY WINTUNELING VPN" });
            }
        } catch {}
    }
}
export default groupFeatures;
