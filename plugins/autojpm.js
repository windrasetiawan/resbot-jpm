import fs from "fs";
import clc from "cli-color";
import { isOwner, readWhitelist, spintax } from "../lib/utils.js";
import { saveStatus } from "../lib/resumeAutoJPM.js";

async function autojpm(sock, chatId, message, key, msg) {
    if (!message.toLowerCase().startsWith(".autojpm")) return;
    if (!isOwner(msg.key.participant || msg.key.remoteJid)) return;

    const args = message.trim().split(" ");
    const command = args[1]?.toLowerCase();
    const value = args.slice(2).join(" ");

    if (command === "set") {
        if (!value || isNaN(value)) return sock.sendMessage(chatId, { text: "⚠️ Masukkan menit! Contoh: .autojpm set 60" });
        global.autojpm.loopDelayHours = parseInt(value) / 60;
        return sock.sendMessage(chatId, { text: `✅ Jeda istirahat diubah: *${value} menit*.` });
    }

    if (command === "on") {
        if (!value) return sock.sendMessage(chatId, { text: "⚠️ Masukkan pesan! Contoh: .autojpm on {Halo|Hai} kak" });
        if (global.autojpmRunning) return sock.sendMessage(chatId, { text: "⚠️ Sudah berjalan!" });

        global.autojpmRunning = true;
        saveStatus(true, value, null);
        sock.sendMessage(chatId, { text: "🚀 *AUTO JPM START*" });
        runAutoJPM(sock, value);
        return;
    }

    if (command === "off") {
        global.autojpmRunning = false;
        saveStatus(false, null, null);
        return sock.sendMessage(chatId, { text: "🛑 *AUTO JPM STOP*" });
    }
}

async function runAutoJPM(sock, text) {
    while (global.autojpmRunning) {
        const groups = await sock.groupFetchAllParticipating();
        const whitelist = readWhitelist();
        const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

        for (const g of targets) {
            if (!global.autojpmRunning) break;
            try {
                const finalMsg = spintax(text);
                await sock.sendMessage(g.id, { text: finalMsg });
                console.log(clc.green(`[AUTO] Kirim ke ${g.subject}`));
                const delay = 20000 + Math.floor(Math.random() * 10000);
                await new Promise(r => setTimeout(r, delay));
            } catch {}
        }
        if (!global.autojpmRunning) break;
        const jam = global.autojpm?.loopDelayHours || 1; 
        console.log(clc.yellow(`💤 Istirahat ${jam * 60} menit...`));
        await new Promise(r => setTimeout(r, jam * 3600 * 1000));
    }
}
export default autojpm;
