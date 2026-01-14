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

// HELPERS
import { ChangeStatus, isOwner } from "./lib/utils.js"; 
import { addGroupLinks } from "./lib/grupLinkStore.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// PLUGINS
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DATABASE INIT
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
    
    console.log(clc.cyan(`🤖 RESBOT JPM V4 (Baileys ${version.join('.')})`));

    const sock = makeWASocket({
        version,
        logger: logger, 
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ["Mac OS", "Chrome", "3.0"],
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
            if (reason !== DisconnectReason.loggedOut) {
                console.log(clc.red("⚠️ Koneksi terputus. Mencoba menyambungkan ulang dalam 5 detik..."));
                setTimeout(startBot, 5000); 
            } else {
                console.log(clc.red("❌ Sesi Logged Out. Silakan scan ulang/hapus folder session."));
            }
        } else if (connection === "open") {
            console.log(clc.green("✅ TERHUBUNG!"));
            ChangeStatus(__dirname + "/sessions/", "connected");
            resumeAutoJPM(sock);
            setInterval(() => { runGroupSchedule(sock); }, 60000);
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        await handleMsg(sock, msg);
        // ❌ HAPUS tiktok(...) DARI SINI AGAR TIDAK ERROR
    });
}

async function handleMsg(sock, msg) {
    try {
        // ✅ DISINI TEMPAT chatId & text DIDEFINISIKAN
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const sender = jidNormalizedUser(isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId);
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        let db = {};
        try { db = JSON.parse(fs.readFileSync(settingsPath)); } catch {}

        // Auto Join
        if (db.autojoin && (text.includes("chat.whatsapp.com") || text.includes("wa.me"))) {
            const code = text.match(/(?:chat\.whatsapp\.com\/|wa\.me\/)([0-9A-Za-z]{20,29})/);
            if (code && code[1]) {
                await sock.groupAcceptInvite(code[1]).catch(() => {});
            }
        }

        if (db.mode === 'self' && !isOwner(sender)) return;

        await Promise.all([
            ping(sock, chatId, text, msg.key, msg),
            menu(sock, chatId, text, msg.key, msg),
            admin(sock, chatId, text, msg.key, msg),
            groupFeatures(sock, chatId, text, msg.key, msg),
            hcFeatures(sock, chatId, text, msg.key, msg),
            cekkuota(sock, chatId, text, msg.key, msg),
            jpm(sock, sender, text, msg.key, msg),
            pushkontak(sock, sender, text, msg.key, msg),
            autojpm(sock, chatId, text, msg.key, msg),
            listgc(sock, chatId, text, msg.key, msg),
            tiktok(sock, chatId, text, msg.key, msg),
            owner(sock, chatId, text, msg.key, msg),
            igdl(sock, chatId, text, msg.key, msg) 
        ]);

    } catch (e) {}
}

startBot();
                                                  
