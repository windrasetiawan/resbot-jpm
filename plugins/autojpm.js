import { saveStatus, startJPMLoop } from "../lib/resumeAutoJPM.js";
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";
import fs from "fs";
import path from "path";

const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

function getCurrentStatus() {
    try {
        if (fs.existsSync(statusPath)) return JSON.parse(fs.readFileSync(statusPath));
    } catch {}
    return { delayMinutes: 60 };
}

async function autojpm(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".autojpm")) return;
    const sender = msg.key.participant || msg.key.remoteJid;

    // --- PROTEKSI: HANYA OWNER ---
    if (!isOwner(sender)) return sock.sendMessage(chatId, { text: "⚠️ Fitur ini khusus Owner Bot!" }, { quoted: msg });

    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");
    
    // --- 1. SETTING JEDA (FIX MENIT) ---
    if (cmd === "set") {
        const min = parseInt(val);
        if (isNaN(min) || min < 1) return sock.sendMessage(chatId, { text: "⚠️ Masukkan angka menit! Contoh: .autojpm set 2000" });
        
        // Simpan langsung menitnya ke database
        const current = getCurrentStatus();
        saveStatus(
            current.running || false, 
            current.text || "", 
            current.imageBase64 || null, 
            current.lastIndex || 0,
            min // Simpan Menit Murni
        );
        return sock.sendMessage(chatId, { text: `✅ Jeda Istirahat diatur: ${min} menit.\n(Bot akan istirahat ${min} menit setiap selesai satu putaran).` });
    }

    // --- 2. AKTIFKAN (ON) ---
    if (cmd === "on") {
        if (global.autojpmRunning) return sock.sendMessage(chatId, { text: "⚠️ Auto JPM sudah berjalan!" });

        let imageBase64 = null;
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
            try {
                const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                const pathImg = await downloadAndSaveMedia(sock, { message: quotedMsg }, "jpm_temp.jpg");
                const buffer = fs.readFileSync(pathImg);
                imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                fs.unlinkSync(pathImg); 
            } catch (e) {}
        }

        const current = getCurrentStatus();
        const delayToUse = current.delayMinutes || 60; 

        global.autojpmRunning = true;
        saveStatus(true, val || "Halo", imageBase64, 0, delayToUse); 
        
        startJPMLoop(sock);
        
        return sock.sendMessage(chatId, { text: `🚀 AUTO JPM AKTIF\n⏱️ Istirahat: ${delayToUse} menit.` });
    }

    // --- 3. MATIKAN (OFF) ---
    if (cmd === "off") {
        global.autojpmRunning = false;
        const current = getCurrentStatus();
        saveStatus(false, null, null, 0, current.delayMinutes || 60);
        return sock.sendMessage(chatId, { text: "🛑 AUTO JPM MATI" });
    }
}
export default autojpm;
