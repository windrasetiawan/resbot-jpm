import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import P from "pino";
import clc from "cli-color";
import readline from "readline";
import * as baileys from "baileys";

// --- IMPORT HELPERS ---
import { ChangeStatus, getStatus, isOwner } from "./lib/utils.js"; 
import { addGroupLinks } from "./lib/grupLinkStore.js"; 
import resumeAutoJPM from "./lib/resumeAutoJPM.js";

// --- IMPORT PLUGINS (MANUAL) ---
import groupFeatures, { checkAntilink } from "./plugins/group_features.js";
import admin from "./plugins/admin.js"; 
import ping from "./plugins/ping.js";
import hcFeatures from "./plugins/hc_features.js"; 
import cekkuota from "./plugins/cekkuota.js";      
import menu from "./plugins/menu.js"; // <--- MENU WAJIB DI-IMPORT DISINI

const makeWASocket = baileys.default?.default || baileys.default || baileys;
const { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, jidNormalizedUser } = baileys;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- DATABASE SETTINGS ---
const pathSettings = './DATABASE/settings.json';
// Pastikan folder DATABASE ada
if (!fs.existsSync('./DATABASE')) {
    fs.mkdirSync('./DATABASE', { recursive: true });
}
// Buat file settings.json jika belum ada
if (!fs.existsSync(pathSettings)) {
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
    console.log(clc.yellow("⏳ Sedang memeriksa versi WA & Koneksi...")); // LOG SUPAYA TIDAK DIKIRA STUCK
    const { version } = await fetchLatestBaileysVersion();
    
    console.log(clc.yellow(`🚀 Memulai Bot (Versi Baileys: ${version.join('.')})...`));

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false,
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        generateHighQualityLinkPreview: true 
    });

    // --- PAIRING CODE LOGIC ---
    if (!sock.authState.creds.registered) {
        console.log(clc.cyan.bold("\n🤖 Mode Pairing Code Aktif!"));
        // Tunggu 3 detik agar log terlihat jelas
        setTimeout(async () => {
            const phoneNumber = await question(clc.yellow("📱 Masukkan Nomor WhatsApp (contoh: 628123456xxx): "));
            if (phoneNumber) {
                try {
                    const code = await sock.requestPairingCode(phoneNumber.trim().replace(/[^0-9]/g, ''));
                    console.log(clc.green.bold(`🔗 KODE PAIRING: ${code?.match(/.{1,4}/g)?.join("-") || code}`));
                } catch (e) {
                    console.error(clc.red("❌ Gagal request pairing code. Cek nomor atau koneksi."), e);
                }
            }
        }, 3000);
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(clc.red("⚠️ Koneksi terputus, mencoba reconnect..."));
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === "open") {
            console.log(clc.green("✅ Terhubung ke WhatsApp!"));
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
        
        // Ambil text pesan
        const text = msg.message?.conversation || 
                     msg.message?.extendedTextMessage?.text || 
                     msg.message?.imageMessage?.caption || 
                     msg.message?.videoMessage?.caption || "";
        
        const dbData = getDbSettings();
        const owners = dbData.owners || [];
        const isCreator = isOwner(sender) || owners.includes(senderNum);

        // Security Mode (Self/Public)
        if (dbData.mode === 'self' && !isCreator) return;

        // --- 1. FITUR AUTO JOIN ---
        if (text.includes("chat.whatsapp.com")) {
            const links = text.match(/chat\.whatsapp\.com\/([0-9A-Za-z]{20,24})/g);
            if (links && links.length > 0) {
                for (let link of links) {
                    addGroupLinks(link); 
                    if (dbData.autojoin) { 
                        try {
                            const code = link.split('chat.whatsapp.com/')[1];
                            await sock.groupAcceptInvite(code);
                        } catch (e) {}
                    }
                }
            }
        }

        // --- 2. EKSEKUSI PLUGINS (MANUAL & PASTI) ---
        // Panggil plugin satu per satu. Jika satu error, yang lain tetap jalan.
        try { if (ping) await ping(sock, chatId, text, msg.key, msg); } catch(e){}
        try { if (groupFeatures) await groupFeatures(sock, chatId, text, msg.key, msg); } catch(e){}
        try { if (admin) await admin(sock, chatId, text, msg.key, msg); } catch(e){}
        try { if (hcFeatures) await hcFeatures(sock, chatId, text, msg.key, msg); } catch(e){}
        try { if (cekkuota) await cekkuota(sock, chatId, text, msg.key, msg); } catch(e){}
        
        // [FIX] MENU SEKARANG DIPANGGIL DISINI
        try { if (menu) await menu(sock, chatId, text, msg.key, msg); } catch(e){} 

        // --- 3. COMMANDS BAWAAN ---
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

        // --- 4. ANTILINK GRUP ---
        if (isGroup) {
            let isAdmin = false;
            try {
                const meta = await sock.groupMetadata(chatId);
                const p = meta.participants.find(x => x.id === sender);
                isAdmin = (p?.admin === 'admin' || p?.admin === 'superadmin');
            } catch {}
            if (await checkAntilink(sock, chatId, text, msg, sender, isAdmin)) return;
        }

    } catch (e) { console.error("Msg Error:", e); }
}

const status = getStatus(`${__dirname}/sessions/`);
if (status === "connected") connectToWhatsApp();
else connectToWhatsApp();
