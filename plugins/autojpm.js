import { saveStatus, startJPMLoop } from "../lib/resumeAutoJPM.js";
import { downloadAndSaveMedia, isOwner } from "../lib/utils.js";
import fs from "fs";
import path from "path";

const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

function getCurrentStatus() {
    try {
        if (fs.existsSync(statusPath)) {
            const raw = fs.readFileSync(statusPath);
            const data = JSON.parse(raw);
            return data;
        }
    } catch (e) {}
    return null; 
}

async function autojpm(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".autojpm")) return;
    const sender = msg.key.participant || msg.key.remoteJid;

    if (!isOwner(sender)) return sock.sendMessage(chatId, { text: `⚠️ Fitur ini khusus Owner Bot!` }, { quoted: msg });

    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");
    
    if (cmd === "set") {
        const min = parseInt(val);
        if (isNaN(min) || min < 1) return sock.sendMessage(chatId, { text: `⚠️ Masukkan angka menit yang valid!\nContoh: .autojpm set 180` });
        
        const current = getCurrentStatus() || {};
        saveStatus(current.running || false, current.text || "", current.imageBase64 || null, current.lastIndex || 0, min, current.senderJid || sender, null);
        return sock.sendMessage(chatId, { text: `✅ Jeda Istirahat BERHASIL diubah menjadi: ${min} menit.` });
    }

    if (cmd === "on") {
        if (global.autojpmRunning) return sock.sendMessage(chatId, { text: `⚠️ Auto JPM sudah berjalan!` });

        let imageBase64 = null;
        let msgWithImage = msg.message?.imageMessage || msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;

        if (msgWithImage) {
            try {
                const msgToDownload = msg.message?.imageMessage ? msg : { message: msg.message.extendedTextMessage.contextInfo.quotedMessage };
                const pathImg = await downloadAndSaveMedia(sock, msgToDownload, "jpm_temp.jpg");
                const buffer = fs.readFileSync(pathImg);
                imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                fs.unlinkSync(pathImg); 
            } catch (e) {}
        }

        const current = getCurrentStatus() || {};
        let delayToUse = 60;
        if (current.delayMinutes && !isNaN(current.delayMinutes) && current.delayMinutes > 0) delayToUse = current.delayMinutes;

        let messageText = val;
        if (!messageText) messageText = current.text || `*READY STOCK* 🚀\n\nMenyediakan berbagai kebutuhan internet murah & ngebut.\n\n👇 *KLIK GAMBAR DI ATAS UNTUK ORDER* 👇`;

        global.autojpmRunning = true;
        saveStatus(true, messageText, imageBase64, 0, delayToUse, sender, 0); 
        startJPMLoop(sock);
        
        return sock.sendMessage(chatId, { text: `🚀 *AUTO JPM AKTIF*\n\n📝 Teks: Siap dikirim\n⏱️ Istirahat: ${delayToUse} menit.\n\n_(Timer Anti-Restart aktif)_` });
    }

    if (cmd === "off") {
        global.autojpmRunning = false;
        const current = getCurrentStatus() || {};
        saveStatus(false, current.text, current.imageBase64, 0, current.delayMinutes || 60, current.senderJid, 0);
        return sock.sendMessage(chatId, { text: `🛑 AUTO JPM MATI` });
    }
}
export default autojpm;
