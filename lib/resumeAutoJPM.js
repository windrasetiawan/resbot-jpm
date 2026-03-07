import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import clc from "cli-color";
import { readWhitelist } from "./utils.js"; 

const NAMA_BOT = "WINTUNELING VPN"; 
const LINK_GRUP = "https://chat.whatsapp.com/IRaOCbFdgaO6Rmx0tsgyyb"; 
const BODY_TEXT = "Klik Disini - Gabung Grup";
const DEFAULT_GAMBAR_URL = "https://files.catbox.moe/6mgvvd.jpg"; 

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function getBuffer(url) {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) { return null; }
}

function spintax(text) {
    if (!text) return "";
    return text.replace(/{([^{}]+)}/g, (match, choices) => {
        const options = choices.split("|");
        return options[Math.floor(Math.random() * options.length)];
    });
}

export function saveStatus(isRunning, text, imageBase64, lastIndex = 0, delayMinutes = 60, senderJid = null, nextRunTime = null) {
    if (!fs.existsSync(path.dirname(statusPath))) fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    
    let currentData = {};
    try { if (fs.existsSync(statusPath)) currentData = JSON.parse(fs.readFileSync(statusPath)); } catch {}
    
    const targetJid = senderJid || currentData.senderJid || null;
    let targetNextRun = currentData.nextRunTime || null;
    if (nextRunTime !== null) targetNextRun = nextRunTime === 0 ? null : nextRunTime;

    fs.writeFileSync(statusPath, JSON.stringify({ 
        running: isRunning, text, imageBase64, lastIndex, delayMinutes, senderJid: targetJid, nextRunTime: targetNextRun
    }));
}

function readStatus() {
    try {
        if (!fs.existsSync(statusPath)) return null;
        return JSON.parse(fs.readFileSync(statusPath));
    } catch { return null; }
}

async function sendMenuCloneMessage(sock, jid, text, imageBase64) {
    let bufferGambar = null;
    if (imageBase64) {
        bufferGambar = Buffer.from(imageBase64.split(',')[1], 'base64');
    } else {
        bufferGambar = await getBuffer(DEFAULT_GAMBAR_URL);
    }

    const msgOptions = {
        text: spintax(text), 
        contextInfo: {
            externalAdReply: {
                showAdAttribution: false, 
                title: NAMA_BOT,          
                body: BODY_TEXT, 
                thumbnail: bufferGambar,
                jpegThumbnail: bufferGambar,  
                thumbnailUrl: LINK_GRUP,
                sourceUrl: LINK_GRUP,
                mediaType: 1,
                renderLargerThumbnail: true 
            }
        }
    };

    await sock.sendMessage(jid, msgOptions);
}

let isLoopingActive = false;

export async function startJPMLoop(sock) {
    if (isLoopingActive) {
        console.log(clc.yellow("⚠️ [AUTO-JPM] Peringatan: Mencegah Loop Ganda!"));
        return;
    }
    
    isLoopingActive = true;
    console.log(clc.green("🚀 [AUTO-JPM] Mesin V7 Berjalan..."));

    const initStatus = readStatus();
    if (initStatus && initStatus.nextRunTime && Date.now() < initStatus.nextRunTime) {
        const sisaMs = initStatus.nextRunTime - Date.now();
        console.log(clc.yellow(`[AUTO-JPM] Melanjutkan sisa istirahat...`));
        await sleep(sisaMs);
    }

    while (global.autojpmRunning) {
        const currentSock = global.sock || sock; 
        
        const status = readStatus();
        if (!status || !status.running) {
            global.autojpmRunning = false;
            break;
        }

        const { text, imageBase64, lastIndex, senderJid } = status;

        let groups = [];
        try {
            const allGroups = await currentSock.groupFetchAllParticipating();
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
                await sendMenuCloneMessage(currentSock, g.id, text, imageBase64);
                console.log(clc.green(`[JPM ${i+1}/${groups.length}] Sukses: ${g.subject}`));
                
                const freshStatus = readStatus() || {};
                const freshDelay = freshStatus.delayMinutes || 60;
                
                saveStatus(true, text, imageBase64, i + 1, freshDelay, senderJid, null);
            } catch (err) {
                console.log(clc.red(`[JPM GAGAL] ${g.subject}: ${err.message}`));
            }

            const jeda = 15000 + Math.floor(Math.random() * 10000); 
            await sleep(jeda);
        }

        if (global.autojpmRunning) {
            const finalStatus = readStatus() || {};
            const finalDelay = finalStatus.delayMinutes || 60;
            const delayMs = finalDelay * 60 * 1000;
            
            const targetBangun = Date.now() + delayMs;
            saveStatus(true, text, imageBase64, 0, finalDelay, senderJid, targetBangun); 

            try {
                const targetId = senderJid || (global.owner ? (global.owner[0] + "@s.whatsapp.net") : (currentSock.user.id.split(':')[0] + "@s.whatsapp.net"));
                const msgLaporan = `✅ *PUTARAN SELESAI*\n\n📂 Terkirim ke: ${groups.length} grup\n☕ Bot istirahat selama: ${finalDelay} Menit\n_Nanti akan lanjut otomatis._`;
                await currentSock.sendMessage(targetId, { text: msgLaporan });
            } catch (e) {}

            console.log(clc.yellow(`[AUTO-JPM] ☕ Istirahat ${finalDelay} menit...`));
            await sleep(delayMs);
        }
    }
    
    isLoopingActive = false;
}

async function resumeAutoJPM(sock) {
    if (!fs.existsSync(statusPath)) return;
    try { 
        const status = JSON.parse(fs.readFileSync(statusPath)); 
        if (status && status.running) {
            global.autojpmRunning = true;
            startJPMLoop(global.sock || sock).catch(console.error);
        }
    } catch { return; }
}
export default resumeAutoJPM;
