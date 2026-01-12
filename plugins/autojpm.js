import clc from 'cli-color';
import { spintax, readWhitelist } from '../lib/utils.js';
import { saveStatus } from '../lib/resumeAutoJPM.js';

// --- KONFIGURASI TAMPILAN ---
// Ganti dengan Link Grup WhatsApp kamu
const LINK_GRUP = "https://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb"; 
const NAMA_BOT = "WINTUNELING VPN"; 
const URL_GAMBAR = "https://i.postimg.cc/QMKxjgB5/5993369430278212488.jpg"; 

// Helper Download Gambar
const getBuffer = async (url) => {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) { return null; }
}

async function autojpm(sock, chatId, text, key, msg) {
    // 1. Cek Command
    if (!text.toLowerCase().startsWith(".autojpm")) return;
    
    const args = text.split(" ");
    const cmd = args[1]?.toLowerCase();
    const val = args.slice(2).join(" ");

    // --- LOGIC SET DELAY ---
    if (cmd === "set") {
        const min = parseInt(val);
        if (isNaN(min)) return sock.sendMessage(chatId, { text: "⚠️ Masukkan angka (menit)!" });
        
        // Simpan delay ke global object (pastikan global.autojpm sudah diinit di index.js/main)
        if (!global.autojpm) global.autojpm = {};
        global.autojpm.loopDelayHours = min / 60; 
        
        return sock.sendMessage(chatId, { text: `✅ Jeda putaran diatur: ${min} menit.` });
    }

    // --- LOGIC ON (START) ---
    if (cmd === "on") {
        if (!val) return sock.sendMessage(chatId, { text: "⚠️ Masukkan pesan! Contoh: .autojpm on Halo semua..." });

        // Set status Running
        global.autojpmRunning = true;
        
        // Simpan ke database resume (isRunning, text, delay)
        saveStatus(true, val, global.autojpm?.loopDelayHours || 1); 
        
        sock.sendMessage(chatId, { text: "🚀 **AUTO JPM AKTIF**\nMode: Group Link Style" });

        // Download Gambar sekali saja di awal
        const bufferGambar = await getBuffer(URL_GAMBAR);
        
        // Loop Utama
        while (global.autojpmRunning) {
            console.log(clc.cyan("--- MEMULAI PUTARAN AUTO JPM ---"));
            
            // Ambil daftar grup & filter whitelist
            const groups = await sock.groupFetchAllParticipating();
            let whitelist = [];
            try { whitelist = readWhitelist ? readWhitelist() : []; } catch(e) {}
            
            const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));
            
            // Loop kirim ke setiap grup
            for (const g of targets) {
                if (!global.autojpmRunning) break; // Cek jika dimatikan di tengah jalan

                try {
                    // Siapkan Pesan (Spintax support: {Halo|Hai})
                    const pesan = spintax(val);

                    // Struktur Pesan Group Link
                    const msgOptions = {
                        text: pesan, 
                        contextInfo: {
                            externalAdReply: {
                                showAdAttribution: true,
                                title: NAMA_BOT,          
                                body: "Klik Disini - Gabung Grup", 
                                thumbnail: bufferGambar,      
                                sourceUrl: LINK_GRUP,
                                mediaType: 1,
                                renderLargerThumbnail: true 
                            }
                        }
                    };

                    // Kirim Pesan
                    await sock.sendMessage(g.id, msgOptions);
                    console.log(clc.green(`[AUTO] Kirim ke: ${g.subject}`));

                    // Jeda antar grup (20-30 detik agar aman)
                    await new Promise(r => setTimeout(r, 20000 + Math.floor(Math.random() * 10000)));

                } catch (e) {
                    console.log(clc.red(`[AUTO] Gagal: ${g.subject}`));
                }
            }
            
            if (!global.autojpmRunning) break;

            // Jeda antar Putaran (Looping)
            const delayJam = global.autojpm?.loopDelayHours || 1; // Default 1 jam jika tidak di-set
            const delayMs = delayJam * 3600000;
            
            console.log(clc.yellow(`[AUTO] Istirahat ${delayJam * 60} menit sebelum putaran berikutnya...`));
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    // --- LOGIC OFF (STOP) ---
    if (cmd === "off") {
        global.autojpmRunning = false;
        saveStatus(false, null, null); // Hapus status dari database resume
        sock.sendMessage(chatId, { text: "🛑 **AUTO JPM DIMATIKAN**" });
    }
}

export default autojpm;
