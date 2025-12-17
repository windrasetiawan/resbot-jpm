import { downloadAndSaveMedia } from "../lib/utils.js";
import fs from "fs";

async function pushkontak(sock, sender, message, key, messageEvent) {
    const parts = message.trim().split(" ");
    const text = parts.slice(1).join(" ");
    
    if (!text) return sock.sendMessage(sender, { text: "⚠️ Masukkan pesan push kontak!" });

    // Ambil metadata grup
    const metadata = await sock.groupMetadata(key.remoteJid);
    const participants = metadata.participants.map(p => p.id);
    
    await sock.sendMessage(sender, { text: `🚀 Memulai Push Kontak ke ${participants.length} member...` });

    for (let jid of participants) {
        try {
            await sock.sendMessage(jid, { text: text });
            // Delay 3 detik agar tidak kena banned
            await new Promise(r => setTimeout(r, 3000));
        } catch {}
    }
    
    await sock.sendMessage(sender, { text: "✅ Push kontak selesai." });
}
export default pushkontak;
