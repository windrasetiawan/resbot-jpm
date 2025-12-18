import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";
import * as baileys from "baileys";

// --- IMPORT LIB & PLUGINS ---
import { ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import { addGroupLinks } from "./lib/grupLinkStore.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// DAFTAR PLUGIN
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

// ==============================================
//  DATABASE SYSTEM
// ==============================================
const pathSettings = './DATABASE/settings.json';
global.db = { settings: {} };

// Load Database
if (!fs.existsSync(pathSettings)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE', { recursive: true }); 
    global.db.settings = { mode: 'public', antilink: [], autojoin: false, owners: [] };
    fs.writeFileSync(pathSettings, JSON.stringify(global.db.settings, null, 2));
} else {
    try { global.db.settings = JSON.parse(fs.readFileSync(pathSettings)); } catch { global.db.settings = { mode: 'public', antilink: [], autojoin: false, owners: [] }; }
}

global.saveSettings = () => fs.writeFileSync(pathSettings, JSON.stringify(global.db.settings, null, 2));

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => { rl.question(text, (answer) => { rl.close(); resolve(answer); }); });
};

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
    
    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: true,
        syncFullHistory: false, 
        markOnlineOnConnect: false 
    });

    if (!sock.authState.creds.registered) {
        console.log(clc.cyan.bold("\n🤖 Mode Pairing Code Aktif!"));
        setTimeout(async () => {
            const phoneNumber = await question(clc.yellow("Masukkan Nomor WhatsApp (contoh: 628123456xxx): "));
            if (phoneNumber) {
                try {
                    const code = await sock.requestPairingCode(phoneNumber.trim());
                    console.log(clc.green.bold(`🔗 KODE PAIRING: ${code?.match(/.{1,4}/g)?.join("-") || code}`));
                } catch (e) { console.error(clc.red("Gagal request pairing code."), e); }
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
            startGroupScheduler(sock); // [PENTING] Jalankan Scheduler
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages[0]) return;
        const msg = m.messages[0]; 
        await handleIncomingMessages(sock, msg);
    });
     
    sock.ev.on("creds.update", saveCreds);
}

// [FITUR TAMBAHAN] SCHEDULER OPEN/CLOSE GRUP
let lastCheckMinute = "";
function startGroupScheduler(sock) {
    const schedulePath = './DATABASE/group_schedule.json';
    
    // Cek setiap 10 detik
    setInterval(async () => {
        const now = new Date();
        // Format jam HH:MM
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Cek agar tidak spam (Hanya jalan sekali per menit saat menit berubah)
        if (currentTime === lastCheckMinute) return;
        lastCheckMinute = currentTime;

        if (!fs.existsSync(schedulePath)) return;
        
        try {
            const db = JSON.parse(fs.readFileSync(schedulePath));
            for (const [chatId, schedule] of Object.entries(db)) {
                // Cek Jadwal Buka
                if (schedule.open === currentTime) {
                    await sock.groupSettingUpdate(chatId, 'not_announcement');
                    await sock.sendMessage(chatId, { text: "🔓 *Waktunya Grup Dibuka!*" });
                }
                // Cek Jadwal Tutup
                if (schedule.close === currentTime) {
                    await sock.groupSettingUpdate(chatId, 'announcement');
                    await sock.sendMessage(chatId, { text: "🔒 *Waktunya Grup Ditutup!*" });
                }
            }
        } catch (e) {
            console.error("Error Scheduler:", e);
        }
    }, 10000); 
}

async function handleIncomingMessages(sock, msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        let sender = isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId;
        sender = jidNormalizedUser(sender);
        const senderNum = sender.split('@')[0];
        
        const text = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || 
                     msg.message?.imageMessage?.caption || 
                     msg.message?.videoMessage?.caption || "";

        if (text && text.length < 100) console.log(clc.cyan(`📩 [Pesan] ${senderNum}: ${text}`));

        const dbData = global.db.settings;
        const owners = dbData.owners || [];
        const isCreator = isOwner(sender) || owners.includes(senderNum);

        if (dbData.mode === 'self' && !isCreator) return;

        // --- 1. FITUR AUTO JOIN ---
        if (text.includes("chat.whatsapp.com")) {
            const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g;
            const links = text.match(linkRegex);
            if (links && links.length > 0) {
                for (let link of links) {
                    addGroupLinks(link); 
                    if (dbData.autojoin) { 
                        try {
                            const code = link.split('chat.whatsapp.com/')[1];
                            sock.groupAcceptInvite(code)
                                .then(() => console.log(clc.green(`✅ Auto Join: ${code}`)))
                                .catch(() => {});
                        } catch (e) {}
                    }
                }
            }
        }

        // --- 2. ANTILINK GRUP ---
        if (isGroup) {
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                const p = meta.participants.find(x => x.id === sender);
                isAdmin = (p?.admin === 'admin' || p?.admin === 'superadmin');
            } catch {}
            if (await checkAntilink(sock, chatId, text, msg, sender, isAdmin)) return;
        }

        // --- 3. EKSEKUSI PLUGINS ---
        try { if (ping) await ping(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { if (groupFeatures) await groupFeatures(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { if (admin) await admin(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { if (hcFeatures) await hcFeatures(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { if (cekkuota) await cekkuota(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { if (tiktok) await tiktok(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { if (instagram) await instagram(sock, chatId, text, msg.key, msg); } catch(e) {}
        try { if (menu) await menu(sock, chatId, text, msg.key, msg); } catch(e) {}

        // --- 4. COMMAND BAWAAN ---
        if (text === '.self' && isCreator) {
            dbData.mode = 'self'; global.saveSettings();
            return sock.sendMessage(chatId, { text: '🔒 *Mode SELF Aktif*' }, { quoted: msg });
        }
        if (text === '.public' && isCreator) {
            dbData.mode = 'public'; global.saveSettings();
            return sock.sendMessage(chatId, { text: '🔓 *Mode PUBLIC Aktif*' }, { quoted: msg });
        }
        if (text.startsWith('.addowner') && isCreator) {
            const target = text.split(' ')[1]?.replace(/[^0-9]/g, '');
            if (!target) return sock.sendMessage(chatId, { text: '⚠️ Format: .addowner 628xxx' }, { quoted: msg });
            if (!dbData.owners) dbData.owners = [];
            dbData.owners.push(target); global.saveSettings();
            return sock.sendMessage(chatId, { text: `✅ Owner ditambah: ${target}` }, { quoted: msg });
        }

    } catch (e) { console.error("Msg Error:", e); }
}

const status = getStatus(`${__dirname}/sessions/`);
if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
