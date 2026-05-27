import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const promoStore = {}; 
const outSession = {};

async function groupFeatures(sock, chatId, text, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    
    const rawText = text.trim();
    const isCommand = rawText.startsWith(".");
    
    let cmd = "";
    let action = null;
    let args = [];
    
    if (isCommand) {
        const cmdArgs = rawText.split(/\s+/); 
        cmd = cmdArgs[0].toLowerCase();
        action = cmdArgs[1] ? cmdArgs[1].toLowerCase() : null; 
        args = cmdArgs.slice(1);
    }
    
    const isCreator = isOwner(sender);

    let isAdmin = false;
    if (isGroup) {
        try {
            const meta = await sock.groupMetadata(chatId);
            const p = meta.participants.find(p => p.id === sender);
            isAdmin = p?.admin === 'admin' || p?.admin === 'superadmin'; 
        } catch (err) {}
    }
    
    const isAuthorized = isAdmin || isCreator; 

    let db = { antilink: [], antilinkv2: [], schedule: {}, autojoin: false };
    if (!fs.existsSync(path.dirname(settingsPath))) {
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    }
    if (fs.existsSync(settingsPath)) {
        try { 
            const readDb = JSON.parse(fs.readFileSync(settingsPath));
            db = { ...db, ...readDb }; 
            if (!db.antilinkv2) db.antilinkv2 = [];
            if (!db.schedule) db.schedule = {};
        } catch (e) {}
    }

    const adminCommands = [".antilink", ".antilinkv2", ".setopen", ".setclose", ".cektime", ".deltime"];
    
    if (isCommand && adminCommands.includes(cmd)) {
        if (!isGroup) return sock.sendMessage(chatId, { text: "⚠️ Perintah ini khusus digunakan di dalam Grup!" }, { quoted: msg });
        if (!isAuthorized) return sock.sendMessage(chatId, { text: "⚠️ Maaf, perintah ini hanya untuk Admin Grup dan Owner Bot!" }, { quoted: msg });
    }

    if ((cmd === ".setopen" || cmd === ".setclose") && isAuthorized) {
        const time = action;
        if (!time || !/^\d{2}:\d{2}$/.test(time)) {
            return sock.sendMessage(chatId, { text: "⚠️ Format waktu salah!\n\nContoh penggunaan:\n👉 *.setopen 08:00*\n👉 *.setclose 22:00*" }, { quoted: msg });
        }
        
        if (!db.schedule[chatId]) db.schedule[chatId] = { open: null, close: null };
        
        if (cmd === ".setopen") db.schedule[chatId].open = time;
        if (cmd === ".setclose") db.schedule[chatId].close = time;
        
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        const status = cmd === ".setopen" ? "Buka" : "Tutup";
        return sock.sendMessage(chatId, { text: `✅ Jadwal berhasil diatur!\nGrup akan *${status} otomatis* pada jam ${time} WIB.` }, { quoted: msg });
    }

    if (cmd === ".cektime" && isAuthorized) {
        const s = db.schedule[chatId];
        return sock.sendMessage(chatId, { 
            text: `📅 *JADWAL OTOMATIS GRUP INI:*\n\n🔓 Buka: ${s?.open || "Belum diatur"}\n🔒 Tutup: ${s?.close || "Belum diatur"}` 
        }, { quoted: msg });
    }

    if (cmd === ".deltime" && isAuthorized) {
        if (db.schedule[chatId]) {
            delete db.schedule[chatId];
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        }
        return sock.sendMessage(chatId, { text: "🗑️ Jadwal buka/tutup otomatis grup ini berhasil dihapus!" }, { quoted: msg });
    }

    if (cmd === ".antilink" && isAuthorized) {
        if (!action) {
            const status = db.antilink.includes(chatId) ? "AKTIF" : "MATI";
            return sock.sendMessage(chatId, { text: `🛡️ Status Antilink V1 saat ini: *${status}*\n\nKetik:\n👉 *.antilink on*\n👉 *.antilink off*` }, { quoted: msg });
        }
        
        if (action === "on") {
            if (db.antilinkv2.includes(chatId)) db.antilinkv2 = db.antilinkv2.filter(id => id !== chatId); 
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK V1 DIAKTIFKAN*\n\nSetiap member hanya boleh promosi maksimal 2x sehari.\nPelanggaran ke-3 dihapus otomatis." }, { quoted: msg });
        } else if (action === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK V1 DINONAKTIFKAN*" }, { quoted: msg });
        } else {
            return sock.sendMessage(chatId, { text: `⚠️ Format argumen salah!\nGunakan 'on' atau 'off'` }, { quoted: msg });
        }
    }

    if (cmd === ".antilinkv2" && isAuthorized) {
        if (!action) {
            const status = db.antilinkv2.includes(chatId) ? "AKTIF" : "MATI";
            return sock.sendMessage(chatId, { text: `🔥 Status Antilink V2 saat ini: *${status}*\n\nKetik:\n👉 *.antilinkv2 on*\n👉 *.antilinkv2 off*` }, { quoted: msg });
        }

        if (action === "on") {
            if (db.antilink.includes(chatId)) db.antilink = db.antilink.filter(id => id !== chatId); 
            if (!db.antilinkv2.includes(chatId)) db.antilinkv2.push(chatId);
            
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK V2 (HARD) AKTIF*\n(Semua pesan link langsung dihapus tanpa toleransi)." }, { quoted: msg });
        } else if (action === "off") {
            db.antilinkv2 = db.antilinkv2.filter(id => id !== chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK V2 DINONAKTIFKAN*" }, { quoted: msg });
        } else {
            return sock.sendMessage(chatId, { text: `⚠️ Format argumen salah!\nGunakan 'on' atau 'off'` }, { quoted: msg });
        }
    }

    if (isGroup && !isCreator && !isAdmin && !msg.key.fromMe) {
         const containsLink = rawText.includes("chat.whatsapp.com") || rawText.includes("wa.me") || rawText.includes("http");
         
         if (containsLink) {
             if (db.antilinkv2 && db.antilinkv2.includes(chatId)) {
                 await sock.sendMessage(chatId, { delete: key });
                 return sock.sendMessage(chatId, { text: `⚠️ @${sender.split('@')[0]} JANGAN PROMOSI DISINI, INI GRUP DISKUSI!!!`, mentions: [sender] });
             }

             if (db.antilink.includes(chatId)) {
                 const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
                 const userKey = `${chatId}-${sender}`;

                 if (!promoStore[userKey] || promoStore[userKey].date !== today) {
                     promoStore[userKey] = { count: 0, date: today };
                 }

                 promoStore[userKey].count++;

                 if (promoStore[userKey].count > 2) {
                     await sock.sendMessage(chatId, { delete: key });
                     await sock.sendMessage(chatId, { text: `⚠️ @${sender.split('@')[0]} PROMOSI MAX 2X SEHARI AJA BOS! Pelanggaran telah dihapus otomatis.`, mentions: [sender] });
                 }
             }
         }
    }

    if ((cmd === ".out" || cmd === ".leave") && isCreator) {
        if (isGroup) {
            try { await sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, chatId); } catch {}
            await sock.groupLeave(chatId);
            return;
        } else {
            const groupListObj = await sock.groupFetchAllParticipating();
            const groups = Object.values(groupListObj);
            
            if (groups.length === 0) return sock.sendMessage(chatId, { text: "Bot tidak ada di grup manapun." });

            if (args.length > 0) {
                const input = args.join("");
                let indexes = [];
                if (input.toLowerCase() === "all") indexes = groups.map((_, i) => i);
                else {
                    const parts = input.split(',');
                    for (let part of parts) {
                        if (part.includes('-')) {
                            const [start, end] = part.split('-').map(Number);
                            if (!isNaN(start) && !isNaN(end)) for (let i = start; i <= end; i++) indexes.push(i - 1);
                        } else {
                            const idx = parseInt(part) - 1;
                            if (!isNaN(idx)) indexes.push(idx);
                        }
                    }
                }

                indexes = [...new Set(indexes)].filter(i => i >= 0 && i < groups.length);
                if (indexes.length === 0) return sock.sendMessage(chatId, { text: "⚠️ Nomor tidak valid." });

                await sock.sendMessage(chatId, { text: `⏳ Langsung keluar dari ${indexes.length} grup...` });
                
                let successCount = 0;
                for (let i of indexes) {
                    const targetGroup = groups[i];
                    try {
                        await sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, targetGroup.id).catch(() => {});
                        await sock.groupLeave(targetGroup.id);
                        successCount++;
                        await new Promise(r => setTimeout(r, 1000)); 
                    } catch (e) {}
                }
                return sock.sendMessage(chatId, { text: `✅ Selesai keluar dari ${successCount} grup.` });
            } else {
                outSession[sender] = groups;
                let txt = "📊 *DAFTAR GRUP BOT*\n\n";
                groups.forEach((g, i) => { txt += `${i + 1}. ${g.subject}\n`; });
                txt += "\n👉 Ketik nomor (misal: `1,3` atau `all`) untuk keluar.";
                return sock.sendMessage(chatId, { text: txt });
            }
        }
    }

    if (outSession[sender] && isCreator && !isCommand) {
        const input = rawText;
        const isNumberFormat = /^[0-9,\-\s]+$/.test(input);
        const isCmd = input.toLowerCase() === 'all' || input.toLowerCase() === 'batal' || input.toLowerCase() === 'cancel';
        
        if (!isNumberFormat && !isCmd) return; 

        if (input.toLowerCase() === "batal" || input.toLowerCase() === "cancel") {
            delete outSession[sender];
            return sock.sendMessage(chatId, { text: "❌ Proses Multi-Out dibatalkan." });
        }

        const groups = outSession[sender];
        let indexes = [];

        if (input.toLowerCase() === "all") indexes = groups.map((_, i) => i);
        else {
            const parts = input.split(',');
            for (let part of parts) {
                if (part.includes('-')) {
                    const [start, end] = part.split('-').map(Number);
                    if (!isNaN(start) && !isNaN(end)) for (let i = start; i <= end; i++) indexes.push(i - 1);
                } else {
                    const idx = parseInt(part) - 1;
                    if (!isNaN(idx)) indexes.push(idx);
                }
            }
        }

        indexes = [...new Set(indexes)].filter(i => i >= 0 && i < groups.length);
        if (indexes.length === 0) return sock.sendMessage(chatId, { text: "⚠️ Nomor tidak ditemukan dalam daftar." });

        await sock.sendMessage(chatId, { text: `⏳ Keluar dari ${indexes.length} grup...` });

        let successCount = 0;
        for (let i of indexes) {
            const targetGroup = groups[i];
            try {
                await sock.groupLeave(targetGroup.id);
                successCount++;
                await new Promise(r => setTimeout(r, 1500)); 
            } catch (e) {}
        }

        delete outSession[sender];
        return sock.sendMessage(chatId, { text: `✅ Selesai keluar dari ${successCount} grup.` });
    }
}

export async function runGroupSchedule(sock) {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    
    if (now === "00:00") for (const key in promoStore) delete promoStore[key];
    
    if (!fs.existsSync(settingsPath)) return;
    let db = JSON.parse(fs.readFileSync(settingsPath));
    if (!db.schedule) return;

    for (const [id, t] of Object.entries(db.schedule)) {
        try {
            if (t.open === now) {
                await sock.groupSettingUpdate(id, 'not_announcement');
                await sock.sendMessage(id, { text: "🔓 *Grup telah dibuka otomatis*\n> BY WINTUNELING VPN" });
            }
            if (t.close === now) {
                await sock.groupSettingUpdate(id, 'announcement');
                await sock.sendMessage(id, { text: "🔒 *Grup telah ditutup otomatis*\n> BY WINTUNELING VPN" });
            }
        } catch {}
    }
}

export default groupFeatures;
