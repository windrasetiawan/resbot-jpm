import { spintax, readWhitelist } from "../lib/utils.js";
import { saveStatus } from "../lib/resumeAutoJPM.js";

async function autojpm(sock, chatId, text, key, msg) {
    if (!text.toLowerCase().startsWith(".autojpm")) return;
    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");
    
    // Pastikan objek global ada
    global.autojpm = global.autojpm || {};

    // --- 1. SETTING JEDA ---
    if (cmd === "set") {
        const min = parseInt(val);
        if (isNaN(min)) return sock.sendMessage(chatId, { text: "⚠️ Masukkan angka menit!" });
        global.autojpm.loopDelayHours = min / 60;
        return sock.sendMessage(chatId, { text: `✅ Jeda diatur: ${min} menit.` });
    }

    // --- 2. AKTIFKAN (ON) ---
    if (cmd === "on" && val) {
        if (global.autojpmRunning) return sock.sendMessage(chatId, { text: "⚠️ Auto JPM sudah berjalan!" });

        global.autojpmRunning = true;
        saveStatus(true, val, null);
        sock.sendMessage(chatId, { text: "🚀 AUTO JPM AKTIF" });
        
        // Loop Utama
        while (global.autojpmRunning) {
            const groups = await sock.groupFetchAllParticipating();
            const whitelist = readWhitelist();
            const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));
            
            let successCount = 0; // Reset hitungan per putaran

            // Loop Pengiriman ke Grup
            for (const g of targets) {
                if (!global.autojpmRunning) break;
                
                try {
                    await sock.sendMessage(g.id, { text: spintax(val) });
                    successCount++; // Tambah hitungan jika sukses
                } catch (e) {
                    // Gagal kirim (skip)
                }

                // Delay pendek antar pesan (20-30 detik)
                await new Promise(r => setTimeout(r, 20000 + Math.floor(Math.random() * 10000)));
            }
            
            if (!global.autojpmRunning) break;

            // Hitung durasi istirahat untuk laporan
            const hours = global.autojpm.loopDelayHours || 1;
            const delayMs = hours * 3600000;
            const delayMin = hours * 60;

            // --- KIRIM LAPORAN KE OWNER ---
            await sock.sendMessage(chatId, { 
                text: `✅ *PUTARAN SELESAI*\n\n📂 Terkirim ke: ${successCount} grup\n😴 Bot istirahat selama: ${delayMin} menit...` 
            });

            // Bot Tidur Panjang
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
