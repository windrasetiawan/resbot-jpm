import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import clc from "cli-color";
import { readWhitelist } from "./utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

// --- HELPER: SIMPAN STATUS ---
// Fungsi ini yang dicari oleh autojpm.js
function saveStatus(isRunning, text, imageBase64) {
    // Pastikan folder DATABASE ada
    const dbDir = path.dirname(statusPath);
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    fs.writeFileSync(statusPath, JSON.stringify({ running: isRunning, text, imageBase64 }));
}

async function resumeAutoJPM(sock) {
    if (!fs.existsSync(statusPath)) return;
    
    let status;
    try { status = JSON.parse(fs.readFileSync(statusPath)); } catch { return; }
    
    if (!status.running || !status.text) return;

    console.log(clc.cyan("🔁 MELANJUTKAN AUTO JPM YANG TERTUNDA..."));
    
    // Restore Gambar (Jika ada)
    const tmpImg = path.join(process.cwd(), "tmp", "resume.jpg");
    let hasImage = false;
    if (status.imageBase64) {
        // Pastikan folder tmp ada
        const tmpDir = path.dirname(tmpImg);
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
        
        fs.writeFileSync(tmpImg, Buffer.from(status.imageBase64, 'base64'));
        hasImage = true;
    }

    // Set global flag agar loop berjalan
    global.autojpmRunning = true;

    // Loop JPM
    while (global.autojpmRunning) {
        const groups = await sock.groupFetchAllParticipating();
        const whitelist = readWhitelist();
        const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));

        for (const g of targets) {
            if (!global.autojpmRunning) break;
            try {
                console.log(clc.green(`[AUTO-RESUME] Kirim ke: ${g.subject}`));
                await sock.sendMessage(g.id, hasImage 
                    ? { image: fs.readFileSync(tmpImg), caption: status.text }
                    : { text: status.text }
                );
                // Delay Aman (20-30 Detik)
                await new Promise(r => setTimeout(r, 20000 + Math.floor(Math.random() * 10000)));
            } catch {}
        }

        if (!global.autojpmRunning) break;

        // Istirahat
        const jam = global.autojpm?.loopDelayHours || 1;
        console.log(clc.yellow(`💤 Istirahat ${jam} jam sebelum putaran baru...`));
        await new Promise(r => setTimeout(r, jam * 3600 * 1000));
    }
}

// --- BAGIAN PENTING (JANGAN DIHAPUS) ---
export default resumeAutoJPM;
export { saveStatus };
