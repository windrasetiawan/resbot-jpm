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
import autowd, { startAutoWD } from "./plugins/autowd.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbFolder = path.join(__dirname, "DATABASE");
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });
const settingsPath = path.join(dbFolder, "settings.json");

// Default DB jika belum ada
if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({ mode: 'public', antilink: [], autojoin: false, owners: [], schedule: {} }));
}

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => { rl.question(text, (a) => { rl.close(); resolve(a); }); });
};

// FITUR ANTI BANNED: Delay buatan agar bot terlihat seperti manusia mengetik
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
    const logger = P({ level: "silent" }); // Matikan log bawaan baileys yang berisik
    
    console.log(clc.cyan(`RESBOT JPM V4 (Baileys ${version.join('.')}) - 🛡️ ANTI BANNED MODE`));

    // FITUR ANTI BANNED: Konfigurasi Socket disamarkan
    const sock = makeWASocket({
        version,
        logger: logger, 
        printQRInTerminal: false,
        markOnlineOnConnect: false, // ANTI-BAN: Jangan terlihat online terus-menerus
        generateHighQualityLinkPreview: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ["Mac OS", "Safari", "14.0.3"], // ANTI-BAN: Samarkan sebagai browser Mac biasa
        getMessage: async (key) => {
            return { conversation: 'Resbot JPM' };
        }
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
                console.log(clc.yellow("Koneksi terputus (Mungkin sinyal/WA putus). Menyambungkan ulang..."));
                setTimeout(startBot, 3000); 
            } else {
                console.log(clc.red("Sesi Logged Out! Silakan hapus folder 'sessions' dan scan ulang."));
            }
        } else if (connection === "open") {
            console.log(clc.green("TERHUBUNG! Sistem Aman."));
            
            global.sock = sock; 
            
            ChangeStatus(__dirname + "/sessions/", "connected");
            resumeAutoJPM(sock);
            
            setInterval(() => { runGroupSchedule(sock); }, 60000);
            startMonitor(sock);
            startAutoWD(sock); 
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        
        // ANTI-BAN: Abaikan pesan lama yang tertunda / spam beruntun
        if (msg.messageTimestamp && (Date.now() / 1000 - msg.messageTimestamp > 60)) return;

        await handleMsg(sock, msg);
    });
}

async function handleMsg(sock, msg) {
    try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        
        // FIX: Pembacaan Pengirim di Grup yang lebih akurat
        const sender = jidNormalizedUser(msg.key.participant || msg.key.remoteJid);
        
        // Jika dari sistem WA (seperti update nama grup), abaikan.
        if (sender === 'status@broadcast' || sender.includes('g.us')) return;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        if (!text) return; // Jika bukan teks (misal sticker/audio), abaikan.

        let db = {};
        try { db = JSON.parse(fs.readFileSync(settingsPath)); } catch {}

        // --- CEK MODE BOT (PUBLIC / SELF) ---
        const isBotOwner = isOwner(sender) || msg.key.fromMe;
        
        // Jika mode self, dan yang ngechat BUKAN owner, langsung HENTIKAN proses.
        if (db.mode === 'self' && !isBotOwner) return;

        // --- FITUR AUTO JOIN (SUPPORT REQUEST) ---
        if (db.autojoin && (text.includes("chat.whatsapp.com/") || text.includes("wa.me/"))) {
            const codeMatch = text.match(/(?:chat\.whatsapp\.com\/|wa\.me\/)([0-9A-Za-z]{20,29})/);
            if (codeMatch && codeMatch[1] && !msg.key.fromMe) {
                const inviteCode = codeMatch[1];
                try {
                    const groupInfo = await sock.groupGetInviteInfo(inviteCode);
                    console.log(clc.green(`✅ Auto Join/Request: ${groupInfo?.subject || "Grup"}`));
                    await sleep(2000); // ANTI-BAN: Jeda sebelum klik join
                    await sock.groupAcceptInvite(inviteCode);
                } catch (e) {}
            }
        }

        // FITUR ANTI-BANNED: Tambahkan jeda waktu baca sebelum memproses perintah
        if (text.startsWith(".")) {
            await sock.readMessages([msg.key]); // Centang biru dulu
            await sleep(500 + Math.random() * 1000); // Jeda acak 0.5 - 1.5 detik seolah manusia baca
        }

        // --- PROSES PLUGIN GRUP (Antilink, AutoReply, dll) ---
        await groupFeatures(sock, chatId, text, msg.key, msg);
        await autoreply(sock, chatId, text, msg.key, msg); 

        // --- PEMANGGILAN PLUGIN PERINTAH UTAMA ---
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
            autowd(sock, chatId, text, msg.key, msg) 
        ]);

    } catch (e) {
        console.log(clc.red("Error Handle: " + e.message));
    }
}

startBot();
