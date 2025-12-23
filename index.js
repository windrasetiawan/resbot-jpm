import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";

// LIBRARY BARU
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

// PLUGINS (Load Manual)
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";
import hcFeatures from "./plugins/hc_features.js"; 
import cekkuota from "./plugins/cekkuota.js";      
import menu from "./plugins/menu.js"; 
import jpm from "./plugins/jpm.js"; 
import pushkontak from "./plugins/pushkontak.js";
import autojpm from "./plugins/autojpm.js"; // <--- Plugin Auto JPM Baru

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// AUTO CREATE DATABASE
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
    
    console.log(clc.cyan(`🤖 MEMULAI RESBOT JPM V4 (Baileys ${version.join('.')})`));

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
        console.log(clc.yellow("⚠️ Belum terdaftar. Menunggu input nomor..."));
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
            console.log(clc.red(`❌ Koneksi Terputus: ${reason}. Reconnecting...`));
            if (reason !== DisconnectReason.loggedOut) startBot();
            else console.log(clc.red("⛔ Sesi Logged Out. Hapus folder sessions."));
        } else if (connection === "open") {
            console.log(clc.green("✅ TERHUBUNG KE WHATSAPP!"));
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
        
        // Cek Mode
        const db = JSON.parse(fs.readFileSync(settingsPath));
        if (db.mode === 'self' && !isOwner(sender)) return;

        // Auto Join
        if (text.includes("chat.whatsapp.com") && db.autojoin) {
            const links = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g);
            if (links) links.forEach(l => sock.groupAcceptInvite(l.split('/')[1]).catch(() => {}));
        }

        // --- ROUTER MANUAL (ANTI-BENTROK) ---
        await Promise.all([
            ping(sock, chatId, text, msg.key, msg).catch(e => {}),
            menu(sock, chatId, text, msg.key, msg).catch(e => {}),
            admin(sock, chatId, text, msg.key, msg).catch(e => {}),
            groupFeatures(sock, chatId, text, msg.key, msg).catch(e => {}),
            hcFeatures(sock, chatId, text, msg.key, msg).catch(e => {}),
            cekkuota(sock, chatId, text, msg.key, msg).catch(e => {}),
            jpm(sock, sender, text, msg.key, msg).catch(e => {}),
            pushkontak(sock, sender, text, msg.key, msg).catch(e => {}),
            autojpm(sock, chatId, text, msg.key, msg).catch(e => {}) // <--- Panggil Auto JPM
        ]);

        // Antilink Check
        if (isGroup) {
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                isAdmin = meta.participants.find(p => p.id === sender)?.admin !== null;
            } catch {}
            await checkAntilink(sock, chatId, text, msg, sender, isAdmin);
        }

    } catch (e) { console.error("Handler Error:", e); }
}

startBot();
