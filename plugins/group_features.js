import fs from "fs";
import { saveOwner } from "../config.js";

// Database jadwal grup
const schedulePath = './DATABASE/group_schedule.json';
if (!fs.existsSync(schedulePath)) fs.writeFileSync(schedulePath, JSON.stringify({}));

async function groupFeatures(sock, sender, message, key, isGroup) {
    const parts = message.trim().split(" ");
    const command = parts[0]?.toLowerCase().substring(1); // remove prefix
    const q = parts.slice(1).join(" ");

    // --- ADD OWNER ---
    if (command === "addowner") {
        if (!q) return sock.sendMessage(sender, { text: "⚠️ Format: .addowner 628xxx" });
        if (saveOwner(q)) return sock.sendMessage(sender, { text: `✅ ${q} sekarang adalah owner.` });
        else return sock.sendMessage(sender, { text: "⚠️ Nomor sudah ada atau format salah." });
    }

    // --- OPEN / CLOSE MANUAL ---
    if ((command === "open" || command === "close") && isGroup) {
        try {
            await sock.groupSettingUpdate(key.remoteJid, command === "close" ? "announcement" : "not_announcement");
            return sock.sendMessage(sender, { text: `✅ Grup berhasil di-${command}.` });
        } catch {
            return sock.sendMessage(sender, { text: "❌ Bot bukan admin!" });
        }
    }

    // --- SET OPEN / CLOSE JAM BERAPA ---
    // Contoh: .setopen 08:00 atau .setclose 22:00
    if ((command === "setopen" || command === "setclose") && isGroup) {
        if (!q.match(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
            return sock.sendMessage(sender, { text: "⚠️ Format jam salah. Contoh: .setclose 22:00" });
        }

        const db = JSON.parse(fs.readFileSync(schedulePath));
        if (!db[key.remoteJid]) db[key.remoteJid] = {};
        
        // Simpan jadwal
        const type = command === "setopen" ? "open" : "close";
        db[key.remoteJid][type] = q;
        
        fs.writeFileSync(schedulePath, JSON.stringify(db, null, 2));
        return sock.sendMessage(sender, { text: `✅ Jadwal ${type} grup diatur ke jam ${q}` });
    }
}

export default groupFeatures;
