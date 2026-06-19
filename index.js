import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser, makeCacheableSignalKeyStore } from "@whiskeysockets/baileys";
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
import testi from "./plugins/testi.js";

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

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
    const logger = P({ level: "silent" });
    
    console.log(clc.cyan(`RESBOT JPM V4 (Baileys ${version.join('.')})`));

    const sock = makeWASocket({
        version,
        logger: logger, 
        printQRInTerminal: false,
        markOnlineOnConnect: false,
        generateHighQualityLinkPreview: true,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ["Mac OS", "Safari", "14.0.3"],
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
                setTimeout(startBot, 3000); 
            } else {
                console.log(clc.red("Sesi Logged Out! Silakan hapus folder 'sessions'."));
            }
        } else if (connection === "open") {
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
        if (msg.messageTimestamp && (Date.now() / 1000 - msg.messageTimestamp > 60)) return;
        await handleMsg(sock, msg);
    });
}

async function handleMsg(sock, msg) {
    try {
        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        const sender = jidNormalizedUser(msg.key.participant || msg.key.remoteJid);
        
        if (sender === 'status@broadcast' || sender.includes('g.us')) return;

        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        if (!text) return;

        let db = {};
        try { db = JSON.parse(fs.readFileSync(settingsPath)); } catch {}

        // --- BAGIAN AUTOJOIN YANG DIPERBAIKI (DIPINDAH KE ATAS) ---
        if (db.autojoin && (text.includes("chat.whatsapp.com/") || text.includes("wa.me/"))) {
            const codeMatch = text.match(/(?:chat\.whatsapp\.com\/(?:invite\/)?|wa\.me\/(?:invite\/)?)([a-zA-Z0-9_-]{15,30})/);
            if (codeMatch && codeMatch[1] && !msg.key.fromMe) {
                const inviteCode = codeMatch[1];
                try {
                    await sleep(2000);
                    // Coba join grup secara langsung
                    await sock.groupAcceptInvite(inviteCode);
                    await sock.sendMessage(chatId, { text: "✅ *Auto Join:* Berhasil masuk ke dalam grup!" }, { quoted: msg });
                } catch (e) {
                    // Jika grup membutuhkan persetujuan admin (request to join)
                    try {
                        if (sock.groupRequestParticipate) {
                            await sock.groupRequestParticipate(inviteCode);
                            await sock.sendMessage(chatId, { text: "⏳ *Auto Join:* Permintaan bergabung telah dikirim ke Admin grup." }, { quoted: msg });
                        }
                    } catch (err) {
                        await sock.sendMessage(chatId, { text: "❌ *Auto Join Gagal:* Link tidak valid atau bot sudah ada di grup tersebut." }, { quoted: msg });
                    }
                }
            }
        }
        // --- AKHIR BAGIAN AUTOJOIN YANG DIPERBAIKI ---

        // FILTER MODE SELF (Sekarang berada di bawah Autojoin)
        const isBotOwner = isOwner(sender) || msg.key.fromMe;
        if (db.mode === 'self' && !isBotOwner) return;

        if (text.startsWith(".")) {
            await sock.readMessages([msg.key]);
            await sleep(500 + Math.random() * 1000);
        }

        await groupFeatures(sock, chatId, text, msg.key, msg);
        await autoreply(sock, chatId, text, msg.key, msg); 

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
            autowd(sock, chatId, text, msg.key, msg),
            testi(sock, chatId, text, msg.key, msg)
        ]);

    } catch (e) {}
}

startBot();
