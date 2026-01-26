import fs from "fs";
import path from "path";
import { isOwner } from "../lib/utils.js";

const settingsPath = path.join(process.cwd(), "DATABASE", "settings.json");
const promoStore = {}; // Memori harian
const outSession = {};

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

    // 1. LOGIKA MULTI OUT GRUP (INTERAKTIF)
    if (outSession[sender] && isCreator) {
        if (text.toLowerCase() === "batal" || text.toLowerCase() === "cancel") {
            delete outSession[sender];
            return sock.sendMessage(chatId, { text: "❌ Proses Multi-Out dibatalkan." });
        }

        const groups = outSession[sender];
        const input = text.trim();
        let indexes = [];

        // Parsing Input (Bisa "1,3,5" atau "1-3" atau "all")
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

        // Filter valid index
        indexes = [...new Set(indexes)].filter(i => i >= 0 && i < groups.length);

        if (indexes.length === 0) {
            return sock.sendMessage(chatId, { text: "⚠️ Pilihan tidak valid. Masukkan nomor yang benar (misal: 1,2,3) atau ketik 'batal'." });
        }

        await sock.sendMessage(chatId, { text: `⏳ Memproses keluar dari ${indexes.length} grup... Mohon tunggu.` });

        let successCount = 0;
        let failCount = 0;

        for (let i of indexes) {
            const targetGroup = groups[i];
            try {
                // SILENT LEAVE: Langsung leave tanpa kirim pesan ke grup target
                await sock.groupLeave(targetGroup.id);
                successCount++;
                // Delay sedikit agar aman
                await new Promise(r => setTimeout(r, 1000));
            } catch (e) {
                console.error(`Gagal keluar ${targetGroup.subject}:`, e);
                failCount++;
            }
        }

        delete outSession[sender];
        return sock.sendMessage(chatId, { 
            text: `✅ *PROSES SELESAI*\n\n📤 Berhasil Keluar: ${successCount} Grup\n❌ Gagal: ${failCount} Grup` 
        });
    }

    // 2. COMMAND OUT / LEAVE
    if ((cmd === ".out" || cmd === ".leave") && isCreator) {
        if (isGroup) {
            // Jika di dalam grup -> Langsung keluar (Silent)
            await sock.groupLeave(chatId);
            return;
        } else {
            // Jika di Private Chat -> Tampilkan Menu Multi Out
            const groupListObj = await sock.groupFetchAllParticipating();
            const groups = Object.values(groupListObj);
            
            if (groups.length === 0) return sock.sendMessage(chatId, { text: "Bot belum gabung grup manapun." });

            outSession[sender] = groups;
            let msgText = "📊 *DAFTAR GRUP BOT:*\n\n";
            groups.forEach((g, i) => {
                msgText += `${i + 1}. ${g.subject}\n`;
            });
            msgText += "\n👉 *Cara Pakai:*\n- Ketik nomor (misal: `1`)\n- Ketik banyak (misal: `1,3,5`)\n- Ketik rentang (misal: `1-5`)\n- Ketik `all` untuk keluar semua.\n- Ketik `batal` untuk cancel.";
            return sock.sendMessage(chatId, { text: msgText });
        }
    }

    // 3. JADWAL GRUP (.setopen / .setclose)
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

    // 4. SETTINGS (.antilink) - Autojoin DIHAPUS
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

    // 5. MONITOR ANTILINK (LIMIT 2X - RESET WIB)
    if (isGroup && db.antilink.includes(chatId) && !isCreator) {
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(chatId);
            isAdmin = meta.participants.find(p => p.id === sender)?.admin !== null;
        } catch {}

        if (!isAdmin) {
            const containsLink = text.includes("chat.whatsapp.com") || text.includes("wa.me") || text.includes("http");
            
            if (containsLink) {
                // Ambil Tanggal Hari Ini (WIB)
                const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
                const userKey = `${chatId}-${sender}`;

                // Reset jika tanggal berbeda (Ganti Hari)
                if (!promoStore[userKey] || promoStore[userKey].date !== today) {
                    promoStore[userKey] = { count: 0, date: today };
                }

                promoStore[userKey].count++;

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

// CRON JOB (Jalan Tiap Menit)
export async function runGroupSchedule(sock) {
    // Ambil Jam Sekarang (WIB)
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' });

    // RESET ANTILINK JAM 00:00 WIB
    if (now === "00:00") {
        for (const key in promoStore) {
            delete promoStore[key];
        }
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
            
