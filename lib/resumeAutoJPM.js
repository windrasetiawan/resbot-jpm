import fs from "fs";
import path from "path";
import clc from "cli-color";
import { readWhitelist, spintax } from "./utils.js";

// --- KONFIGURASI JPM ---
const CONFIG = {
    // Link Saluran (Target Klik Tombol)
    LINK_SALURAN: "https://whatsapp.com/channel/0029Vb7HB0Z1CYoIGSRyjV0v", 
    // Judul Tebal di samping/bawah gambar
    NAMA_BOT: "WINTUNELING VPN", 
    // Gambar Thumbnail
    URL_GAMBAR: "https://i.postimg.cc/QxRH3vL4/00882a50-fb6d-4520-80cb-dcf3f0f913aa.jpg"
};

const statusPath = path.join(process.cwd(), "DATABASE", "autojpm_status.json");

// Helper: Download Gambar
const getBuffer = async (url) => {
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (error) { return null; }
};

export function saveStatus(isRunning, text, imageBase64 = null) {
    if (!fs.existsSync(path.dirname(statusPath))) fs.mkdirSync(path.dirname(statusPath), { recursive: true });
    
    let currentData = {};
    try { currentData = JSON.parse(fs.readFileSync(statusPath)); } catch {}
    
    const newData = {
        running: isRunning,
        text: text || currentData.text,
        imageBase64: imageBase64 !== null ? imageBase64 : currentData.imageBase64
    };
    fs.writeFileSync(statusPath, JSON.stringify(newData, null, 2));
}

// MESIN UTAMA JPM
export async function startJPMLoop() {
    if (global.isJPMLoopRunning) return;
    global.isJPMLoopRunning = true;

    console.log(clc.cyan("🔄 JPM Engine Started (Clean Button Mode)..."));

    while (true) {
        if (!global.autojpmRunning) {
            console.log(clc.yellow("🛑 JPM Stopped."));
            break;
        }

        const sock = global.sock;
        if (!sock) {
            await new Promise(r => setTimeout(r, 5000));
            continue;
        }

        try {
            let status = JSON.parse(fs.readFileSync(statusPath));
            if (!status.text) throw new Error("No text");

            const groups = await sock.groupFetchAllParticipating();
            const whitelist = readWhitelist();
            const targets = Object.values(groups).filter(g => !whitelist.includes(g.id));
            let successCount = 0;

            console.log(clc.blue(`🚀 Memulai putaran JPM ke ${targets.length} grup...`));

            // 1. Download Gambar Thumbnail
            let finalBuffer = null;
            if (status.imageBase64 && status.imageBase64.startsWith('data:image')) {
                finalBuffer = Buffer.from(status.imageBase64.split(',')[1], 'base64');
            } else {
                finalBuffer = await getBuffer(CONFIG.URL_GAMBAR);
            }

            // 2. KIRIM PESAN (TANPA QUOTED "STATUS")
            for (const g of targets) {
                if (!global.autojpmRunning) break;

                try {
                    const messageText = spintax(status.text);
                    const msgOptions = {
                        text: messageText,
                        contextInfo: {
                            mentionedJid: [g.id], // Tag agar masuk notif
                            externalAdReply: {
                                showAdAttribution: true, // Tanda "Iklan" kecil
                                title: CONFIG.NAMA_BOT, // Judul Besar
                                body: "Klik Disini - Gabung Saluran", // Teks kecil
                                thumbnail: finalBuffer, // Gambar
                                sourceUrl: CONFIG.LINK_SALURAN, // Link Tujuan
                                mediaType: 1,
                                renderLargerThumbnail: true // Gambar Besar
                            }
                        }
                    };

                    // HAPUS BAGIAN { quoted: ... } DISINI AGAR HEADER HILANG
                    await sock.sendMessage(g.id, msgOptions);
                    
                    successCount++;
                } catch (e) {
                    // Skip jika gagal
                }

                // Delay Random (10-15 detik)
                await new Promise(r => setTimeout(r, 10000 + Math.floor(Math.random() * 5000)));
            }

            if (global.autojpmRunning) {
                const hours = global.autojpm?.loopDelayHours || 1;
                const delayMs = hours * 3600000; 
                console.log(clc.magenta(`✅ Putaran selesai. Terkirim: ${successCount}. Istirahat ${hours} jam...`));
                await new Promise(r => setTimeout(r, delayMs));
            }

        } catch (e) {
            console.error("JPM Error:", e.message);
            await new Promise(r => setTimeout(r, 60000));
        }
    }
    global.isJPMLoopRunning = false;
}

async function resumeAutoJPM(sock) {
    if (!fs.existsSync(statusPath)) return;
    let status;
    try { status = JSON.parse(fs.readFileSync(statusPath)); } catch { return; }
    
    if (status.running) {
        console.log(clc.green("✅ Melanjutkan Auto JPM..."));
        global.autojpmRunning = true;
        startJPMLoop(); 
    }
}

export default resumeAutoJPM;
