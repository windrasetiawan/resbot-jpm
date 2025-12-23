import { downloadAndSaveMedia, readWhitelist, spintax } from "../lib/utils.js";
import fs from "fs";
import clc from "cli-color";

async function jpm(sock, sender, message, key, msg) {
    if (!message.toLowerCase().startsWith(".jpm")) return;
    const parts = message.trim().split(" ");
    let text = parts.slice(1).join(" ");
    if (!text && msg.message?.imageMessage?.caption) text = msg.message.imageMessage.caption.replace(/^\.jpm\s*/i, "");
    if (!text) return sock.sendMessage(sender, { text: "⚠️ Masukkan pesan! Gunakan {hai|halo}." });

    let imgPath = null;
    if (msg.message?.imageMessage) imgPath = await downloadAndSaveMedia(sock, msg, "jpm_manual.jpg");

    const groups = await sock.groupFetchAllParticipating();
    const whitelist = readWhitelist();
    const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

    await sock.sendMessage(sender, { text: `🚀 JPM ke ${targets.length} grup...` });

    for (const g of targets) {
        try {
            const finalMsg = spintax(text);
            await sock.sendMessage(g.id, imgPath ? { image: fs.readFileSync(imgPath), caption: finalMsg } : { text: finalMsg });
            console.log(clc.green(`[JPM] ${g.subject}`));
            const delay = 15000 + Math.floor(Math.random() * 10000);
            await new Promise(r => setTimeout(r, delay));
        } catch {}
    }
    await sock.sendMessage(sender, { text: `✅ JPM Selesai.` });
}
export default jpm;
