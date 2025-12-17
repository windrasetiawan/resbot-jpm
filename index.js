/*
⚠️ CODE UTAMA RESBOT JPM V3 (PAIRING ONLY)
*/
console.log('Start App ..');

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";

// IMPORT BAILEYS
import * as baileys from "baileys";
const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = baileys;

import { handleCommand, ChangeStatus, getStatus } from "./lib/utils.js";
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Load Plugins
import fileManager from "./plugins/file_manager.js";
import groupFeatures from "./plugins/group_features.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const status = getStatus(`${__dirname}/sessions/`);

const antiLinkData = {}; 

// Fungsi Input Console
const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
   
    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false, // Matikan QR
        browser: ["Ubuntu", "Chrome", "20.0.04"] // Browser info agar pairing work
    });

    // --- LOGIKA PAIRING CODE ---
    if (!sock.authState.creds.registered) {
        console.log(clc.cyan.bold("\n🤖 Mode Pairing Code Aktif!"));
        console.log(clc.white("Silakan tunggu sebentar...\n"));
        
        // Delay sedikit agar socket siap
        setTimeout(async () => {
            const phoneNumber = await question(clc.yellow("Masukkan Nomor WhatsApp Anda (contoh: 628123456xxx): "));
            if (phoneNumber) {
                try {
                    // Request Code
                    const code = await sock.requestPairingCode(phoneNumber.trim());
                    console.log(clc.green.bold("\n=============================="));
                    console.log(clc.green.bold("🔗 KODE PAIRING ANDA:"));
                    console.log(clc.white.bold(code?.match(/.{1,4}/g)?.join("-") || code));
                    console.log(clc.green.bold("==============================\n"));
                    console.log(clc.cyan("Silakan masukkan kode di atas ke WhatsApp > Perangkat Tertaut > Tautkan Perangkat > Masuk dengan Nomor Telepon."));
                } catch (e) {
                    console.error(clc.red("Gagal request pairing code. Pastikan nomor benar."), e);
                }
            }
        }, 3000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(clc.red("Koneksi terputus, mencoba menghubungkan ulang..."));
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
