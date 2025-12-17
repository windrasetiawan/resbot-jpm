/*
⚠️ CODE UTAMA RESBOT JPM V3
*/
console.log('Start App ..');

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";

// IMPORT BAILEYS SAFE MODE
import * as baileys from "baileys";
const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

import { handleCommand, ChangeStatus, getStatus } from "./lib/utils.js";
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Import Plugin Fitur Baru
import fileManager from "./plugins/file_manager.js";
import groupFeatures from "./plugins/group_features.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const status = getStatus(`${__dirname}/sessions/`);

const antiLinkData = {}; 

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
   
    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        // Hapus printQRInTerminal karena deprecated, kita handle di bawah
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
             console.log(clc.yellow("Scan QR Code dibawah ini:"));
             import('qrcode-terminal').then(m => m.generate(qr, { small: true }));
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log(clc.green("✅ Terhubung!"));
            ChangeStatus(`${__dirname}/sessions/`, "connected");
            resumeAutoJPM(sock);
            startScheduler(sock);
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages[0]) return;
        await handleIncomingMessages(sock, m);
    });
    
    sock.ev.on("creds.update", saveCreds);
}

function startScheduler(sock) {
    setInterval(() => {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2,0)}:${String(now.getMinutes()).padStart(2,0)}`;
        const dbPath = './DATABASE/group_schedule.json';
        if (!fs.existsSync(dbPath)) return;
        
        try {
            const db = JSON.parse(fs.readFileSync(dbPath));
            Object.entries(db).forEach(async ([id, t]) => {
                if (t.open === time) {
                    await sock.groupSettingUpdate(id, "not_announcement");
                    await sock.sendMessage(id, { text: "⏰ Grup dibuka otomatis." });
                }
                if (t.close === time) {
                    await sock.groupSettingUpdate(id, "announcement");
                    await sock.sendMessage(id, { text: "⏰ Grup ditutup otomatis." });
                }
            });
        } catch {}
    }, 60000);
}

async function handleIncomingMessages(sock, messageEvent) {
    try {
        const msg = messageEvent.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        // 1. Anti-Link
        if (isGroup && (text.includes("chat.whatsapp.com") || text.includes("http"))) {
            const key = `${msg.key.remoteJid}-${sender}`;
            antiLinkData[key] = (antiLinkData[key] || 0) + 1;
            if (antiLinkData[key] > 2) await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        }

        // 2. Fitur File Fuzzy (#nama)
        if (text.startsWith("#") && text.length > 2) {
            const query = text.substring(1).trim().toLowerCase();
            const dir = './ADDTIONAL/files';
            if (fs.existsSync(dir)) {
                const match = fs.readdirSync(dir).find(f => f.toLowerCase().includes(query));
                if (match) {
                    await sock.sendMessage(msg.key.remoteJid, { 
                        document: fs.readFileSync(path.join(dir, match)), 
                        mimetype: 'application/octet-stream', fileName: match
                    }, { quoted: msg });
                    return;
                }
            }
        }

        // 3. Plugins Baru
        await fileManager(sock, msg.key.remoteJid, text, msg.key, messageEvent);
        await groupFeatures(sock, msg.key.remoteJid, text, msg.key, isGroup);
        
        // 4. Command Handler Lama (dari utils)
        const senderNum = sender.split('@')[0];
        await handleCommand(sock, msg.key.remoteJid, text, msg.key, senderNum, messageEvent, false);

    } catch (e) { console.error("Msg Error:", e); }
}

if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
