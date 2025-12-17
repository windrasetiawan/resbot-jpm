/*
⚠️ CODE UTAMA RESBOT JPM V3 (FIXED QR & PLUGINS)
*/
console.log('Start App ..');

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";

// IMPORT BAILEYS
import * as baileys from "baileys";
const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

import { handleCommand, ChangeStatus, getStatus } from "./lib/utils.js";
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Load Plugins Manual (Untuk memastikan urutan)
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
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
             console.log(clc.yellow("Scan QR Code dibawah ini:"));
             // FIX ERROR m.generate is not a function: Gunakan m.default.generate
             import('qrcode-terminal').then(m => {
                 const generate = m.default?.generate || m.generate;
                 if (generate) generate(qr, { small: true });
                 else console.log("QR Code:", qr);
             }).catch(e => console.log("Gagal load qrcode-terminal", e));
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
        
        // Anti-Link
        if (isGroup && (text.includes("chat.whatsapp.com") || text.includes("http"))) {
            const key = `${msg.key.remoteJid}-${sender}`;
            antiLinkData[key] = (antiLinkData[key] || 0) + 1;
            if (antiLinkData[key] > 2) await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
        }

        // Fitur File Fuzzy
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

        // Plugins
        if (fileManager) await fileManager(sock, msg.key.remoteJid, text, msg.key, messageEvent);
        if (groupFeatures) await groupFeatures(sock, msg.key.remoteJid, text, msg.key, isGroup);
        
        // Command Handler
        const senderNum = sender.split('@')[0];
        await handleCommand(sock, msg.key.remoteJid, text, msg.key, senderNum, messageEvent, false);

    } catch (e) { console.error("Msg Error:", e); }
}

if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
