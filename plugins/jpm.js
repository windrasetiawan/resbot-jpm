import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import fs from "fs";

async function jpm(sock, sender, message, key, messageEvent) {
    const parts = message.trim().split(" ");
    const text = parts.slice(1).join(" ");
    
    if (!text) return sock.sendMessage(sender, { text: "⚠️ Masukkan pesan JPM!" });

    // Cek gambar
    let imgPath = null;
    const msg = messageEvent.messages[0];
    if (msg.message?.imageMessage) {
         if (await downloadAndSaveMedia(sock, msg, "jpm_manual.jpg")) imgPath = "./tmp/jpm_manual.jpg";
    }

    const groups = await sock.groupFetchAllParticipating();
    const whitelist = readWhitelist();
    const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

    await sock.sendMessage(sender, { text: `🚀 Mengirim ke ${targets.length} grup...` });

    for (const g of targets) {
        try {
            await sock.sendMessage(g.id, imgPath 
                ? { image: fs.readFileSync(imgPath), caption: text } 
                : { text });
            await new Promise(r => setTimeout(r, 3000)); // Delay aman
        } catch {}
    }

    await sock.sendMessage(sender, { text: "✅ JPM Manual Selesai." });
}
export default jpm;
