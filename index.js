/*
⚠️ CODE UTAMA RESBOT JPM V3
*/
console.log('Start App ..');

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";
import axios from "axios"; 

// IMPORT BAILEYS
import * as baileys from "baileys";
const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = baileys;

// Import Helper
import { handleCommand, ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";
import fileManager from "./plugins/file_manager.js";
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js"; // <--- [BARU] Import Ping

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const status = getStatus(`${__dirname}/sessions/`);

// --- DATABASE SETTINGS ---
const pathSettings = './DATABASE/settings.json';
if (!fs.existsSync(pathSettings)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE'); 
    fs.writeFileSync(pathSettings, JSON.stringify({ 
        mode: 'public', 
        antilink: [], 
        autojoin: false,
        owners: []
    }, null, 2));
}

const getDbSettings = () => {
    try { return JSON.parse(fs.readFileSync(pathSettings)); } 
    catch { return {}; }
};
const saveDbSettings = (data) => fs.writeFileSync(pathSettings, JSON.stringify(data, null, 2));

const question = (text) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((resolve) => {
        rl.question(text, (answer) => { rl.close(); resolve(answer); });
    });
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
        generateHighQualityLinkPreview: true 
    });

    if (!sock.authState.creds.registered) {
        console.log(clc.cyan.bold("\n🤖 Mode Pairing Code Aktif!"));
        setTimeout(async () => {
            const phoneNumber = await question(clc.yellow("Masukkan Nomor WhatsApp (contoh: 628123456xxx): "));
            if (phoneNumber) {
                try {
                    const code = await sock.requestPairingCode(phoneNumber.trim());
                    console.log(clc.green.bold(`🔗 KODE PAIRING: ${code?.match(/.{1,4}/g)?.join("-") || code}`));
                } catch (e) {
                    console.error(clc.red("Gagal request pairing code."), e);
                }
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
            startScheduler(sock);
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages[0]) return;
        const msg = m.messages[0]; 
        await handleIncomingMessages(sock, msg);
    });
     
    sock.ev.on("creds.update", saveCreds);
}

function startScheduler(sock) {
    setInterval(() => {
        const now = new Date();
        const time = `${String(now.getHours()).padStart(2,0)}:${String(now.getMinutes()).padStart(2,0)}`;
        const dbPath = './DATABASE/group_schedule.json';
        if (!fs.existsSync(dbPath)) return;
        try {
            const db = JSON.parse(fs.readFileSync(dbPath));
            Object.entries(db).forEach(async ([id, t]) => {
                if (t.open === time) {
                    await sock.groupSettingUpdate(id, "not_announcement");
                    await sock.sendMessage(id, { text: "⏰ Grup dibuka otomatis." });
                }
                if (t.close === time) {
                    await sock.groupSettingUpdate(id, "announcement");
                    await sock.sendMessage(id, { text: "⏰ Grup ditutup otomatis." });
                }
            });
        } catch {}
    }, 60000);
}

