import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const promoStore = {}; 
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
    
    // Otorisasi: Admin Grup ATAU Owner Bot
    const isAuthorized = isAdmin || isCreator; 

    let db = { antilink: [], schedule: {}, autojoin: false };
    if (fs.existsSync(settingsPath)) {
        try { db = JSON.parse(fs.readFileSync(settingsPath)); } catch {}
    }

    // --- 1. PROTEKSI FITUR ADMIN (Hanya di Grup) ---
    const adminCommands = [".antilink", ".setopen", ".setclose", ".cektime", ".deltime"];
    if (adminCommands.includes(cmd)) {
        if (!isGroup) return sock.sendMessage(chatId, { text: "⚠️ Hanya untuk grup!" });
        if (!isAuthorized) return sock.sendMessage(chatId, { text: "⚠️ Perintah ini hanya untuk Admin Grup!" }, { quoted: msg });
    }
    // --------------------------------

    // 2. COMMAND OWNER (Autojoin Setting)
    if (cmd === ".autojoin" && isCreator) {
        if (args[0] === "on") { db.autojoin = true; } else if (args[0] === "off") { db.autojoin = false; }
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `✅ Auto Join ${args[0]}` });
    }

    // --- 3. LOGIKA MULTI OUT GRUP (YANG TADI HILANG) ---
    if (outSession[sender] && isCreator) {
        // Cek Batal
        if (text.toLowerCase() === "batal" || text.toLowerCase() === "cancel") {
            delete outSession[sender];
            return sock.sendMessage(chatId, { text: "❌ Proses Multi-Out dibatalkan." });
        }

        const groups = outSession[sender];
        const input = text.trim();
        let indexes = [];

        // Logika Parse Input (All atau Nomor)
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

        // Filter index valid
        indexes = [...new Set(indexes)].filter(i => i >= 0 && i < groups.length);

        if (indexes.length === 0) {
            return sock.sendMessage(chatId, { text: "⚠️ Masukkan nomor yang valid! (Contoh: 1, 2, 5 atau all)" });
        }

        await sock.sendMessage(chatId, { text: `⏳ Keluar dari ${indexes.length} grup...` });

        // Eksekusi Keluar
        for (let i of indexes) {
            const targetGroup = groups[i];
            try {
                // Hapus Chat dulu
                await sock.chatModify({ 
                    delete: true, 
                    lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] 
                }, targetGroup.id).catch(() => {});
                
                // Leave
                await sock.groupLeave(targetGroup.id);
                await new Promise(r => setTimeout(r, 2000)); // Jeda 2 detik
            } catch (e) {
                console.log(`Gagal keluar ${targetGroup.subject}`);
            }
        }

        delete outSession[sender];
        return sock.sendMessage(chatId, { text: `✅ Selesai keluar dari ${indexes.length} grup.` });
    }
    // ---------------------------------------------------

    // 4. COMMAND OUT / LEAVE (Owner)
    if ((cmd === ".out" || cmd === ".leave") && isCreator) {
        if (isGroup) {
            // Out Single (Di dalam grup)
            try { await sock.chatModify({ delete: true, lastMessages: [{ key: msg.key, messageTimestamp: msg.messageTimestamp }] }, chatId); } catch {}
            await sock.groupLeave(chatId);
            return;
        } else {
            // Out Multi (Di Private Chat) -> Memicu Logic No. 3
            const groupListObj = await sock.groupFetchAllParticipating();
            const groups = Object.values(groupListObj);
            
            if (groups.length === 0) return sock.sendMessage(chatId, { text: "Bot tidak ada di grup manapun." });

            outSession[sender] = groups;
            
            let txt = "📊 *DAFTAR GRUP BOT*\n\n";
            groups.forEach((g, i) => {
                txt += `${i + 1}. ${g.subject}\n`;
            });
            txt += "\n👉 Ketik nomor (misal: `1,3` atau `all`) untuk keluar.";
            return sock.sendMessage(chatId, { text: txt });
        }
    }

    // 5. JADWAL GRUP (Admin)
    if ((cmd === ".setopen" || cmd === ".setclose") && isAuthorized) {
        const time = args[0]; 
        if (!/^\d{2}:\d{2}$/.test(time)) return sock.sendMessage(chatId, { text: "Format: 08:00" });
        
        if (!db.schedule) db.schedule = {};
        if (!db.schedule[chatId]) db.schedule[chatId] = { open: null, close: null };
        
        if (cmd === ".setopen") db.schedule[chatId].open = time;
        if (cmd === ".setclose") db.schedule[chatId].close = time;
        
        fs.writeFileSync(settingsPath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `Jadwal diatur: ${time}` });
    }

    if (cmd === ".cektime" && isAuthorized) {
        const s = db.schedule?.[chatId];
        return sock.sendMessage(chatId, { text: `Jadwal:\nOpen: ${s?.open||"-"}\nClose: ${s?.close||"-"}` });
    }

    // 6. SETTINGS (.antilink)
    if (cmd === ".antilink" && isAuthorized) {
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

    // 7. MONITOR ANTILINK (Umum)
    if (isGroup && db.antilink.includes(chatId) && !isCreator && !isAdmin) {
         const containsLink = text.includes("chat.whatsapp.com") || text.includes("wa.me") || text.includes("http");
         if (containsLink) {
             await sock.sendMessage(chatId, { delete: key });
             // Tambahkan notifikasi jika perlu
         }
    }
}

// --- CRON JOB (RESPON ASLI TETAP DIJAGA) ---
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
