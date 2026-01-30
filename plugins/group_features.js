import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const promoStore = {}; 
const outSession = {};

// --- FUNGSI BARU: LEAVE & DELETE CHAT ---
async function leaveAndClear(sock, jid) {
    try {
        // 1. Keluar
        await sock.groupLeave(jid);
        // 2. Hapus Chat dari history bot
        await new Promise(r => setTimeout(r, 2000));
        const timestamp = Math.floor(Date.now() / 1000);
        await sock.chatModify({
            delete: true,
            lastMessages: [{ key: { remoteJid: jid, fromMe: true, id: "DELETE-REQ" }, messageTimestamp: timestamp }]
        }, jid);
    } catch (e) {
        console.error(`Gagal leave/delete ${jid}:`, e.message);
    }
}

async function groupFeatures(sock, chatId, text, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const cmd = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1);
    const isCreator = isOwner(sender);

    let db = { antilink: [], schedule: {}, autojoin: false };
    if (fs.existsSync(settingsPath)) {
        try { db = JSON.parse(fs.readFileSync(settingsPath)); } catch {}
    }

    // 1. LOGIKA MULTI OUT GRUP
    if (outSession[sender] && isCreator) {
        if (text.toLowerCase() === "batal" || text.toLowerCase() === "cancel") {
            delete outSession[sender];
            return sock.sendMessage(chatId, { text: "❌ Proses dibatalkan." });
        }

        const groups = outSession[sender];
        const input = text.trim();
        let indexes = [];

        if (input.toLowerCase() === "all") {
            indexes = groups.map((_, i) => i);
        } else {
            const parts = input.split(',');
            for (let part of parts) {
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(Number);
                    if (!isNaN(start) && !isNaN(end)) {
                        for (let i = start; i <= end; i++) indexes.push(i - 1);
                    }
                } else {
                    const idx = parseInt(part) - 1;
                    if (!isNaN(idx)) indexes.push(idx);
                }
            }
        }

        indexes = [...new Set(indexes)].filter(i => i >= 0 && i < groups.length);
        if (indexes.length === 0) return sock.sendMessage(chatId, { text: "⚠️ Pilihan tidak valid." });

        await sock.sendMessage(chatId, { text: `⏳ Memproses keluar & hapus chat ${indexes.length} grup...` });

        let successCount = 0;
        for (let i of indexes) {
            await leaveAndClear(sock, groups[i].id); // Action Leave & Delete
            successCount++;
        }
        
        delete outSession[sender];
        return sock.sendMessage(chatId, { text: `✅ Selesai. Keluar & Hapus Data: ${successCount} grup.` });
    }

    // 2. COMMAND OUT / LEAVE
    if ((cmd === ".out" || cmd === ".leave") && isCreator) {
        if (isGroup) {
            await leaveAndClear(sock, chatId);
        } else {
            const groups = Object.values(await sock.groupFetchAllParticipating());
            if (groups.length === 0) return sock.sendMessage(chatId, { text: "Bot tidak ada di grup manapun." });

            outSession[sender] = groups;
            let txt = "📊 *DAFTAR GRUP BOT:*\n\n" + groups.map((g, i) => `${i+1}. ${g.subject}`).join("\n");
            txt += "\n\n👉 Ketik nomor (1,3,5), rentang (1-5), atau 'all' untuk keluar dan hapus chat.";
            sock.sendMessage(chatId, { text: txt });
        }
        return;
    }

    // 3. JADWAL GRUP
    if ((cmd === ".setopen" || cmd === ".setclose") && isCreator && isGroup) {
        const time = args[0]; 
        if (!/^\d{2}:\d{2}$/.test(time)) return sock.sendMessage(chatId, { text: "Format: 08:00" });
        
        if (!db.schedule) db.schedule = {};
        if (!db.schedule[chatId]) db.schedule[chatId] = { open: null, close: null };
        
        if (cmd === ".setopen") db.schedule[chatId].open = time;
        if (cmd === ".setclose") db.schedule[chatId].close = time;
        
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `Jadwal diatur: ${time}` });
    }

    if (cmd === ".cektime" && isGroup) {
        const s = db.schedule?.[chatId];
        return sock.sendMessage(chatId, { text: `Jadwal:\nOpen: ${s?.open||"-"}\nClose: ${s?.close||"-"}` });
    }

    // 4. SETTINGS ANTILINK
    if (cmd === ".antilink" && isCreator && isGroup) {
        if (args[0] === "on") {
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "Antilink ON (Limit 2x/hari)" });
        }
        if (args[0] === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "Antilink OFF" });
        }
    }

    // 5. MONITOR ANTILINK (LOGIKA DIPERBAIKI)
    if (isGroup && db.antilink.includes(chatId) && !isCreator) {
        // Cek Link DULU (Supaya ringan)
        const containsLink = text.includes("chat.whatsapp.com") || text.includes("wa.me") || text.includes("http");
        
        if (containsLink) {
            // Baru Cek Admin
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                isAdmin = meta.participants.find(p => p.id === sender)?.admin !== null;
            } catch (e) { isAdmin = false; }

            if (!isAdmin) {
                const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
                const userKey = `${chatId}-${sender}`;

                if (!promoStore[userKey] || promoStore[userKey].date !== today) {
                    promoStore[userKey] = { count: 0, date: today };
                }
                promoStore[userKey].count++;

                if (promoStore[userKey].count > 2) {
                    await sock.sendMessage(chatId, { delete: key });
                    // TEKS ASLI ANDA (TIDAK SAYA UBAH)
                    return sock.sendMessage(chatId, { 
                        text: `⚠️ @${sender.split('@')[0]} PROMOSI MAX 2X AJA BOS, KALAU MAU PROMOSI LAGI BESOK LAGI YAH....`,
                        mentions: [sender]
                    });
                }
            }
        }
    }
}

export async function runGroupSchedule(sock) {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    if (now === "00:00") {
        for (const key in promoStore) delete promoStore[key];
    }
    if (!fs.existsSync(settingsPath)) return;
    let db = JSON.parse(fs.readFileSync(settingsPath));
    if (!db.schedule) return;

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
