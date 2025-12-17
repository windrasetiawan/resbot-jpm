/*
⚠️ CODE UTAMA RESBOT JPM V3 (FIXED IMPORT BAILEYS)
*/
console.log('Start App ..');

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";

// --- IMPORT BAILEYS (SAFE MODE) ---
import * as baileys from "baileys";
// Ambil makeWASocket dari default atau langsung dari module
const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

import { handleCommand, logWithTime, ChangeStatus, getStatus, deleteFolderRecursive } from "./lib/utils.js";
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Load Plugins Manual (Agar tidak error saat load otomatis)
import fileManager from "./plugins/file_manager.js";
import groupFeatures from "./plugins/group_features.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = __dirname;
const status = getStatus(`${basePath}/sessions/`);

// --- MEMORY ---
const antiLinkData = {}; 
let scheduleInterval;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
   
    const sock = makeWASocket({
        version,
        auth: state,
        // printQRInTerminal: true, // Deprecated, kita matikan biar gak warning
        logger: P({ level: "silent" }),
    });

    // Handle QR Manual jika printQRInTerminal deprecated
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
             // Jika library qrcode-terminal terinstall, bisa dipakai. 
             // Jika tidak, QR string akan muncul di log (biasanya butuh qrcode-terminal untuk render)
             import('qrcode-terminal').then((qrcode) => {
                 qrcode.generate(qr, { small: true });
             }).catch(() => console.log("Scan QR Code diatas:", qr));
        }

        if (connection === "close") {
            clearInterval(scheduleInterval); 
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log(clc.green("✅ Terhubung!"));
            ChangeStatus(`${basePath}/sessions/`, "connected");
            resumeAutoJPM(sock);
            startGroupScheduler(sock); 
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages[0]) return;
        await handleIncomingMessages(sock, m);
    });
    
    sock.ev.on("creds.update", saveCreds);
}

function startGroupScheduler(sock) {
    scheduleInterval = setInterval(async () => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        if (!fs.existsSync('./DATABASE/group_schedule.json')) return;
        try {
            const db = JSON.parse(fs.readFileSync('./DATABASE/group_schedule.json'));
            for (const [groupId, times] of Object.entries(db)) {
                if (times.open === currentTime) {
                    await sock.groupSettingUpdate(groupId, "not_announcement");
                    await sock.sendMessage(groupId, { text: "⏰ Waktunya grup dibuka secara otomatis." });
                }
                if (times.close === currentTime) {
                    await sock.groupSettingUpdate(groupId, "announcement");
                    await sock.sendMessage(groupId, { text: "⏰ Waktunya grup ditutup secara otomatis." });
                }
            }
        } catch (e) {
            console.error("Error scheduler:", e);
        }
    }, 60000); 
}

async function handleIncomingMessages(sock, messageEvent) {
    try {
        const msg = messageEvent.messages[0];
        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        const senderNum = sender.split('@')[0];
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        // 1. Anti-Link
        if (isGroup && (text.includes("chat.whatsapp.com") || text.includes("http"))) {
            const key = `${msg.key.remoteJid}-${senderNum}`;
            if (!antiLinkData[key]) antiLinkData[key] = 0;
            antiLinkData[key] += 1;
            if (antiLinkData[key] > 2) await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        }

        // 2. Fitur File Fuzzy
        if (text.startsWith("#") && text.length > 2) {
            const query = text.substring(1).trim(); 
            const filesDir = './ADDTIONAL/files';
            if (fs.existsSync(filesDir)) {
                const files = fs.readdirSync(filesDir);
                const matches = files.filter(f => f.toLowerCase().includes(query.toLowerCase()));
                if (matches.length === 1) {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        document: fs.readFileSync(path.join(filesDir, matches[0])), 
                        mimetype: 'application/octet-stream',
                        fileName: matches[0]
                    }, { quoted: msg });
                    return; 
                }
            }
        }

        // 3. Routing Plugins
        if (typeof fileManager === 'function') await fileManager(sock, msg.key.remoteJid, text, msg.key, messageEvent);
        if (typeof groupFeatures === 'function') await groupFeatures(sock, msg.key.remoteJid, text, msg.key, isGroup);
        
        // 4. Command Handler Utama
        await handleCommand(sock, msg.key.remoteJid, text, msg.key, senderNum, messageEvent, false);

    } catch (e) {
        console.error("Error handling message:", e);
    }
}

if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
