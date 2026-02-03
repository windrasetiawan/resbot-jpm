import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const promoStore = {}; // Database sementara untuk hitung jumlah promosi harian
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

    // --- 3. LOGIKA MULTI OUT GRUP (FIX) ---
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

        await sock.sendMessage(chatId, { text: `⏳ Memproses keluar dari ${indexes.length} grup...` });

        // Eksekusi Keluar
        let successCount = 0;
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
                successCount++;
                await new Promise(r => setTimeout(r, 1500)); // Jeda 1.5 detik
            } catch (e) {
                console.log(`Gagal keluar ${targetGroup.subject}`);
            }
        }

        delete outSession[sender];
        return sock.sendMessage(chatId, { text: `✅ Selesai! Berhasil keluar dari ${successCount} grup.` });
    }

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
        return sock.sendMessage(chatId, { text: `✅ Jadwal diatur: ${time} WIB` });
    }

    if (cmd === ".cektime" && isAuthorized) {
        const s = db.schedule?.[chatId];
        return sock.sendMessage(chatId, { text: `📅 *Jadwal Grup Ini:*\n\n🔓 Buka: ${s?.open||"-"}\n🔒 Tutup: ${s?.close||"-"}` });
    }

    // 6. SETTINGS (.antilink)
    if (cmd === ".antilink" && isAuthorized) {
        if (args[0] === "on") {
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

    // 7. MONITOR ANTILINK (Counter 2x Warning, 3x Delete)
    if (isGroup && db.antilink.includes(chatId) && !isCreator && !isAdmin) {
         const containsLink = text.includes("chat.whatsapp.com") || text.includes("wa.me") || text.includes("http");
         
         if (containsLink) {
             const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
             const userKey = `${chatId}-${sender}`; // Kunci unik per user per grup

             // Reset jika hari berganti (backup jika cronjob telat)
             if (!promoStore[userKey] || promoStore[userKey].date !== today) {
                 promoStore[userKey] = { count: 0, date: today };
             }

             // Tambah hitungan
             promoStore[userKey].count++;

             // Jika sudah lebih dari 2x (artinya ini ke-3 atau lebih)
             if (promoStore[userKey].count > 2) {
                 // Hapus Pesan
                 await sock.sendMessage(chatId, { delete: key });
                 
                 // Kirim Pesan Peringatan (Tag User)
                 await sock.sendMessage(chatId, { 
                     text: `⚠️ @${sender.split('@')[0]} PROMOSI MAX 2X AJA BOS, KALAU MAU PROMOSI LAGI BESOK LAGI YAH....`,
                     mentions: [sender]
                 });
             }
         }
    }
}

// --- CRON JOB (Jadwal & Reset Antilink) ---
export async function runGroupSchedule(sock) {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });

    // Reset Counter Antilink Jam 00:00
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
