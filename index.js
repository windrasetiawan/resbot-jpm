import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import * as baileys from "baileys";
import { ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import { addGroupLinks } from "./lib/grupLinkStore.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// Import Plugins secara manual
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";
import menu from "./plugins/menu.js";     

const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = baileys;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Inisialisasi Database Global
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
        version, auth: state, logger: P({ level: "silent" }),
        printQRInTerminal: false, browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

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
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const sender = jidNormalizedUser(isGroup ? msg.key.participant : chatId);
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

        const dbData = global.db.settings;
        if (dbData.mode === 'self' && !isOwner(sender)) return;

        // Auto Join Link
        if (text.includes("chat.whatsapp.com") && dbData.autojoin) {
            const links = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g);
            if (links) links.forEach(l => sock.groupAcceptInvite(l.split('/')[1]).catch(() => {}));
        }

        // Eksekusi Plugins (Manual Sequence)
        try { await ping(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { await groupFeatures(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { await admin(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { await menu(sock, chatId, text, msg.key, msg); } catch(e) {}
    });
    sock.ev.on("creds.update", saveCreds);
}
connectToWhatsApp();
