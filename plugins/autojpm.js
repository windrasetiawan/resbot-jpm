import { spintax, readWhitelist, downloadAndSaveMedia } from "../lib/utils.js";
import { saveStatus } from "../lib/resumeAutoJPM.js";
import fs from "fs";

// ===========================================================
// KONFIGURASI LINK & GAMBAR
// ===========================================================
const CONFIG = {
    // 1. Link Grup Default (Dipakai jika bot tidak menemukan link di teks)
    //    Ganti dengan Link Grup WhatsApp Anda!
    LINK_GRUP_MANUAL: "https://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb", 
    
    // 2. Gambar Default (Dipakai jika Anda lupa me-reply gambar)
    URL_GAMBAR: "https://i.postimg.cc/Xq1L1tCM/file-000000008a28622fab894f9b3c177a14.png",

    // 3. Judul pada Tombol (SUDAH DIUBAH)
    JUDUL_TOMBOL: "Bergabung ke grup",
    
    // 4. Deskripsi kecil di bawah judul
    DESKRIPSI_TOMBOL: "Klik Disini Untuk Join"
};

async function autojpm(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".autojpm")) return;
    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");
    
    global.autojpm = global.autojpm || {};

    // --- 1. SETTING JEDA (MENIT) ---
    if (cmd === "set") {
        const min = parseInt(val);
        if (isNaN(min)) return sock.sendMessage(chatId, { text: "⚠️ Masukkan angka menit!" });
        global.autojpm.loopDelayHours = min / 60; 
        return sock.sendMessage(chatId, { text: `✅ Jeda Auto JPM diatur: ${min} menit.` });
    }

    // --- 2. AKTIFKAN (ON) ---
    if (cmd === "on" && val) {
        if (global.autojpmRunning) return sock.sendMessage(chatId, { text: "⚠️ Auto JPM sudah berjalan!" });
        
        global.autojpmRunning = true;
        
        // A. SIAPKAN THUMBNAIL
        let thumbBuffer = null;
        try {
            const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (q?.imageMessage) {
                const p = await downloadAndSaveMedia(sock, q, "temp_jpm_thumb");
                thumbBuffer = fs.readFileSync(p);
                fs.unlinkSync(p);
            } else {
                const res = await fetch(CONFIG.URL_GAMBAR);
                const arrayBuffer = await res.arrayBuffer();
                thumbBuffer = Buffer.from(arrayBuffer);
            }
        } catch (e) {
            console.error("Gagal load thumbnail:", e);
        }

        // B. DETEKSI LINK GRUP
        const linkMatch = val.match(/(https?:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]{5,})/);
        const finalLink = linkMatch ? linkMatch[0] : CONFIG.LINK_GRUP_MANUAL;

        if (finalLink.includes("GantiLinkIni")) {
            sock.sendMessage(chatId, { text: "⚠️ PERINGATAN: Link Grup belum di-setting di script (plugins/autojpm.js)!" });
        }

        saveStatus(true, val, thumbBuffer ? thumbBuffer.toString('base64') : null);

        let statusMsg = `🚀 *AUTO JPM GRUP AKTIF*\n\n`;
        statusMsg += `📝 Pesan: ${val}\n`;
        statusMsg += `🔗 Tujuan Tombol: ${finalLink}\n`;
        statusMsg += `⏱️ Jeda: ${global.autojpm.loopDelayHours ? global.autojpm.loopDelayHours * 60 : 60} menit`;
        sock.sendMessage(chatId, { text: statusMsg });
        
        // --- MULAI LOOPING ---
        while (global.autojpmRunning) {
            const groups = await sock.groupFetchAllParticipating();
            const whitelist = readWhitelist();
            const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));
            
            for (const g of targets) {
                if (!global.autojpmRunning) break;
                
                try {
                    // C. KIRIM PESAN DENGAN CARD (TOMBOL)
                    await sock.sendMessage(g.id, { 
                        text: spintax(val),
                        contextInfo: {
                            forwardingScore: 999,
                            isForwarded: true,
                            externalAdReply: {
                                showAdAttribution: true, 
                                title: CONFIG.JUDUL_TOMBOL, // "Bergabung ke grup"          
                                body: CONFIG.DESKRIPSI_TOMBOL, 
                                thumbnail: thumbBuffer,      
                                sourceUrl: finalLink,      
                                mediaType: 1,
                                renderLargerThumbnail: true 
                            }
                        }
                    });

                } catch (e) {}

                // Delay Random (20-30 detik)
                await new Promise(r => setTimeout(r, 20000 + Math.floor(Math.random() * 10000)));
            }
            
            if (!global.autojpmRunning) break;
            const delayMs = (global.autojpm.loopDelayHours || 1) * 3600000;
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    // --- 3. MATIKAN (OFF) ---
    if (cmd === "off") {
        global.autojpmRunning = false;
        saveStatus(false, null, null);
        sock.sendMessage(chatId, { text: "🛑 AUTO JPM MATI" });
    }
}
export default autojpm;
            
