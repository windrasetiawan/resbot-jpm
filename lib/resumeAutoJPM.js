import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import clc from "cli-color";
import { readWhitelist } from "./utils.js"; 

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

// Helper Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper Spintax
function spintax(text) {
    if (!text) return "";
    return text.replace(/{([^{}]+)}/g, (match, choices) => {
        const options = choices.split("|");
        return options[Math.floor(Math.random() * options.length)];
    });
}

// Simpan Status
export function saveStatus(isRunning, text, imageBase64, lastIndex = 0) {
    if (!fs.existsSync(path.dirname(statusPath))) fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify({ running: isRunning, text, imageBase64, lastIndex }));
}

// Baca Status
function readStatus() {
    try {
        if (!fs.existsSync(statusPath)) return null;
        return JSON.parse(fs.readFileSync(statusPath));
    } catch { return null; }
}

// --- ENGINE UTAMA JPM ---
export async function startJPMLoop(sock) {
    console.log(clc.green("🚀 [AUTO-JPM] Mesin Dijalankan!"));

    while (global.autojpmRunning) {
        const status = readStatus();
        if (!status || !status.running) {
            global.autojpmRunning = false;
            break;
        }

        const { text, imageBase64, lastIndex } = status;
        
        // 1. Ambil Target Grup
        let groups = [];
        try {
            const allGroups = await sock.groupFetchAllParticipating();
            const whitelist = readWhitelist ? readWhitelist() : [];
            groups = Object.values(allGroups).filter(g => !whitelist.includes(g.id));
        } catch (e) {
            console.log(clc.red("[AUTO-JPM] Gagal fetch grup, coba lagi 10 detik..."));
            await sleep(10000);
            continue;
        }

        if (groups.length === 0) {
            console.log(clc.yellow("[AUTO-JPM] Tidak ada grup. Menunggu..."));
            await sleep(60000);
            continue;
        }

        // 2. Tentukan Mulai dari Mana (Resume)
        let currentIndex = lastIndex || 0;
        if (currentIndex >= groups.length) currentIndex = 0; 

        // 3. Loop Pengiriman Pesan
        for (let i = currentIndex; i < groups.length; i++) {
            if (!global.autojpmRunning) break;

            const g = groups[i];
            
            try {
                const content = imageBase64 
                    ? { image: Buffer.from(imageBase64.split(',')[1], 'base64'), caption: spintax(text) } 
                    : { text: spintax(text) };
                
                await sock.sendMessage(g.id, content);
                console.log(clc.green(`[JPM ${i+1}/${groups.length}] Sukses: ${g.subject}`));

                // Simpan progres setiap kali kirim (PENTING UNTUK RESUME)
                saveStatus(true, text, imageBase64, i + 1);

            } catch (err) {
                console.log(clc.red(`[JPM GAGAL] ${g.subject}: ${err.message}`));
            }

            // Jeda Acak biar aman (15 - 18 detik)
            const jeda = (global.jeda || 15000) + Math.floor(Math.random() * 3000);
            await sleep(jeda);
        }

        // 4. LOGIKA ISTIRAHAT & LAPORAN (Perbaikan Disini)
        if (global.autojpmRunning) {
            saveStatus(true, text, imageBase64, 0); // Reset index ke 0 untuk putaran baru

            const delayHours = global.autojpm?.loopDelayHours || 1; 
            const delayMinutes = Math.floor(delayHours * 60);
            const delayMs = delayHours * 60 * 60 * 1000;

            // --- KIRIM LAPORAN KE OWNER ---
            try {
                const ownerList = global.owner || [];
                // Ambil nomor owner pertama
                const ownerNum = Array.isArray(ownerList) ? ownerList[0] : ownerList;
                
                if (ownerNum) {
                    const ownerId = ownerNum.replace(/\D/g, "") + "@s.whatsapp.net";
                    
                    // Format Pesan Bersih (Sesuai plugin Anda)
                    const msgLaporan = `✅ *PUTARAN SELESAI*\n\n` +
                                       `📂 Terkirim ke: ${groups.length} grup\n` +
                                       `😴 Bot istirahat selama: ${delayMinutes} menit...\n` +
                                       `_Nanti akan lanjut otomatis._`;

                    await sock.sendMessage(ownerId, { text: msgLaporan });
                }
            } catch (e) {
                console.log("[AUTO-JPM] Gagal kirim laporan: " + e.message);
            }
            // -----------------------------------------------------

            console.log(clc.yellow(`[AUTO-JPM] ☕ Istirahat ${delayMinutes} menit...`));
            
            // Bot tidur disini (Pause)
            await sleep(delayMs);
            
            // Setelah sleep selesai, kodingan ini otomatis jalan lagi (karena di dalam while loop)
            console.log(clc.green("[AUTO-JPM] ▶️ Bangun tidur... Lanjut putaran baru!"));
        }
    }
}

// Fungsi Resume saat Bot Baru Nyala
async function resumeAutoJPM(sock) {
    if (!fs.existsSync(statusPath)) return;
    
    let status;
    try { status = JSON.parse(fs.readFileSync(statusPath)); } catch { return; }
    
    if (status && status.running) {
        console.log(clc.green("[SYSTEM] Resume Auto JPM aktif, melanjutkan tugas..."));
        global.autojpmRunning = true;
        startJPMLoop(sock).catch(console.error);
    }
}

export default resumeAutoJPM;
