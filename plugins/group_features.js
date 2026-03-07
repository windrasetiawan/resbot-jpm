import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const promoStore = {}; 
const outSession = {};

async function groupFeatures(sock, chatId, text, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    
    // Pecah pesan untuk mengambil command dan argumen
    const cmd = text.split(" ")[0].toLowerCase();
    const args = text.split(" ").slice(1);
    
    // FIX: Mengubah argumen (on/off) menjadi huruf kecil agar tidak sensitif
    const action = args[0]?.toLowerCase(); 
    
    const isCreator = isOwner(sender);

    let isAdmin = false;
    if (isGroup) {
        try {
            const meta = await sock.groupMetadata(chatId);
            const p = meta.participants.find(p => p.id === sender);
            isAdmin = p?.admin !== null && p?.admin !== undefined; 
        } catch {}
    }
    
    const isAuthorized = isAdmin || isCreator; 

    // Muat Database Settings
    let db = { antilink: [], antilinkv2: [], schedule: {}, autojoin: false };
    if (fs.existsSync(settingsPath)) {
        try { 
            const readDb = JSON.parse(fs.readFileSync(settingsPath));
            db = { ...db, ...readDb }; 
            if (!db.antilinkv2) db.antilinkv2 = [];
        } catch {}
    }

    // 1. Otorisasi Perintah Admin
    const adminCommands = [".antilink", ".antilinkv2", ".setopen", ".setclose", ".cektime", ".deltime"];
    if (adminCommands.includes(cmd)) {
        if (!isGroup) return sock.sendMessage(chatId, { text: "⚠️ Perintah ini hanya bisa digunakan di dalam grup!" });
        if (!isAuthorized) return sock.sendMessage(chatId, { text: "⚠️ Perintah ini khusus untuk Admin Grup!" }, { quoted: msg });
    }

    // 2. Perintah Keluar Grup (.out) Khusus Owner
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

    if (outSession[sender] && isCreator && !text.startsWith(".")) {
        const input = text.trim();
        const isNumberFormat = /^[0-9,\-\s]+$/.test(input);
        const isCommand = input.toLowerCase() === 'all' || input.toLowerCase() === 'batal' || input.toLowerCase() === 'cancel';
        
        if (!isNumberFormat && !isCommand) return; 

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

    // --- 3. SETTINGS ANTILINK V1 (Limit 2x Promosi) ---
    if (cmd === ".antilink" && isAuthorized) {
        if (action === "on") {
            if (db.antilinkv2.includes(chatId)) db.antilinkv2 = db.antilinkv2.filter(id => id !== chatId); // Matikan v2
            if (!db.antilink.includes(chatId)) db.antilink.push(chatId);
            
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK DIAKTIFKAN*\n\nSetiap member hanya boleh mengirim link promosi maksimal 2x sehari.\nPelanggaran ke-3 akan dihapus otomatis." });
        } else if (action === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK DINONAKTIFKAN*\n\nSekarang member bebas mengirim link." });
        } else {
            // FIX: Beri respon jika formatnya salah (Bukan "on" / "off")
            return sock.sendMessage(chatId, { text: "⚠️ Format salah!\nKetik:\n👉 *.antilink on* (Untuk Menyalakan)\n👉 *.antilink off* (Untuk Mematikan)" });
        }
    }

    // --- 4. SETTINGS ANTILINK V2 (Hapus Semua Link Langsung) ---
    if (cmd === ".antilinkv2" && isAuthorized) {
        if (action === "on") {
            if (db.antilink.includes(chatId)) db.antilink = db.antilink.filter(id => id !== chatId); // Matikan v1
            if (!db.antilinkv2.includes(chatId)) db.antilinkv2.push(chatId);
            
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK V2 (HARD) AKTIF*\n(Semua pesan yang berisi link akan langsung dihapus)." });
        } else if (action === "off") {
            db.antilinkv2 = db.antilinkv2.filter(id => id !== chatId);
            fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
            return sock.sendMessage(chatId, { text: "✅ *ANTILINK V2 (HARD) DINONAKTIFKAN*" });
        } else {
            return sock.sendMessage(chatId, { text: "⚠️ Format salah!\nKetik:\n👉 *.antilinkv2 on* (Untuk Menyalakan)\n👉 *.antilinkv2 off* (Untuk Mematikan)" });
        }
    }

    // --- 5. DETEKSI & EKSEKUSI PELANGGARAN ANTILINK ---
    // Pastikan admin grup dan BOT (fromMe) aman dari penghapusan
    if (isGroup && !isCreator && !isAdmin && !msg.key.fromMe) {
         const containsLink = text.includes("chat.whatsapp.com") || text.includes("wa.me") || text.includes("http");
         
         if (containsLink) {
             // Eksekusi Antilink V2 (Hard Delete)
             if (db.antilinkv2 && db.antilinkv2.includes(chatId)) {
                 await sock.sendMessage(chatId, { delete: key });
                 return sock.sendMessage(chatId, { text: `⚠️ @${sender.split('@')[0]} JANGAN PROMOSI DISINI, INI GRUP DISKUSI!!!`, mentions: [sender] });
             }

             // Eksekusi Antilink V1 (Batas Limit 2x)
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
}

// Fitur Jadwal Grup
export async function runGroupSchedule(sock) {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });
    
    // Reset Promo Antilink V1 setiap jam 00:00
    if (now === "00:00") for (const key in promoStore) delete promoStore[key];
    
    if (!fs.existsSync(settingsPath)) return;
    let db = JSON.parse(fs.readFileSync(settingsPath));
    if (!db.schedule) return;

    for (const [id, t] of Object.entries(db.schedule)) {
        try {
            if (t.open === now) {
                await sock.groupSettingUpdate(id, 'not_announcement');
                await sock.sendMessage(id, { text: "🔓 *Grup di buka*\n> BY WINTUNELING VPN" });
            }
            if (t.close === now) {
                await sock.groupSettingUpdate(id, 'announcement');
                await sock.sendMessage(id, { text: "🔒 *Grup ditutup*\n> BY WINTUNELING VPN" });
            }
        } catch {}
    }
}

export default groupFeatures;
