import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";

import makeWASocket, { 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    jidNormalizedUser,
    makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";

import { ChangeStatus, isOwner } from "./lib/utils.js"; 
import { addGroupLinks } from "./lib/grupLinkStore.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// IMPORT PLUGINS
import groupFeatures from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";
import hcFeatures from "./plugins/hc_features.js"; 
import cekkuota from "./plugins/cekkuota.js";      
import menu from "./plugins/menu.js"; 
import jpm from "./plugins/jpm.js"; 
import pushkontak from "./plugins/pushkontak.js";
import autojpm from "./plugins/autojpm.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DATABASE SETUP
const dbFolder = path.join(__dirname, "DATABASE");
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });
const settingsPath = path.join(dbFolder, "settings.json");
if (!fs.existsSync(settingsPath)) fs.writeFileSync(settingsPath, JSON.stringify({ mode: 'public', antilink: [], autojoin: false, owners: [] }));

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => { rl.question(text, (a) => { rl.close(); resolve(a); }); });
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
    
    console.log(clc.cyan(`🤖 RESBOT JPM V4 REMASTERED (Baileys ${version.join('.')})`));

    const sock = makeWASocket({
        version,
        logger: P({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, P({ level: "fatal" })),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: true,
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const num = await question(clc.green("📱 Masukkan Nomor WA (628xxx): "));
            const code = await sock.requestPairingCode(num.replace(/\D/g, ''));
            console.log(clc.bgGreen.black(` KODE PAIRING: `) + " " + clc.bold.white(code?.match(/.{1,4}/g)?.join("-")));
        }, 2000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) startBot();
        } else if (connection === "open") {
            console.log(clc.green("✅ TERHUBUNG!"));
            ChangeStatus(__dirname + "/sessions/", "connected");
            resumeAutoJPM(sock);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        await handleMsg(sock, msg);
    });
}

async function handleMsg(sock, msg) {
    try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const sender = jidNormalizedUser(isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId);
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        const db = JSON.parse(fs.readFileSync(settingsPath));
        if (db.mode === 'self' && !isOwner(sender)) return;

        // --- FITUR AUTO JOIN ---
        if (db.autojoin && text.includes("chat.whatsapp.com")) {
            const code = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/);
            if (code) {
                await sock.groupAcceptInvite(code[1]).catch(() => {});
                addGroupLinks(`https://chat.whatsapp.com/${code[1]}`);
            }
        }

        // --- ROUTER PLUGINS ---
        await Promise.all([
            ping(sock, chatId, text, msg.key, msg),
            menu(sock, chatId, text, msg.key, msg),
            admin(sock, chatId, text, msg.key, msg),
            groupFeatures(sock, chatId, text, msg.key, msg),
            hcFeatures(sock, chatId, text, msg.key, msg),
            cekkuota(sock, chatId, text, msg.key, msg),
            jpm(sock, sender, text, msg.key, msg),
            pushkontak(sock, sender, text, msg.key, msg),
            autojpm(sock, chatId, text, msg.key, msg)
        ]);

    } catch (e) { console.error(e); }
}

startBot();
