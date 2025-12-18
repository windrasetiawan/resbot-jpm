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
import fileManager from "./plugins/file_manager.js";
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";

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
        const isCreator = isOwner(sender) || owners.includes(senderNum);

        // Security Mode
        if (dbData.mode === 'self' && !isCreator) return;

        // --- FITUR 1: AUTO JOIN (Deteksi Link Grup) ---
        if (text.includes("chat.whatsapp.com")) {
            const linkRegex = /chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g;
            const links = text.match(linkRegex);
            
            if (links && links.length > 0) {
                console.log(clc.yellow(`🔍 Mendeteksi ${links.length} link grup...`));
                for (let link of links) {
                    addGroupLinks(link); // Simpan ke database
                    if (dbData.autojoin) {
                        try {
                            const code = link.split('chat.whatsapp.com/')[1];
                            const res = await sock.groupAcceptInvite(code);
                            if (res) console.log(clc.green(`✅ Auto Join: ${code}`));
                        } catch (e) { /* Ignore error join */ }
                        await new Promise(r => setTimeout(r, 3000)); // Delay
                    }
                }
            }
        }

        // --- FITUR 2: #wintuneling (Kirim Semua Config .hc) ---
        if (text.trim().toLowerCase() === '#wintuneling') {
            const dir = './ADDTIONAL/files'; // Pastikan path ini benar sesuai folder Anda
            
            if (!fs.existsSync(dir)) {
                return sock.sendMessage(chatId, { text: "⚠️ Folder 'ADDTIONAL/files' tidak ditemukan!" }, { quoted: msg });
            }

            const files = fs.readdirSync(dir).filter(x => x.endsWith('.hc'));
            
            if (files.length > 0) {
                await sock.sendMessage(chatId, { text: `🚀 Mengirim ${files.length} file config...` }, { quoted: msg });
                
                for (let f of files) {
                    try {
                        await sock.sendMessage(chatId, { 
                            document: fs.readFileSync(path.join(dir, f)), 
                            mimetype: 'application/octet-stream', 
                            fileName: f,

                        }, { quoted: msg });
                        
                        await new Promise(r => setTimeout(r, 1500)); // Delay anti-spam
                    } catch (err) {
                        console.log(clc.red(`❌ Gagal kirim file ${f}: ${err.message}`));
                    }
                }
                return; // Stop proses lain
            } else {
                return sock.sendMessage(chatId, { text: "⚠️ Tidak ada file .hc di folder." }, { quoted: msg });
            }
        }

        // --- FITUR 3: SEARCH FILE (#namafile) ---
        if (text.startsWith("#") && text.length > 1) {
            const q = text.substring(1).trim();
            const d = './ADDTIONAL/files'; 
            if (fs.existsSync(d)) {
                const f = fs.readdirSync(d).find(x => x.toLowerCase().includes(q.toLowerCase()));
                if (f) await sock.sendMessage(chatId, { document: fs.readFileSync(path.join(d, f)), mimetype: 'application/octet-stream', fileName: f }, { quoted: msg });
            }
        }

        // --- COMMANDS ---
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

        // --- PLUGINS ---
        if (isGroup) {
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                const p = meta.participants.find(x => x.id === sender);
                isAdmin = (p?.admin === 'admin' || p?.admin === 'superadmin');
            } catch {}
            if (await checkAntilink(sock, chatId, text, msg, sender, isAdmin)) return;
        }

        if (ping) await ping(sock, chatId, text, msg.key, msg);
        if (fileManager) await fileManager(sock, chatId, text, msg.key, msg);
        if (groupFeatures) await groupFeatures(sock, chatId, text, msg.key, msg);
        if (admin) await admin(sock, chatId, text, msg.key, msg);

        await handleCommand(sock, chatId, text, msg.key, senderNum, msg, false);

    } catch (e) { console.error("Msg Error:", e); }
}

const status = getStatus(`${__dirname}/sessions/`);
if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
