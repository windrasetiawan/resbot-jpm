import { numberAllowed } from "../config.js";

async function autoreply(sock, chatId, text, key, msg) {
    // 1. Filter: Hanya di Private Chat (Bukan Grup)
    if (chatId.endsWith('@g.us')) return;

    // 2. Filter: Abaikan pesan dari bot sendiri
    if (key.fromMe) return;

    // 3. Daftar Kata Kunci (Keyword)
    const keywords = ["p", "bang", "min", "halo", "hallo", "admin", "assalamualaikum"];
    const incomingText = text.toLowerCase().trim();

    // 4. Cek Apakah Pesan Sesuai Keyword
    if (keywords.includes(incomingText)) {
        
        // Ambil nomor owner pertama dari config.js
        const ownerNo = numberAllowed[0]; 
        
        const replyMsg = `👋 Halo kak!\n\nMohon maaf ini Bot Otomatis.\nJika ada keperluan penting, silakan hubungi Owner saya langsung:\n\n👤 *Owner*\n➡️ wa.me/${ownerNo}\n\n_Terima kasih!_`;

        try {
            await sock.sendMessage(chatId, { text: replyMsg }, { quoted: msg });
        } catch (e) {
            console.error("Gagal autoreply:", e);
        }
    }
}

export default autoreply;
