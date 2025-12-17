/*
⚠️ CODE UTAMA RESBOT JPM V3 (UPDATED)
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

import { handleCommand, ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; // Pastikan isOwner ada di utils atau sesuaikan
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Load Plugins
import fileManager from "./plugins/file_manager.js";
import groupFeatures from "./plugins/group_features.js";
import hcFeatures from "./plugins/hc_features.js"; // PLUGIN BARU (Buat file ini nanti)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const status = getStatus(`${__dirname}/sessions/`);

// --- DATABASE SETTINGS (ANTILINK & AUTOJOIN) ---
const pathSettings = './DATABASE/settings.json';
if (!fs.existsSync(pathSettings)) {
    // Buat folder DATABASE jika belum ada
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE'); 
    fs.writeFileSync(pathSettings, JSON.stringify({ antilink: [], autojoin: false }, null, 2));
}
const getDbSettings = () => JSON.parse(fs.readFileSync(pathSettings));

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
        // Ambil isi pesan (text)
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        // --- LOGIKA UTAMA (Updated) ---
        const dbData = getDbSettings();
        const senderNum = sender.split('@')[0];

        // 1. CEK ANTILINK (Jika ON di Database)
        if (isGroup && dbData.antilink.includes(msg.key.remoteJid)) {
            if (text.includes("chat.whatsapp.com")) {
                // Cek Admin (Kita butuh fungsi cek admin, tapi untuk simpel kita skip check admin jika belum ada fungsinya)
                // Anggap bot akan kick siapa saja kecuali Owner untuk saat ini, atau tambahkan logika isAdmin nanti
                const groupMetadata = await sock.groupMetadata(msg.key.remoteJid);
                const participants = groupMetadata.participants;
                const isAdmin = participants.find(p => p.id === sender)?.admin;
                
                if (!isAdmin) { 
                    await sock.sendMessage(msg.key.remoteJid, { delete: msg.key });
                    await sock.groupParticipantsUpdate(msg.key.remoteJid, [sender], 'remove');
                }
            }
        }

        // 2. CEK AUTO JOIN (Global ON/OFF)
        // Jika fitur ON, Owner kirim link -> Bot masuk
        // Pastikan Anda sudah mengatur nomor owner di config atau utils
        const CONFIG_OWNER = ["628xxx"]; // Ganti atau ambil dari config
        const isOwnerSender = CONFIG_OWNER.includes(senderNum);

        if (dbData.autojoin && isOwnerSender && text.includes("chat.whatsapp.com")) {
            let code = text.split('chat.whatsapp.com/')[1].split(' ')[0];
            await sock.groupAcceptInvite(code)
                .then(() => sock.sendMessage(sender, { text: '✅ Berhasil Join!' }))
                .catch(() => sock.sendMessage(sender, { text: '❌ Gagal Join.' }));
        }

        // --- PLUGINS ---
        if (fileManager) await fileManager(sock, msg.key.remoteJid, text, msg.key, messageEvent);
        if (groupFeatures) await groupFeatures(sock, msg.key.remoteJid, text, msg.key, isGroup, sender);
        // Plugin HC Baru
        if (hcFeatures) await hcFeatures(sock, msg.key.remoteJid, text, msg.key, messageEvent);

        // Command Handler Standard
        await handleCommand(sock, msg.key.remoteJid, text, msg.key, senderNum, messageEvent, false);

    } catch (e) { console.error("Msg Error:", e); }
}

if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
