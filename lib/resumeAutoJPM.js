import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import clc from "cli-color";
import { readWhitelist } from "./utils.js"; 

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function spintax(text) {
    if (!text) return "";
    return text.replace(/{([^{}]+)}/g, (match, choices) => {
        const options = choices.split("|");
        return options[Math.floor(Math.random() * options.length)];
    });
}

// Simpan Status (Wajib ada delayMinutes)
export function saveStatus(isRunning, text, imageBase64, lastIndex = 0, delayMinutes = 60) {
    if (!fs.existsSync(path.dirname(statusPath))) fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    fs.writeFileSync(statusPath, JSON.stringify({ running: isRunning, text, imageBase64, lastIndex, delayMinutes }));
}

function readStatus() {
    try {
        if (!fs.existsSync(statusPath)) return null;
        return JSON.parse(fs.readFileSync(statusPath));
    } catch { return null; }
}

export async function startJPMLoop(sock) {
    console.log(clc.green("🚀 [AUTO-JPM] Mesin Dijalankan!"));

    while (global.autojpmRunning) {
        const status = readStatus();
        if (!status || !status.running) {
            global.autojpmRunning = false;
            break;
        }

        const { text, imageBase64, lastIndex } = status;
        const savedDelay = status.delayMinutes || 60; 
        
        let groups = [];
        try {
            const allGroups = await sock.groupFetchAllParticipating();
            const whitelist = readWhitelist ? readWhitelist() : [];
            groups = Object.values(allGroups).filter(g => !whitelist.includes(g.id));
        } catch (e) {
            await sleep(10000);
            continue;
        }

        if (groups.length === 0) {
            await sleep(60000);
            continue;
        }

        let currentIndex = lastIndex || 0;
        if (currentIndex >= groups.length) currentIndex = 0; 

        for (let i = currentIndex; i < groups.length; i++) {
            if (!global.autojpmRunning) break;
            const g = groups[i];
            
            try {
                const content = imageBase64 
                    ? { image: Buffer.from(imageBase64.split(',')[1], 'base64'), caption: spintax(text) } 
                    : { text: spintax(text) };
                await sock.sendMessage(g.id, content);
                console.log(clc.green(`[JPM ${i+1}/${groups.length}] Sukses: ${g.subject}`));
                saveStatus(true, text, imageBase64, i + 1, savedDelay);
            } catch (err) {
                console.log(clc.red(`[JPM GAGAL] ${g.subject}: ${err.message}`));
            }

            const jeda = 15000 + Math.floor(Math.random() * 5000);
            await sleep(jeda);
        }

        if (global.autojpmRunning) {
            saveStatus(true, text, imageBase64, 0, savedDelay); 
            // Konversi Menit ke MS
            const delayMs = savedDelay * 60 * 1000;

            // --- KIRIM LAPORAN KE OWNER ---
            try {
                const ownerList = global.owner || [];
                const ownerNum = Array.isArray(ownerList) ? ownerList[0] : ownerList;
                if (ownerNum) {
                    const ownerId = ownerNum.replace(/\D/g, "") + "@s.whatsapp.net";
                    const botName = sock.user?.name || "Wintuneling Bot"; 
                    const msgLaporan = `✅ *PUTARAN SELESAI*\n\n` +
                                       `📂 Terkirim ke: ${groups.length} grup\n` +
                                       `☕ Bot istirahat selama: ${savedDelay} Menit\n` +
                                       `_Nanti akan lanjut otomatis._`;
                    await sock.sendMessage(ownerId, { text: msgLaporan });
                }
            } catch (e) {
                console.log("[AUTO-JPM] Gagal lapor owner.");
            }
            // -----------------------------

            console.log(clc.yellow(`[AUTO-JPM] ☕ Istirahat ${savedDelay} menit...`));
            await sleep(delayMs);
            console.log(clc.green("[AUTO-JPM] ▶️ Bangun tidur... Lanjut!"));
        }
    }
}

async function resumeAutoJPM(sock) {
    if (!fs.existsSync(statusPath)) return;
    try { 
        const status = JSON.parse(fs.readFileSync(statusPath)); 
        if (status && status.running) {
            console.log(clc.green("[SYSTEM] Resume Auto JPM aktif..."));
            global.autojpmRunning = true;
            startJPMLoop(sock).catch(console.error);
        }
    } catch { return; }
}
export default resumeAutoJPM;
