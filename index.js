import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";
import * as baileys from "baileys";

// IMPORT PLUGINS & HELPERS
import { ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import { addGroupLinks } from "./lib/grupLinkStore.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// DAFTAR PLUGIN (Dipanggil Manual agar Stabil & Anti-Bentrok)
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";
import hc_features from "./plugins/hc_features.js"; 
import cekkuota from "./plugins/cekkuota.js";      
import menu from "./plugins/menu.js";     

const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = baileys;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DATABASE SETTINGS
const pathSettings = './DATABASE/settings.json';
global.db = { settings: {} };

if (!fs.existsSync(pathSettings)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE', { recursive: true }); 
    global.db.settings = { mode: 'public', antilink: [], autojoin: false, owners: [] };
    fs.writeFileSync(pathSettings, JSON.stringify(global.db.settings, null, 2));
} else {
    try { global.db.settings = JSON.parse(fs.readFileSync(pathSettings)); } 
    catch { global.db.settings = { mode: 'public', antilink: [], autojoin: false, owners: [] }; }
}

global.saveSettings = () => fs.writeFileSync(pathSettings, JSON.stringify(global.db.settings, null, 2));

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
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const phoneNumber = await new Promise(resolve => rl.question(clc.yellow("Masukkan Nomor WA (628xxx): "), resolve));
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
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        await handleIncomingMessages(sock, msg);
    });
    sock.ev.on("creds.update", saveCreds);
}

async function handleIncomingMessages(sock, msg) {
    try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const sender = jidNormalizedUser(isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId);
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        const dbData = global.db.settings;
        if (dbData.mode === 'self' && !isOwner(sender)) return;

        // AUTO JOIN LINK GRUP
        if (text.includes("chat.whatsapp.com") && dbData.autojoin) {
            const links = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g);
            if (links) {
                for (let link of links) {
                    addGroupLinks(link);
                    sock.groupAcceptInvite(link.split('/')[1]).catch(() => {});
                }
            }
        }

        if (isGroup) {
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                isAdmin = meta.participants.find(p => p.id === sender)?.admin !== null;
            } catch {}
            if (await checkAntilink(sock, chatId, text, msg, sender, isAdmin)) return;
        }

        // EKSEKUSI PLUGINS (Manual Sequence - Anti Double Reply)
        try { await ping(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { await groupFeatures(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { await admin(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { await hc_features(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { await cekkuota(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { await menu(sock, chatId, text, msg.key, msg); } catch(e) {}

    } catch (e) { console.error("Msg Error:", e); }
}

connectToWhatsApp();
