/*
⚠️ CODE UTAMA RESBOT JPM V3 (FIXED IMPORT)
*/
console.log('Start App ..')

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// --- FIX IMPORT BAILEYS ---
// Menggunakan import default lalu mengambil makeWASocket darinya
import baileys from "baileys";
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
} = baileys;

import P from "pino";
import clc from "cli-color";

import { handleCommand, logWithTime, ChangeStatus, getStatus, deleteFolderRecursive } from "./lib/utils.js";
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Load Plugins
import fileManager from "./plugins/file_manager.js";
import groupFeatures from "./plugins/group_features.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const basePath = __dirname;
const status = getStatus(`${basePath}/sessions/`);

// --- MEMORY ANTI-LINK ---
const antiLinkData = {}; 

// --- SCHEDULER VAR ---
let scheduleInterval;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
   
    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true, 
        logger: P({ level: "silent" }),
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
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

// --- FUNGSI SCHEDULER GRUP ---
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
        
        // 1. --- ANTI-LINK SOFT BAN ---
        if (isGroup && (text.includes("chat.whatsapp.com") || text.includes("http"))) {
            const key = `${msg.key.remoteJid}-${senderNum}`;
            if (!antiLinkData[key]) antiLinkData[key] = 0;
            
            antiLinkData[key] += 1;

            if (antiLinkData[key] > 2) {
                await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
            } 
        }

        // 2. --- FITUR PANGGIL FILE (FUZZY MATCH) ---
        if (text.startsWith("#") && text.length > 2) {
            const query = text.substring(1).trim(); 
            const filesDir = './ADDTIONAL/files';
            
            if (fs.existsSync(filesDir)) {
                const files = fs.readdirSync(filesDir);
                const matches = files.filter(f => f.toLowerCase().includes(query.toLowerCase()));

                if (matches.length === 1) {
                    const filePath = path.join(filesDir, matches[0]);
                    await sock.sendMessage(msg.key.remoteJid, { 
                        document: fs.readFileSync(filePath), 
                        mimetype: 'application/octet-stream',
                        fileName: matches[0]
                    }, { quoted: msg });
                    return; 
                }
            }
        }

        // 3. --- ROUTING PLUGINS ---
        // Pastikan plugin diload dengan benar di utils.js sebelum dipanggil
        if (typeof fileManager === 'function') await fileManager(sock, msg.key.remoteJid, text, msg.key, messageEvent);
        if (typeof groupFeatures === 'function') await groupFeatures(sock, msg.key.remoteJid, text, msg.key, isGroup);
        
        // 4. --- COMMAND HANDLER UTAMA ---
        await handleCommand(sock, msg.key.remoteJid, text, msg.key, senderNum, messageEvent, false);

    } catch (e) {
        console.error("Error handling message:", e);
    }
}

if (status === "connected") connectToWhatsApp();
else {
    connectToWhatsApp(); 
}
