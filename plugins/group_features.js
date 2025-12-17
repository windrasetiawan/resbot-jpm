import fs from "fs";
import { isOwner } from "../lib/utils.js";
import { saveOwner } from "../config.js";

const settingsPath = './DATABASE/settings.json';
const schedulePath = './DATABASE/group_schedule.json';

// --- DATABASE MEMORY (RAM) ---
// global.antilinkData menyimpan warning user hari ini
global.antilinkData = global.antilinkData || {
    date: new Date().getDate(), // Tanggal hari ini
    users: {}                   // { '628xxx': jumlah_warning }
};

// Helper Load Database
const getSettings = () => {
    if (!fs.existsSync(settingsPath)) return { mode: 'self', antilink: [], autojoin: false };
    return JSON.parse(fs.readFileSync(settingsPath));
};
const saveSettings = (data) => fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2));

if (!fs.existsSync(schedulePath)) fs.writeFileSync(schedulePath, JSON.stringify({}));


// ==========================================
//  FUNGSI PENDETEKSI ANTILINK (Logika Baru)
// ==========================================
export async function checkAntilink(sock, chatId, message, msg, sender, isAdmin) {
    // 1. Cek RESET Harian (Jam 00:00)
    const today = new Date().getDate();
    if (global.antilinkData.date !== today) {
        console.log(`[ANTILINK] Reset data harian (${global.antilinkData.date} -> ${today})`);
        global.antilinkData.date = today;
        global.antilinkData.users = {}; // Reset semua ke 0
    }

    // 2. Cek apakah fitur Antilink aktif di grup ini
    let db = getSettings();
    if (!db.antilink.includes(chatId)) return false;

    // 3. Admin & Owner bebas kirim link
    if (isAdmin || isOwner(sender)) return false;

    // 4. Cek Link Grup WhatsApp
    // .test() memastikan 1 pesan dihitung 1 kali saja (meski isi 10 link)
    const linkRegex = /chat.whatsapp.com\/([0-9A-Za-z]{20,24})/i;
    const isLink = linkRegex.test(message); 

    // 5. EKSEKUSI JIKA ADA LINK
    if (isLink) {
        // Ambil jumlah warning saat ini (default 0)
        let count = global.antilinkData.users[sender] || 0;
        
        // Tambah Warning
        count++;
        global.antilinkData.users[sender] = count;

        // --- LOGIKA HUKUMAN BERTAHAP ---
        if (count >= 3) {
            // == PELANGGARAN KE-3 (ACTION: DELETE + WARNING) ==
            
            // 1. Hapus Pesan
            try { await sock.sendMessage(chatId, { delete: msg.key }); } catch {}

            // 2. Kirim Peringatan
            // Kita cek agar bot tidak spam warning
            await sock.sendMessage(chatId, { 
                text: `⚠️ *BATAS PROMOSI HABIS (3/3)*\n\n@${sender.split('@')[0]} Maaf, jatah kirim link promosi hari ini sudah habis. Pesan otomatis dihapus.`,
                mentions: [sender]
            }, { quoted: msg });

            return true; // Stop proses (pesan dihapus)

        } else {
            // == PELANGGARAN KE-1 & KE-2 (ALLOW / BIARKAN) ==
            // Pesan TETAP MUNCUL (Tidak dihapus)
            // Hanya dicatat di console log untuk monitoring
            console.log(`[ANTILINK] ${sender.split('@')[0]} Promosi ke-${count} (Dibiarkan)`);
            
            return false; // Lanjut proses (pesan tidak dihapus)
        }
    }
    return false;
}


// ==========================================
//  COMMAND HANDLER (Menu Setting)
// ==========================================
async function groupFeatures(sock, chatId, message, key, msg) {
    const isGroup = chatId.endsWith('@g.us');
    const sender = msg.key?.participant || msg.key?.remoteJid;
    
    if (!message) return;
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1);
    const q = parts.slice(1).join(" ");

    // --- AUTOJOIN ---
    if (command === "autojoin") {
        if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });

        let db = getSettings();
        if (!q) {
            let status = db.autojoin ? "✅ AKTIF" : "⭕ MATI";
            return sock.sendMessage(chatId, { text: `🤖 *AUTO JOIN GLOBAL*\nStatus: ${status}\n\nCara: .autojoin on/off` }, { quoted: msg });
        }
        if (q === "on") { db.autojoin = true; saveSettings(db); return sock.sendMessage(chatId, { text: "✅ Auto Join ON" }, { quoted: msg }); }
        else if (q === "off") { db.autojoin = false; saveSettings(db); return sock.sendMessage(chatId, { text: "⭕ Auto Join OFF" }, { quoted: msg }); }
    }

    // --- ANTILINK SETTING ---
    if (command === "antilink") {
        if (!isGroup) return sock.sendMessage(chatId, { text: "❌ Hanya untuk grup!" }, { quoted: msg });
        
        let db = getSettings();
        if (q === "on") {
            if (db.antilink.includes(chatId)) return sock.sendMessage(chatId, { text: "⚠️ Sudah ON." }, { quoted: msg });
            db.antilink.push(chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { 
                text: "✅ *Antilink ON*\n\nAturan:\n- Link ke-1 & 2: Dibiarkan (Aman)\n- Link ke-3: Auto Hapus + Warning" 
            }, { quoted: msg });
        } else if (q === "off") {
            db.antilink = db.antilink.filter(id => id !== chatId);
            saveSettings(db);
            return sock.sendMessage(chatId, { text: "⭕ Antilink OFF" }, { quoted: msg });
        } else {
             return sock.sendMessage(chatId, { text: "Gunakan: .antilink on/off" }, { quoted: msg });
        }
    }

    // --- ADD OWNER ---
    if (command === "addowner") {
         if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "❌ Khusus Owner!" }, { quoted: msg });
         if (saveOwner(q)) return sock.sendMessage(chatId, { text: `✅ Owner ditambahkan: ${q}` }, { quoted: msg });
         else return sock.sendMessage(chatId, { text: "❌ Gagal." }, { quoted: msg });
    }

    // --- GROUP OPEN/CLOSE ---
    if ((command === "open" || command === "close") && isGroup) {
        try {
            await sock.groupSettingUpdate(chatId, command === "close" ? "announcement" : "not_announcement");
            return sock.sendMessage(chatId, { text: `✅ Grup di-${command}.` });
        } catch {
            return sock.sendMessage(chatId, { text: "❌ Bot bukan admin!" });
        }
    }

    if ((command === "setopen" || command === "setclose") && isGroup) {
        if (!q.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
            return sock.sendMessage(chatId, { text: "⚠️ Format salah. Contoh: .setclose 22:00" });
        }
        const db = JSON.parse(fs.readFileSync(schedulePath));
        if (!db[chatId]) db[chatId] = {};
        const type = command === "setopen" ? "open" : "close";
        db[chatId][type] = q;
        fs.writeFileSync(schedulePath, JSON.stringify(db, null, 2));
        return sock.sendMessage(chatId, { text: `✅ Jadwal ${type} diatur: ${q}` });
    }
}

export default groupFeatures;
