import { downloadAndSaveMedia, readWhitelist } from "../lib/utils.js";
import fs from "fs";

async function jpmtag(sock, sender, message, key, messageEvent) {
    const parts = message.trim().split(" ");
    const text = parts.slice(1).join(" ");

    let imgPath = null;
    const msg = messageEvent.messages[0];
    if (msg.message?.imageMessage) {
         if (await downloadAndSaveMedia(sock, msg, "jpm_tag.jpg")) imgPath = "./tmp/jpm_tag.jpg";
    }

    const groups = await sock.groupFetchAllParticipating();
    const whitelist = readWhitelist();
    const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

    await sock.sendMessage(sender, { text: `🚀 Mengirim JPM Tag ke ${targets.length} grup...` });

    for (const g of targets) {
        try {
            // Ambil semua member untuk di-tag
            const metadata = await sock.groupMetadata(g.id);
            const mentions = metadata.participants.map(p => p.id);

            await sock.sendMessage(g.id, imgPath 
                ? { image: fs.readFileSync(imgPath), caption: text, mentions } 
                : { text, mentions });
            
            await new Promise(r => setTimeout(r, 5000)); 
        } catch {}
    }
    await sock.sendMessage(sender, { text: "✅ JPM Tag Selesai." });
}
export default jpmtag;
