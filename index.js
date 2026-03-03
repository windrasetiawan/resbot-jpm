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

// --- IMPORT PLUGIN ---
import groupFeatures, { runGroupSchedule } from "./plugins/group_features.js"; 
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";
import hcFeatures from "./plugins/hc_features.js"; 
import cekkuota from "./plugins/cekkuota.js";      
import menu from "./plugins/menu.js"; 
import jpm from "./plugins/jpm.js"; 
import pushkontak from "./plugins/pushkontak.js";
import autojpm from "./plugins/autojpm.js";
import listgc from "./plugins/listgc.js"; 
import tiktok from "./plugins/tiktok.js";
import owner from "./plugins/owner.js";
import igdl from "./plugins/igdl.js";
import serverMonitor, { startMonitor } from "./plugins/server_monitor.js";
import autoreply from "./plugins/autoreply.js"; 
import autowd, { startAutoWD } from "./plugins/autowd.js"; // <--- HANYA AUTO WD

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbFolder = path.join(__dirname, "DATABASE");
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });
const settingsPath = path.join(dbFolder, "settings.json");

if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({ mode: 'public', antilink: [], autojoin: false, owners: [], schedule: {} }));
}

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => { rl.question(text, (a) => { rl.close(); resolve(a); }); });
};

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
    const logger = P({ level: "silent" });
    
    console.log(clc.cyan(`RESBOT JPM V4 (Baileys ${version.join('.')})`));

    const sock = makeWASocket({
        version,
        logger: logger, 
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: true,
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const num = await question(clc.green("Masukkan Nomor WA (628xxx): "));
            const code = await sock.requestPairingCode(num.replace(/\D/g, ''));
            console.log(clc.bgGreen.black(` KODE PAIRING: `) + " " + clc.bold.white(code?.match(/.{1,4}/g)?.join("-")));
        }, 2000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                console.log(clc.red("Koneksi terputus. Mencoba menyambungkan ulang dalam 5 detik..."));
                setTimeout(startBot, 5000); 
            } else {
                console.log(clc.red("Sesi Logged Out. Silakan scan ulang/hapus folder session."));
            }
        } else if (connection === "open") {
            console.log(clc.green("TERHUBUNG!"));
            
            global.sock = sock; 
            
            ChangeStatus(__dirname + "/sessions/", "connected");
            resumeAutoJPM(sock);
            
            setInterval(() => { runGroupSchedule(sock); }, 60000);
            startMonitor(sock);
            
            // --- JALANKAN MONITOR AUTO WD ---
            startAutoWD(sock); 
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return; // Fix Owner bisa pakai bot
        await handleMsg(sock, msg);
    });
}

async function handleMsg(sock, msg) {
    try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const sender = jidNormalizedUser(isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId);
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        let db = {};
        try { db = JSON.parse(fs.readFileSync(settingsPath)); } catch {}

        // --- FITUR AUTO JOIN (UNIVERSAL) ---
        if (db.autojoin && (text.includes("chat.whatsapp.com/") || text.includes("wa.me/"))) {
            const codeMatch = text.match(/(?:chat\.whatsapp\.com\/|wa\.me\/)([0-9A-Za-z]{20,29})/);
            if (codeMatch && codeMatch[1] && !msg.key.fromMe) {
                const inviteCode = codeMatch[1];
                try {
                    const groupInfo = await sock.groupGetInviteInfo(inviteCode);
                    console.log(clc.green(`✅ Auto Join: ${groupInfo?.subject || "Grup Baru"}`));
                    await sock.groupAcceptInvite(inviteCode);
                } catch (e) {}
            }
        }

        // Plugin Grup
        await groupFeatures(sock, chatId, text, msg.key, msg);

        // Autoreply
        await autoreply(sock, chatId, text, msg.key, msg); 

        // Filter Mode Self
        if (db.mode === 'self' && !isOwner(sender)) return;

        // --- PEMANGGILAN PLUGIN ---
        await Promise.all([
            ping(sock, chatId, text, msg.key, msg),
            menu(sock, chatId, text, msg.key, msg),
            admin(sock, chatId, text, msg.key, msg),
            hcFeatures(sock, chatId, text, msg.key, msg),
            cekkuota(sock, chatId, text, msg.key, msg),
            jpm(sock, sender, text, msg.key, msg),
            pushkontak(sock, sender, text, msg.key, msg),
            autojpm(sock, chatId, text, msg.key, msg),
            listgc(sock, chatId, text, msg.key, msg),
            tiktok(sock, chatId, text, msg.key, msg),
            owner(sock, chatId, text, msg.key, msg),
            igdl(sock, chatId, text, msg.key, msg),
            serverMonitor(sock, chatId, text, msg.key, msg),
            autowd(sock, chatId, text, msg.key, msg) // <--- Command .autowd
        ]);

    } catch (e) {
        console.error("Error handleMsg:", e);
    }
}

startBot();
