import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const promoStore = {}; // Counter Promosi V1
const outSession = {};

async function groupFeatures(sock, chatId, text, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const cmd = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1);
    const isCreator = isOwner(sender);

    // Cek Admin Grup
    let isAdmin = false;
    if (isGroup) {
        try {
            const meta = await sock.groupMetadata(chatId);
            const p = meta.participants.find(p => p.id === sender);
            isAdmin = p?.admin !== null && p?.admin !== undefined; 
        } catch {}
    }
    
    // Otorisasi
    const isAuthorized = isAdmin || isCreator; 

    // Load Database Settings
    let db = { antilink: [], antilinkv2: [], schedule: {}, autojoin: false };
    if (fs.existsSync(settingsPath)) {
        try { 
            const readDb = JSON.parse(fs.readFileSync(settingsPath));
            db = { ...db, ...readDb }; 
            if (!db.antilinkv2) db.antilinkv2 = [];
        } catch {}
    }

    // PROTEKSI FITUR ADMIN (Hanya di Grup)
    const adminCommands = [".antilink", ".antilinkv2", ".setopen", ".setclose", ".cektime", ".deltime"];
    if (adminCommands.includes(cmd)) {
        if (!isGroup) return sock.sendMessage(chatId, { text: "⚠️ Hanya untuk grup!" });
        if (!isAuthorized) return sock.sendMessage(chatId, { text: "⚠️ Perintah ini hanya untuk Admin Grup!" }, { quoted: msg });
    }

    // 2. LOGIKA MULTI OUT GRUP
    if (outSession[sender] && isCreator) {
        if (text.toLowerCase() === "batal" || text.toLowerCase() === "cancel") {
            delete outSession[sender];
            return sock.sendMessage(chatId, { text: "❌ Proses Multi-Out dibatalkan." });
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
        if (indexes.length === 0) return sock.sendMessage(chatId, { text: "⚠️ Pilihan tidak valid (Gunakan angka/all)." });

        await sock.sendMessage(chatId, { text: `⏳ Keluar dari ${indexes.length} grup...` });

        let successCount = 0;
        for (let i of indexes) {
            const targetGroup = groups[i];
            try {
                await sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, targetGroup.id).catch(() => {});
                await sock.groupLeave(targetGroup.id);
                successCount++;
                await new Promise(r => setTimeout(r, 1500)); 
            } catch (e) {}
        }

        delete outSession[sender];
        return sock.sendMessage(chatId, { text: `✅ Selesai keluar dari ${successCount} grup.` });
    }

    // 3. COMMAND OUT / LEAVE (Owner)
    if ((cmd === ".out" || cmd === ".leave") && isCreator) {
        if (isGroup) {
            try { await sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, chatId); } catch {}
            await sock.groupLeave(chatId);
            return;
        } else {
            const groupListObj = await sock.groupFetchAllParticipating();
            const groups = Object.values(groupListObj);
            if (groups.length === 0) return sock.sendMessage(chatId, { text: "Bot tidak ada di grup manapun." });
            outSession[sender] = groups;
            let txt = "📊 *DAFTAR GRUP BOT*\n\n";
            groups.forEach((g, i) => { txt += `${i + 1}. ${g.subject}\n`; });
            txt += "\n👉 Ketik nomor (misal: `1,3` atau `all`) untuk keluar.";
            return sock.sendMessage(chatId, { text: txt });
        }
    }

    // 4. JADWAL GRUP
    if ((cmd === ".setopen" || cmd === ".setclose") && isAuthorized) {
        const time = args[0]; 
        if (!/^\d{2}:\d{2}$/.test(time)) return sock.sendMessage(chatId, { text: "Format: 08:00" });
        if (!db.schedule) db.schedule = {};
        if (!db.schedule[chatId]) db.schedule[chatId] = { open: null, close: null };
        if (cmd === ".setopen") db.schedule[chatId].open = time;
        if (cmd === ".setclose") db.schedule[chatId].close = time;
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `✅ Jadwal diatur: ${time} WIB` });
    }
    if (cmd === ".cektime" && isAuthorized) {
        const s = db.schedule?.[chatId];
        return sock.sendMessage(chatId, { text: `📅 *Jadwal Grup Ini:*\n\n🔓 Buka: ${s?.open||"-"}\n🔒 Tutup: ${s?.close||"-"}` });
    }

    // --- 5. SETTINGS ANTILINK V1 (Limit 2x) ---
    if (cmd === ".antilink" && isAuthorized) {
        if (args[0] === "on") {
            // Matikan V2 jika aktif
            if (db.antilinkv2.includes(chatId)) db.antilinkv2 = db.antilinkv2.filter(id => id !== chatId);
            
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { 
                text: "✅ *ANTILINK DIAKTIFKAN*\n\nSetiap member hanya boleh mengirim link promosi maksimal 2x sehari.\nPelanggaran ke-3 akan dihapus otomatis." 
            });
        }
        if (args[0] === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { 
                text: "✅ *ANTILINK DINONAKTIFKAN*\n\nSekarang member bebas mengirim link (tetap jaga etika spam ya)." 
            });
        }
    }

    // --- 6. SETTINGS ANTILINK V2 (HAPUS SEMUA - HARD) ---
    if (cmd === ".antilinkv2" && isAuthorized) {
        if (args[0] === "on") {
            // Matikan V1 jika aktif
            if (db.antilink.includes(chatId)) db.antilink = db.antilink.filter(id => id !== chatId);

            if (!db.antilinkv2.includes(chatId)) db.antilinkv2.push(chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK V2 (HARD) AKTIF*\n(Semua pesan link dihapus + Reply Warning)." });
        }
        if (args[0] === "off") {
            db.antilinkv2 = db.antilinkv2.filter(id => id !== chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ Antilink V2 OFF" });
        }
    }

    // --- 7. MONITOR ANTILINK (V1 & V2) ---
    if (isGroup && !isCreator && !isAdmin) {
         const containsLink = text.includes("chat.whatsapp.com") || text.includes("wa.me") || text.includes("http");
         
         if (containsLink) {
             // A. CEK ANTILINK V2 (HARD DELETE + REPLY)
             if (db.antilinkv2 && db.antilinkv2.includes(chatId)) {
                 await sock.sendMessage(chatId, { delete: key });
                 
                 // REPLY WARNING (PESAN TEGAS)
                 return sock.sendMessage(chatId, { 
                     text: "JANGAN PROMOSI DISINI, INI GRUP DISKUSI!!!",
                     mentions: [sender]
                 });
             }

             // B. CEK ANTILINK V1 (QUOTA LIMIT)
             if (db.antilink.includes(chatId)) {
                 const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
                 const userKey = `${chatId}-${sender}`;

                 if (!promoStore[userKey] || promoStore[userKey].date !== today) {
                     promoStore[userKey] = { count: 0, date: today };
                 }

                 promoStore[userKey].count++;

                 if (promoStore[userKey].count > 2) {
                     await sock.sendMessage(chatId, { delete: key });
                     // Pesan Asli Anda untuk V1
                     await sock.sendMessage(chatId, { 
                         text: `⚠️ @${sender.split('@')[0]} PROMOSI MAX 2X AJA BOS, KALAU MAU PROMOSI LAGI BESOK LAGI YAH....`,
                         mentions: [sender]
                     });
                 }
             }
         }
    }
}

// --- CRON JOB ---
export async function runGroupSchedule(sock) {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });

    if (now === "00:00") {
        for (const key in promoStore) delete promoStore[key];
        console.log("[SYSTEM] Promo Counter Reset.");
    }

    if (!fs.existsSync(settingsPath)) return;
    let db = JSON.parse(fs.readFileSync(settingsPath));
    if (!db.schedule) return;

    for (const [id, t] of Object.entries(db.schedule)) {
        try {
            if (t.open === now) {
                await sock.groupSettingUpdate(id, 'not_announcement');
                await sock.sendMessage(id, { text: "🔓 *Grub sudah di buka kembali (🌅 Selamat Pagi)*\n> BY WINTUNELING VPN" });
            }
            if (t.close === now) {
                await sock.groupSettingUpdate(id, 'announcement');
                await sock.sendMessage(id, { text: "🔒 *Grup ditutup sementara (🌃 Selamat Tidur)*\n> BY WINTUNELING VPN" });
            }
        } catch {}
    }
}

export default groupFeatures;
