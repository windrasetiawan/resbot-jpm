import { spintax, readWhitelist, downloadAndSaveMedia } from "../lib/utils.js";
import { saveStatus } from "../lib/resumeAutoJPM.js";
import fs from "fs";

async function autojpm(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".autojpm")) return;
    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");
    
    // Pastikan variabel global tersedia
    global.autojpm = global.autojpm || {};

    // --- COMMAND: SET DELAY ---
    if (cmd === "set") {
        const min = parseInt(val);
        if (isNaN(min)) return sock.sendMessage(chatId, { text: "⚠️ Masukkan angka menit!" });
        global.autojpm.loopDelayHours = min / 60; // Konversi ke jam
        return sock.sendMessage(chatId, { text: `✅ Jeda antar putaran diatur: ${min} menit.` });
    }

    // --- COMMAND: ON ---
    if (cmd === "on" && val) {
        if (global.autojpmRunning) return sock.sendMessage(chatId, { text: "⚠️ Auto JPM sudah berjalan!" });
        
        global.autojpmRunning = true;
        
        // 1. Cek Thumbnail (Jika user me-reply gambar)
        let thumbBuffer = null;
        try {
            const q = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (q?.imageMessage) {
                // Download gambar thumbnail
                const p = await downloadAndSaveMedia(sock, q, "temp_jpm_thumb");
                thumbBuffer = fs.readFileSync(p);
                fs.unlinkSync(p); // Hapus file temp
            }
        } catch (e) {
            console.error("Gagal ambil thumbnail:", e);
        }

        // 2. Deteksi Link Grup di dalam teks (Untuk dijadikan tombol)
        const linkMatch = val.match(/(https:\/\/chat.whatsapp.com\/[a-zA-Z0-9]{20,})/);
        const groupLink = linkMatch ? linkMatch[0] : null;

        // Simpan status ke database (agar bisa resume jika restart)
        saveStatus(true, val, thumbBuffer ? thumbBuffer.toString('base64') : null);

        sock.sendMessage(chatId, { 
            text: `🚀 *AUTO JPM AKTIF*\n\n📝 Teks: ${val}\n🔗 Tombol Join: ${groupLink ? "✅ Terdeteksi" : "❌ Tidak ditemukan link grup"}\n⏱️ Jeda: ${global.autojpm.loopDelayHours ? global.autojpm.loopDelayHours * 60 : 60} menit` 
        });
        
        // MULAI LOOPING
        while (global.autojpmRunning) {
            const groups = await sock.groupFetchAllParticipating();
            const whitelist = readWhitelist();
            // Filter grup (bukan whitelist)
            const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));
            
            for (const g of targets) {
                if (!global.autojpmRunning) break;
                
                try {
                    // Logic Pesan dengan Tampilan Tombol (Ad-Reply)
                    const msgOptions = { text: spintax(val) };
                    
                    if (groupLink) {
                        msgOptions.contextInfo = {
                            externalAdReply: {
                                title: "Bergabung ke grup", // Judul Tombol
                                body: "Klik di sini untuk bergabung!",
                                thumbnailUrl: thumbBuffer ? null : "https://i.postimg.cc/Xq1L1tCM/file-000000008a28622fab894f9b3c177a14.png", // Gambar Default jika tidak ada reply
                                thumbnail: thumbBuffer, 
                                sourceUrl: groupLink, // Link tujuan saat diklik
                                mediaType: 1,
                                renderLargerThumbnail: true,
                                showAdAttribution: true 
                            }
                        };
                    }

                    await sock.sendMessage(g.id, msgOptions);
                } catch (e) {
                    // Ignore error jika dikick bot atau gagal kirim
                }

                // Jeda Antar Pesan (Random 20-30 detik)
                await new Promise(r => setTimeout(r, 20000 + Math.floor(Math.random() * 10000)));
            }
            
            if (!global.autojpmRunning) break;
            
            // Jeda Antar Putaran (Default 1 jam jika tidak di set)
            const delayMs = (global.autojpm.loopDelayHours || 1) * 3600000;
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    // --- COMMAND: OFF ---
    if (cmd === "off") {
        global.autojpmRunning = false;
        saveStatus(false, null, null);
        sock.sendMessage(chatId, { text: "🛑 AUTO JPM MATI" });
    }
}
export default autojpm;
    
