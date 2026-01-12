import { spintax, readWhitelist } from "../lib/utils.js";
import { saveStatus } from "../lib/resumeAutoJPM.js";

// ===========================================================
// KONFIGURASI LINK (Wajib Diisi)
// ===========================================================
const CONFIG = {
    // Masukkan Link Grup Anda di sini
    LINK_GRUP: "https://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb" 
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
        
        // Cek Link: Apakah user mengetik link di pesan? Jika tidak, ambil dari CONFIG
        // Regex ini mencari link grup whatsapp
        const linkMatch = val.match(/(https?:\/\/chat\.whatsapp\.com\/[a-zA-Z0-9]{5,})/);
        const finalLink = linkMatch ? linkMatch[0] : CONFIG.LINK_GRUP;

        // Validasi: Jika link masih default (belum diganti)
        if (finalLink.includes("GantiLinkIni")) {
            sock.sendMessage(chatId, { text: "⚠️ PERINGATAN: Link Grup belum di-setting di script (plugins/autojpm.js)!" });
        }

        // Simpan status (Tanpa gambar, karena kita pakai mode native)
        saveStatus(true, val, null);

        let statusMsg = `🚀 *AUTO JPM NATIVE AKTIF*\n\n`;
        statusMsg += `🔗 Link Grup: ${finalLink}\n`;
        statusMsg += `⏱️ Jeda: ${global.autojpm.loopDelayHours ? global.autojpm.loopDelayHours * 60 : 60} menit\n\n`;
        statusMsg += `ℹ️ *Info:* Menggunakan tampilan bawaan WhatsApp (Link Preview).`;
        sock.sendMessage(chatId, { text: statusMsg });
        
        // --- MULAI LOOPING ---
        while (global.autojpmRunning) {
            const groups = await sock.groupFetchAllParticipating();
            const whitelist = readWhitelist();
            const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));
            
            for (const g of targets) {
                if (!global.autojpmRunning) break;
                
                try {
                    // LOGIKA PENGIRIMAN "NATIVE"
                    // Kita gabungkan teks user dengan Link Grup agar preview muncul
                    let pesanFinal = spintax(val);

                    // Jika di dalam teks pesan belum ada linknya, kita tempelkan link di bawahnya
                    // Agar preview tombol muncul
                    if (!pesanFinal.includes("chat.whatsapp.com")) {
                        pesanFinal += `\n\n${finalLink}`;
                    }

                    // Kirim Teks Murni (Tanpa externalAdReply)
                    // WhatsApp penerima akan otomatis membuat preview tombol "Lihat Grup"
                    await sock.sendMessage(g.id, { 
                        text: pesanFinal
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
                                                
