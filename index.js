/*
⚠️ CODE UTAMA RESBOT JPM V3
*/
console.log('Start App ..')

import fs from "fs";
import path from "path";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from "baileys";
import P from "pino";
import clc from "cli-color";
import { fileURLToPath } from "url";

import { handleCommand, logWithTime, ChangeStatus, getStatus, deleteFolderRecursive } from "./lib/utils.js";
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Load Plugins
import fileManager from "./plugins/file_manager.js";
import groupFeatures from "./plugins/group_features.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const basePath = __dirname;
const status = getStatus(`${basePath}/sessions/`);

// --- MEMORY ANTI-LINK ---
const antiLinkData = {}; // { "grupId-userNum": count }

// --- SCHEDULER VAR ---
let scheduleInterval;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
   
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, // Gunakan QR default terminal
        logger: P({ level: "silent" }),
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            clearInterval(scheduleInterval); // Stop scheduler jika putus
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log(clc.green("✅ Terhubung!"));
            ChangeStatus(`${basePath}/sessions/`, "connected");
            resumeAutoJPM(sock);
            startGroupScheduler(sock); // Mulai scheduler grup
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages[0]) return;
        await handleIncomingMessages(sock, m);
    });
    
    sock.ev.on("creds.update", saveCreds);
}

// --- FUNGSI SCHEDULER GRUP ---
function startGroupScheduler(sock) {
    scheduleInterval = setInterval(async () => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if (!fs.existsSync('./DATABASE/group_schedule.json')) return;
        const db = JSON.parse(fs.readFileSync('./DATABASE/group_schedule.json'));

        for (const [groupId, times] of Object.entries(db)) {
            // Cek Waktu Buka
            if (times.open === currentTime) {
                await sock.groupSettingUpdate(groupId, "not_announcement");
                await sock.sendMessage(groupId, { text: "⏰ Waktunya grup dibuka secara otomatis." });
                // Reset (opsional, jika ingin sekali jalan hapus dari db, jika harian biarkan)
            }
            // Cek Waktu Tutup
            if (times.close === currentTime) {
                await sock.groupSettingUpdate(groupId, "announcement");
                await sock.sendMessage(groupId, { text: "⏰ Waktunya grup ditutup secara otomatis." });
            }
        }
    }, 60000); // Cek setiap 1 menit
}

async function handleIncomingMessages(sock, messageEvent) {
    try {
        const msg = messageEvent.messages[0];
        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNum = sender.split('@')[0];
        
        // Ambil isi pesan teks
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        // 1. --- ANTI-LINK SOFT BAN (2x Warning, 3x Delete) ---
        if (isGroup && (text.includes("chat.whatsapp.com") || text.includes("http"))) {
            const key = `${msg.key.remoteJid}-${senderNum}`;
            if (!antiLinkData[key]) antiLinkData[key] = 0;
            
            antiLinkData[key] += 1;

            if (antiLinkData[key] > 2) {
                await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
                // Jangan kirim pesan peringatan lagi biar gak spam, cukup delete
            } else {
                // Opsional: Warning
                // await sock.sendMessage(msg.key.remoteJid, { text: `⚠️ Link terdeteksi! (${antiLinkData[key]}/2)` }, { quoted: msg });
            }
        }

        // 2. --- FITUR PANGGIL FILE (FUZZY MATCH) ---
        // Jika pesan diawali # tapi bukan command yang dikenal (misal bukan #wintuneling yg buat list)
        if (text.startsWith("#") && text.length > 2) {
            const query = text.substring(1).trim(); // ambil kata setelah #
            const filesDir = './ADDTIONAL/files';
            
            if (fs.existsSync(filesDir)) {
                const files = fs.readdirSync(filesDir);
                // Cari file yang mengandung nama query (tidak perlu lengkap)
                const matches = files.filter(f => f.toLowerCase().includes(query.toLowerCase()));

                if (matches.length === 1) {
                    // Ketemu 1 file pas, kirim langsung
                    const filePath = path.join(filesDir, matches[0]);
                    await sock.sendMessage(msg.key.remoteJid, { 
                        document: fs.readFileSync(filePath), 
                        mimetype: 'application/octet-stream',
                        fileName: matches[0]
                    }, { quoted: msg });
                    return; // Stop processing command lain
                } else if (matches.length > 1) {
                    // Ketemu banyak, minta user spesifik
                    let txt = `⚠️ Ditemukan banyak file dengan nama "${query}":\n`;
                    matches.forEach(f => txt += `- ${f}\n`);
                    await sock.sendMessage(msg.key.remoteJid, { text: txt }, { quoted: msg });
                    return;
                }
                // Jika 0, mungkin itu command biasa, lanjut ke bawah
            }
        }

        // 3. --- ROUTING PLUGINS ---
        await fileManager(sock, msg.key.remoteJid, text, msg.key, messageEvent);
        await groupFeatures(sock, msg.key.remoteJid, text, msg.key, isGroup);
        
        // 4. --- COMMAND HANDLER UTAMA ---
        await handleCommand(sock, msg.key.remoteJid, text, msg.key, senderNum, messageEvent, false);

    } catch (e) {
        console.error("Error handling message:", e);
    }
}

// Start
if (status === "connected") connectToWhatsApp();
else {
    // Logic pairing sederhana (bisa gunakan kode lama kamu untuk input manual)
    connectToWhatsApp(); 
}
