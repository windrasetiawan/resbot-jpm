/*
⚠️ CODE UTAMA RESBOT JPM V3 (FIXED GROUP ARGS)
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

// Import Helper
import { handleCommand, ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Load Plugins
import fileManager from "./plugins/file_manager.js";
import groupFeatures from "./plugins/group_features.js";
import hcFeatures from "./plugins/hc_features.js"; 
import admin from "./plugins/admin.js"; // Pastikan admin.js ada (opsional)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const status = getStatus(`${__dirname}/sessions/`);

// --- DATABASE SETTINGS (INIT) ---
const pathSettings = './DATABASE/settings.json';
if (!fs.existsSync(pathSettings)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE'); 
    fs.writeFileSync(pathSettings, JSON.stringify({ 
        mode: 'self', 
        antilink: [], 
        autojoin: false 
    }, null, 2));
}
const getDbSettings = () => JSON.parse(fs.readFileSync(pathSettings));

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
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        console.log(clc.cyan.bold("\n🤖 Mode Pairing Code Aktif!"));
        setTimeout(async () => {
            const phoneNumber = await question(clc.yellow("Masukkan Nomor WhatsApp (contoh: 628123456xxx): "));
            if (phoneNumber) {
                try {
                    const code = await sock.requestPairingCode(phoneNumber.trim());
                    console.log(clc.green.bold(`🔗 KODE PAIRING: ${code?.match(/.{1,4}/g)?.join("-") || code}`));
                } catch (e) {
                    console.error(clc.red("Gagal request pairing code."), e);
                }
            }
        }, 3000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(clc.red("Reconnect..."));
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
        const msg = m.messages[0]; 
        await handleIncomingMessages(sock, msg);
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

// FUNGSI UTAMA HANDLER
async function handleIncomingMessages(sock, msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;

        const isGroup = msg.key.remoteJid.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        const senderNum = sender.split('@')[0];
        const dbData = getDbSettings();

        // 1. CEK ANTILINK
        if (isGroup && dbData.antilink.includes(msg.key.remoteJid)) {
            if (text.includes("chat.whatsapp.com")) {
                const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
                const participants = groupMetadata.participants;
                const isAdmin = participants.find(p => p.id === sender)?.admin;
                
                if (!isAdmin && !isOwner(sender)) { 
                    await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
                    await sock.groupParticipantsUpdate(msg.key.remoteJid, [sender], 'remove');
                }
            }
        }

        // 2. CEK AUTO JOIN
        if (dbData.autojoin && isOwner(sender) && text.includes("chat.whatsapp.com")) {
            let code = text.split('chat.whatsapp.com/')[1].split(' ')[0];
            await sock.groupAcceptInvite(code)
                .then(() => sock.sendMessage(sender, { text: '✅ Berhasil Join!' }))
                .catch(() => sock.sendMessage(sender, { text: '❌ Gagal Join.' }));
        }

        // --- PLUGINS ---
        // PENTING: Semua plugin sekarang menerima 5 argumen: (sock, chatId, text, key, msg)
        if (fileManager) await fileManager(sock, msg.key.remoteJid, text, msg.key, msg);
        
        // [FIXED] Panggil groupFeatures dengan 'msg' sebagai argumen ke-5
        if (groupFeatures) await groupFeatures(sock, msg.key.remoteJid, text, msg.key, msg);
        
        if (hcFeatures) await hcFeatures(sock, msg.key.remoteJid, text, msg.key, msg);
        if (admin) await admin(sock, msg.key.remoteJid, text, msg.key, msg); // Opsional

        // Command Handler
        await handleCommand(sock, msg.key.remoteJid, text, msg.key, senderNum, msg, false);

    } catch (e) { console.error("Msg Error:", e); }
}

if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
