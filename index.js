/*
⚠️ CODE UTAMA RESBOT JPM V3 (FINAL INTEGRATED)
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

// --- LOAD PLUGINS (PASTIKAN SEMUA ADA DISINI) ---
import fileManager from "./plugins/file_manager.js";
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import cekkuota from "./plugins/cekkuota.js"; // <--- PLUGIN BARU

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const status = getStatus(`${__dirname}/sessions/`);

// --- DATABASE SETTINGS ---
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
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: true // Agar JPM Preview muncul
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

async function handleIncomingMessages(sock, msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const sender = msg.key.participant || msg.key.remoteJid;
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        const senderNum = sender.split('@')[0];
        const dbData = getDbSettings();

        // 1. CEK ANTILINK
        if (isGroup && text && /chat.whatsapp.com/i.test(text)) {
            let isAdmin = false;
            try {
                const groupMetadata = await sock.groupMetadata(chatId);
                const participant = groupMetadata.participants.find(p => p.id === sender);
                isAdmin = (participant?.admin === 'admin' || participant?.admin === 'superadmin');
            } catch (e) {}

            const isSpam = await checkAntilink(sock, chatId, text, msg, sender, isAdmin);
            if (isSpam) return; 
        }

        // 2. CEK AUTO JOIN
        if (dbData.autojoin && isOwner(sender) && text.includes("chat.whatsapp.com")) {
            let code = text.split('chat.whatsapp.com/')[1].split(' ')[0];
            await sock.groupAcceptInvite(code)
                .then(() => sock.sendMessage(sender, { text: '✅ Berhasil Join!' }))
                .catch(() => sock.sendMessage(sender, { text: '❌ Gagal Join.' }));
        }

        // 3. AMBIL FILE VIA #
        if (text.startsWith("#") && text.length > 1) {
            const query = text.substring(1).trim();
            const dir = './ADDTIONAL/files'; 
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                let match = files.find(f => f.toLowerCase() === query.toLowerCase());
                if (!match) match = files.find(f => f.toLowerCase() === query.toLowerCase() + '.hc');
                if (!match) match = files.find(f => f.toLowerCase().includes(query.toLowerCase()));
                if (match) {
                    await sock.sendMessage(chatId, { 
                        document: fs.readFileSync(path.join(dir, match)), 
                        mimetype: 'application/octet-stream', 
                        fileName: match,
                        caption: `✅ File Ditemukan: ${match}`
                    }, { quoted: msg });
                    return;
                }
            }
        }

        // --- PANGGIL SEMUA PLUGINS ---
        if (fileManager) await fileManager(sock, chatId, text, msg.key, msg);
        if (groupFeatures) await groupFeatures(sock, chatId, text, msg.key, msg);
        if (admin) await admin(sock, chatId, text, msg.key, msg);
        // [PENTING] Panggil Cek Kuota Disini 👇
        if (cekkuota) await cekkuota(sock, chatId, text, msg.key, msg);

        // Command Handler (Menu, dll)
        await handleCommand(sock, chatId, text, msg.key, senderNum, msg, false);

    } catch (e) { console.error("Msg Error:", e); }
}

if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
