import { saveStatus, startJPMLoop } from "../lib/resumeAutoJPM.js";
import { downloadAndSaveMedia } from "../lib/utils.js";
import fs from "fs";

async function autojpm(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".autojpm")) return;
    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");
    
    global.autojpm = global.autojpm || {};

    // --- 1. SETTING JEDA ---
    if (cmd === "set") {
        const min = parseInt(val);
        if (isNaN(min)) return sock.sendMessage(chatId, { text: "⚠️ Masukkan angka menit!" });
        global.autojpm.loopDelayHours = min / 60;
        return sock.sendMessage(chatId, { text: `✅ Jeda diatur: ${min} menit.` });
    }

    // --- 2. AKTIFKAN (ON) ---
    if (cmd === "on") {
        if (global.autojpmRunning) return sock.sendMessage(chatId, { text: "⚠️ Auto JPM sudah berjalan!" });

        // Cek apakah user mengirim gambar
        let imageBase64 = null;
        if (msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) {
            try {
                const quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
                const pathImg = await downloadAndSaveMedia(sock, { message: quotedMsg }, "jpm_temp.jpg");
                const buffer = fs.readFileSync(pathImg);
                imageBase64 = `data:image/jpeg;base64,${buffer.toString('base64')}`;
                fs.unlinkSync(pathImg); 
            } catch (e) {
                console.error("Gagal load gambar JPM:", e);
            }
        }

        // Simpan Status & Nyalakan Flag
        global.autojpmRunning = true;
        saveStatus(true, val || "Halo", imageBase64); 
        
        // JALANKAN MESIN (Panggil dari library agar konsisten)
        startJPMLoop(sock);
        
        return sock.sendMessage(chatId, { text: "🚀 AUTO JPM AKTIF\nBot akan mengirim pesan ke seluruh grup, lalu istirahat, dan lanjut lagi otomatis." });
    }

    // --- 3. MATIKAN (OFF) ---
    if (cmd === "off") {
        global.autojpmRunning = false;
        saveStatus(false, null, null);
        return sock.sendMessage(chatId, { text: "🛑 AUTO JPM MATI" });
    }
}
export default autojpm;
