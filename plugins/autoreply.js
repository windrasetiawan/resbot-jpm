import { numberAllowed } from "../config.js";
import { isOwner } from "../lib/utils.js";
import fs from "fs";
import path from "path";

const statusPath = path.join(process.cwd(), "DATABASE", "autoreply_status.json");

// Fungsi untuk mengecek status autoreply (Default: Nyala)
function getAutoreplyStatus() {
    try {
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath);
            return JSON.parse(raw).enabled;
        }
    } catch (e) {}
    return true; 
}

// Fungsi untuk menyimpan status autoreply
function setAutoreplyStatus(status) {
    try {
        if (!fs.existsSync(path.join(process.cwd(), "DATABASE"))) {
            fs.mkdirSync(path.join(process.cwd(), "DATABASE"));
        }
        fs.writeFileSync(statusPath, JSON.stringify({ enabled: status }));
    } catch (e) {}
}

async function autoreply(sock, chatId, text, key, msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    
    // Command untuk On/Off Autoreply oleh Owner
    if (text.toLowerCase().startsWith(".autoreply ")) {
        if (!isOwner(sender)) return sock.sendMessage(chatId, { text: `⚠️ Fitur ini khusus Owner Bot!` }, { quoted: msg });
        
        const cmd = text.split(" ")[1]?.toLowerCase();
        
        if (cmd === "on") {
            setAutoreplyStatus(true);
            return sock.sendMessage(chatId, { text: "✅ Autoreply berhasil diaktifkan." });
        } else if (cmd === "off") {
            setAutoreplyStatus(false);
            return sock.sendMessage(chatId, { text: "🛑 Autoreply berhasil dimatikan." });
        }
    }

    // Jika autoreply sedang dalam status off, abaikan pesan selanjutnya
    if (!getAutoreplyStatus()) return;

    // 1. Filter: Hanya di Private Chat (Bukan Grup)
    if (chatId.endsWith('@g.us')) return;

    // 2. Filter: Abaikan pesan dari bot sendiri
    if (key.fromMe) return;

    // 3. Daftar Kata Kunci (Keyword)
    const keywords = ["p", "bang", "min", "beli", "mas", "udp", "config", "halo", "hallo", "admin", "assalamualaikum"];
    const incomingText = text.toLowerCase().trim();

    // 4. Cek Apakah Pesan Sesuai Keyword
    if (keywords.includes(incomingText)) {
        
        // Ambil nomor owner pertama dari config.js
        const ownerNo = numberAllowed[0]; 
        
        const replyMsg = `👋 Halo kak!\n\nMohon maaf nomor ini hanya untuk promosi.\nJika ada keperluan penting, silakan hubungi Owner saya langsung:\n\n👤 *Owner*\n➡️ wa.me/${ownerNo}\n\n_Terima kasih!_`;

        try {
            await sock.sendMessage(chatId, { text: replyMsg }, { quoted: msg });
        } catch (e) {
            console.error("Gagal autoreply:", e);
        }
    }
}

export default autoreply;
