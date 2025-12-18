import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";
import axios from "axios"; 
import * as baileys from "baileys";

// IMPORT PLUGINS & HELPERS
import { handleCommand, ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import { addGroupLinks } from "./lib/grupLinkStore.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";
import hcFeatures from "./plugins/hc_features.js"; // PLUGIN HC (FILE MANAGER)
import cekkuota from "./plugins/cekkuota.js";      // PLUGIN CEK KUOTA
import tiktok from "./plugins/tiktok.js";

const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = baileys;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DATABASE SETTINGS
const pathSettings = './DATABASE/settings.json';
if (!fs.existsSync(pathSettings)) {
    if (!fs.existsSync('./DATABASE')) fs.mkdirSync('./DATABASE', { recursive: true }); 
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
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (!m.messages[0]) return;
        const msg = m.messages[0]; 
        await handleIncomingMessages(sock, msg);
    });
     
    sock.ev.on("creds.update", saveCreds);
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
        
        const dbData = getDbSettings();
        const owners = dbData.owners || [];
        // Cek Owner di Config & Database
        const isCreator = isOwner(sender) || owners.includes(senderNum);

        // Security Mode (Self/Public)
        if (dbData.mode === 'self' && !isCreator) return;

        // --- FITUR AUTO JOIN (Prioritas Utama) ---
        if (text.includes("chat.whatsapp.com")) {
            const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g;
            const links = text.match(linkRegex);
            
            if (links && links.length > 0) {
                console.log(clc.yellow(`🔍 Mendeteksi ${links.length} link grup...`));
                for (let link of links) {
                    addGroupLinks(link); // Simpan link ke database
                    
                    if (dbData.autojoin) { // Jika fitur ON
                        try {
                            const code = link.split('chat.whatsapp.com/')[1];
                            const res = await sock.groupAcceptInvite(code);
                            if (res) console.log(clc.green(`✅ Auto Join: ${code}`));
                        } catch (e) { /* Ignore error */ }
                        await new Promise(r => setTimeout(r, 3000)); // Delay
                    }
                }
            }
        }

        // --- LOAD PLUGINS ---
        if (ping) await ping(sock, chatId, text, msg.key, msg);
        if (groupFeatures) await groupFeatures(sock, chatId, text, msg.key, msg);
        if (admin) await admin(sock, chatId, text, msg.key, msg);
        if (hcFeatures) await hcFeatures(sock, chatId, text, msg.key, msg); // Handle Config & Zip
        if (cekkuota) await cekkuota(sock, chatId, text, msg.key, msg);     // Handle Cek Kuota
        if (tiktok) await tiktok(sock, chatId, text, msg.key, msg);

        // --- COMMANDS BAWAAN ---
        if (text === '.self' && isCreator) {
            dbData.mode = 'self'; saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: '🔒 *Mode SELF Aktif*' }, { quoted: msg });
        }
        if (text === '.public' && isCreator) {
            dbData.mode = 'public'; saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: '🔓 *Mode PUBLIC Aktif*' }, { quoted: msg });
        }
        if (text.startsWith('.addowner') && isCreator) {
            const target = text.split(' ')[1]?.replace(/[^0-9]/g, '');
            if (!target) return sock.sendMessage(chatId, { text: '⚠️ Format: .addowner 628xxx' }, { quoted: msg });
            if (!dbData.owners) dbData.owners = [];
            dbData.owners.push(target); saveDbSettings(dbData);
            return sock.sendMessage(chatId, { text: `✅ Owner ditambah: ${target}` }, { quoted: msg });
        }

        // --- ANTILINK GRUP ---
        if (isGroup) {
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                const p = meta.participants.find(x => x.id === sender);
                isAdmin = (p?.admin === 'admin' || p?.admin === 'superadmin');
            } catch {}
            if (await checkAntilink(sock, chatId, text, msg, sender, isAdmin)) return;
        }

        await handleCommand(sock, chatId, text, msg.key, senderNum, msg, false);

    } catch (e) { console.error("Msg Error:", e); }
}

const status = getStatus(`${__dirname}/sessions/`);
if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