async function handleIncomingMessages(sock, msg) {
    try {
        if (!msg.message || msg.key.fromMe) return;

        const chatId = msg.key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        let sender = isGroup ? (msg.key.participant || msg.key.remoteJid) : chatId;
        sender = jidNormalizedUser(sender);
        const senderNum = sender.split('@')[0];
        const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || msg.message?.imageMessage?.caption || "";
        
        // --- LOGIKA PERMISSIONS ---
        const dbData = getDbSettings();
        const isCreator = isOwner(sender) || (dbData.owners && dbData.owners.includes(senderNum));
        if (dbData.mode === 'self' && !isCreator) return;

        // --- COMMANDS ---
        if (text === '.self' && isCreator) {
            dbData.mode = 'self'; saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: '🔴 *Mode SELF Aktif*' }, { quoted: msg });
        }
        if (text === '.public' && isCreator) {
            dbData.mode = 'public'; saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: '🟢 *Mode PUBLIC Aktif*' }, { quoted: msg });
        }
        if (text.startsWith('.addowner') && isCreator) {
            const target = text.split(' ')[1]?.replace(/[^0-9]/g, '');
            if (!target) return sock.sendMessage(chatId, { text: '⚠️ Masukkan nomor.' }, { quoted: msg });
            if (!dbData.owners) dbData.owners = [];
            dbData.owners.push(target); saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: `✅ Owner ditambah: ${target}` }, { quoted: msg });
        }
        if ((text === '.delallhc' || text === '.deleteallhc') && isCreator) {
            const dir = './ADDTIONAL/files';
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir).filter(f => f.endsWith('.hc'));
                files.forEach(f => fs.unlinkSync(path.join(dir, f)));
                return sock.sendMessage(chatId, { text: `✅ Dihapus: ${files.length} file .hc` }, { quoted: msg });
            }
        }

        // --- SECURITY ---
        if (isGroup && /chat.whatsapp.com/i.test(text)) {
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                const p = meta.participants.find(x => x.id === sender);
                isAdmin = (p?.admin === 'admin' || p?.admin === 'superadmin');
            } catch {}
            if (await checkAntilink(sock, chatId, text, msg, sender, isAdmin)) return;
        }

        if (dbData.autojoin && isCreator && text.includes("chat.whatsapp.com")) {
            let code = text.split('chat.whatsapp.com/')[1].split(' ')[0];
            await sock.groupAcceptInvite(code).catch(() => {});
        }

        // --- FEATURES ---
        if (text.startsWith('.cekkuota') || text.startsWith('.cekxl')) {
            const args = text.split(" ").slice(1);
            if (!args[0]) return sock.sendMessage(chatId, { text: "⚠️ Masukkan nomor." }, { quoted: msg });
            const msisdn = args[0].replace(/[^0-9]/g, '');
            await sock.sendMessage(chatId, { text: "⏳ Mengambil data..." }, { quoted: msg });
            try {
                const { data } = await axios.get(`https://apigw.kmsp-store.com/sidompul/v4/cek_kuota`, {
                    params: { msisdn, isJSON: 'true' },
                    headers: { 'Authorization': 'Basic c2lkb21wdWxhcGk6YXBpZ3drbXNw', 'X-API-Key': '60ef29aa-a648-4668-90ae-20951ef90c55', 'X-App-Version': '4.0.0', 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                if (data.status) {
                    let h = (data.data.hasil || "").replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>?/gm, '');
                    await sock.sendMessage(chatId, { text: `✅ *KUOTA XL ${msisdn}*\n\n${h}` }, { quoted: msg });
                } else await sock.sendMessage(chatId, { text: "❌ Gagal/Nomor Salah." }, { quoted: msg });
            } catch { await sock.sendMessage(chatId, { text: "❌ Error Server." }, { quoted: msg }); }
            return;
        }

        if (text.startsWith("#") && text.length > 1) {
            const q = text.substring(1).trim();
            const d = './ADDTIONAL/files'; 
            if (fs.existsSync(d)) {
                const f = fs.readdirSync(d).find(x => x.toLowerCase().includes(q.toLowerCase()));
                if (f) await sock.sendMessage(chatId, { document: fs.readFileSync(path.join(d, f)), mimetype: 'application/octet-stream', fileName: f }, { quoted: msg });
            }
        }

        // --- PLUGINS ---
        if (ping) await ping(sock, chatId, text, msg.key, msg); // <--- [BARU] Panggil Ping
        if (fileManager) await fileManager(sock, chatId, text, msg.key, msg);
        if (groupFeatures) await groupFeatures(sock, chatId, text, msg.key, msg);
        if (admin) await admin(sock, chatId, text, msg.key, msg);

        await handleCommand(sock, chatId, text, msg.key, senderNum, msg, false);

    } catch (e) { console.error("Msg Error:", e); }
}

if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
