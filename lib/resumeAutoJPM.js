import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import clc from "cli-color";
import { readWhitelist } from "./utils.js"; // Pastikan utils ada export ini

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

// Helper Sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fungsi Spintax Sederhana (Jika di utils tidak ada/error)
function spintax(text) {
    if (!text) return "";
    return text.replace(/{([^{}]+)}/g, (match, choices) => {
        const options = choices.split("|");
        return options[Math.floor(Math.random() * options.length)];
    });
}

export function saveStatus(isRunning, text, imageBase64, lastIndex = 0) {
    if (!fs.existsSync(path.dirname(statusPath))) fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify({ running: isRunning, text, imageBase64, lastIndex }));
}

function readStatus() {
    try {
        if (!fs.existsSync(statusPath)) return null;
        return JSON.parse(fs.readFileSync(statusPath));
    } catch { return null; }
}

// --- ENGINE UTAMA JPM ---
export async function startJPMLoop(sock) {
    console.log(clc.green("🚀 [AUTO-JPM] Engine Started!"));

    // Loop Utama (Keep Alive)
    while (global.autojpmRunning) {
        const status = readStatus();
        if (!status || !status.running) {
            global.autojpmRunning = false;
            break;
        }

        const { text, imageBase64, lastIndex } = status;
        
        // 1. Ambil & Filter Target
        let groups = [];
        try {
            const allGroups = await sock.groupFetchAllParticipating();
            const whitelist = readWhitelist ? readWhitelist() : [];
            groups = Object.values(allGroups).filter(g => !whitelist.includes(g.id));
        } catch (e) {
            console.log(clc.red("[AUTO-JPM] Gagal fetch grup, mencoba lagi dalam 10 detik..."));
            await sleep(10000);
            continue;
        }

        if (groups.length === 0) {
            console.log(clc.yellow("[AUTO-JPM] Tidak ada grup target. Standby..."));
            await sleep(60000);
            continue;
        }

        // 2. Tentukan Index Mulai
        let currentIndex = lastIndex || 0;
        if (currentIndex >= groups.length) currentIndex = 0; // Reset jika overflow

        console.log(clc.cyan(`[AUTO-JPM] Memulai putaran. Target: ${groups.length} Grup. Start Index: ${currentIndex}`));

        // 3. Loop Pengiriman
        for (let i = currentIndex; i < groups.length; i++) {
            // Cek status real-time (biar bisa di-stop saat jalan)
            if (!global.autojpmRunning) break;

            const g = groups[i];
            
            try {
                // Susun Pesan (Text / Image)
                const content = imageBase64 
                    ? { image: Buffer.from(imageBase64.split(',')[1], 'base64'), caption: spintax(text) } 
                    : { text: spintax(text) };
                
                // Kirim
                await sock.sendMessage(g.id, content);
                console.log(clc.green(`[JPM ${i+1}/${groups.length}] Sukses: ${g.subject}`));

                // Simpan Index (Checkpoint)
                saveStatus(true, text, imageBase64, i + 1);

            } catch (err) {
                console.log(clc.red(`[JPM GAGAL] ${g.subject}: ${err.message}`));
            }

            // Jeda Antar Pesan (Default 15 detik jika tidak diset)
            // Menggunakan random delay sedikit agar lebih aman
            const jedaDasar = 15000; 
            const randomTambahan = Math.floor(Math.random() * 3000); // 0-3 detik
            await sleep(jedaDasar + randomTambahan);
        }

        // 4. ISTIRAHAT (Loop Selesai)
        if (global.autojpmRunning) {
            // Reset index ke 0 untuk putaran berikutnya
            saveStatus(true, text, imageBase64, 0);

            // Ambil waktu delay dari setting (default 60 menit)
            const delayHours = global.autojpm?.loopDelayHours || 1; 
            const delayMs = delayHours * 60 * 60 * 1000;

            console.log(clc.yellow(`[AUTO-JPM] ☕ Putaran Selesai. Istirahat ${delayHours} jam (${delayMs/1000}s)...`));
            
            // Tunggu waktu istirahat
            await sleep(delayMs);
            
            console.log(clc.green("[AUTO-JPM] ▶️ Bangun dari istirahat. Lanjut putaran baru..."));
        }
    }
}

// Fungsi Resume saat Start Bot
async function resumeAutoJPM(sock) {
    if (!fs.existsSync(statusPath)) return;
    
    let status;
    try { status = JSON.parse(fs.readFileSync(statusPath)); } catch { return; }
    
    if (status && status.running) {
        console.log(clc.green("[SYSTEM] Mendeteksi Auto JPM aktif, melanjutkan tugas..."));
        global.autojpmRunning = true;
        
        // Panggil loop utama tanpa await (async background)
        startJPMLoop(sock).catch(err => console.error("JPM Error:", err));
    }
}

export default resumeAutoJPM;
