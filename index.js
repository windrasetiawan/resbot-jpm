import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";
import * as baileys from "baileys";

import { ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import { addGroupLinks } from "./lib/grupLinkStore.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";
import hcFeatures from "./plugins/hc_features.js"; 
import cekkuota from "./plugins/cekkuota.js";      
import tiktok from "./plugins/tiktok.js"; 
import instagram from "./plugins/instagram.js"; 
import menu from "./plugins/menu.js";     

const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = baileys;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pathSettings = './DATABASE/settings.json';
global.db = { settings: {} };

if (!fs.existsSync(pathSettings)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE', { recursive: true }); 
    global.db.settings = { mode: 'public', antilink: [], autojoin: false, owners: [] };
    fs.writeFileSync(pathSettings, JSON.stringify(global.db.settings, null, 2));
} else {
    try { global.db.settings = JSON.parse(fs.readFileSync(pathSettings)); } catch { global.db.settings = { mode: 'public', antilink: [], autojoin: false, owners: [] }; }
}
global.saveSettings = () => fs.writeFileSync(pathSettings, JSON.stringify(global.db.settings, null, 2));

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({
        version, auth: state, logger: P({ level: "silent" }),
        printQRInTerminal: false, browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const phoneNumber = await new Promise(resolve => rl.question(clc.yellow("Nomor WA (628xxx): "), resolve));
        rl.close();
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(clc.green.bold(`🔗 KODE PAIRING: ${code}`));
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) connectToWhatsApp();
        } else if (connection === "open") {
            console.log(clc.green("✅ Terhubung!"));
            ChangeStatus(`${__dirname}/sessions/`, "connected");
            resumeAutoJPM(sock);
            startGroupScheduler(sock);
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        await handleIncomingMessages(sock, msg);
    });
    sock.ev.on("creds.update", saveCreds);
}

function startGroupScheduler(sock) {
    setInterval(async () => {
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const schedulePath = './DATABASE/group_schedule.json';
        if (!fs.existsSync(schedulePath)) return;
        try {
            const db = JSON.parse(fs.readFileSync(schedulePath));
            for (const [chatId, s] of Object.entries(db)) {
                if (s.open === currentTime) await sock.groupSettingUpdate(chatId, 'not_announcement');
                if (s.close === currentTime) await sock.groupSettingUpdate(chatId, 'announcement');
            }
        } catch (e) {}
    }, 30000);
}

async function handleIncomingMessages(sock, msg) {
    const chatId = msg.key.remoteJid;
    const isGroup = chatId.endsWith('@g.us');
    const sender = jidNormalizedUser(isGroup ? msg.key.participant : chatId);
    const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";

    const dbData = global.db.settings;
    if (dbData.mode === 'self' && !isOwner(sender)) return;

    if (text.includes("chat.whatsapp.com")) {
        const links = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g);
        if (links && dbData.autojoin) links.forEach(l => sock.groupAcceptInvite(l.split('/')[1]).catch(() => {}));
    }

    if (isGroup) {
        let isAdmin = false;
        try {
            const meta = await sock.groupMetadata(chatId);
            isAdmin = meta.participants.find(p => p.id === sender)?.admin !== null;
        } catch {}
        if (await checkAntilink(sock, chatId, text, msg, sender, isAdmin)) return;
    }

    // Eksekusi Plugins
    try { await ping(sock, chatId, text, msg.key, msg); } catch(e) {}
    try { await groupFeatures(sock, chatId, text, msg.key, msg); } catch(e) {}
    try { await admin(sock, chatId, text, msg.key, msg); } catch(e) {}
    try { await tiktok(sock, chatId, text, msg.key, msg); } catch(e) {}
    try { await instagram(sock, chatId, text, msg.key, msg); } catch(e) {}
    try { await menu(sock, chatId, text, msg.key, msg); } catch(e) {}
}

connectToWhatsApp();
