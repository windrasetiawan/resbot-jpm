import {
    makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    makeCacheableSignalKeyStore,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";
import fs from "fs";
import pino from "pino";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline"; // Import readline untuk input terminal

// -- SETUP PATH & DATABASE --
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import Config & Plugins
import { numberAllowed } from "./config.js";
import { isOwner } from "./lib/utils.js";

// Import Plugins
import ping from "./plugins/ping.js";
import menu from "./plugins/menu.js";
import admin from "./plugins/admin.js";
import groupFeatures from "./plugins/group_features.js";
import hcFeatures from "./plugins/hc_features.js";
import cekkuota from "./plugins/cekkuota.js";
import jpm from "./plugins/jpm.js";
import pushkontak from "./plugins/pushkontak.js";
import autojpm from "./plugins/autojpm.js";
import listgc from "./plugins/listgc.js";
import tiktok from "./plugins/tiktok.js";
import igdl from "./plugins/igdl.js";
import owner from "./plugins/owner.js"; // Pastikan plugin owner sudah ada
import autoreply from "./plugins/autoreply.js";
import jpmtag from "./plugins/jpmtag.js";

// -- DATABASE INIT --
const dbFolder = path.join(__dirname, "DATABASE");
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

const settingsPath = path.join(dbFolder, "settings.json");
if (!fs.existsSync(settingsPath)) {
    fs.writeFileSync(settingsPath, JSON.stringify({ mode: 'public', antilink: [], autojoin: false, owners: [], schedule: {} }));
}

// -- FUNGSI INPUT TERMINAL --
const question = (text) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise((resolve) => {
        rl.question(text, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
};

// -- FUNGSI UTAMA START --
async function start() {
    const { state, saveCreds } = await useMultiFileAuthState("sessions");
    const { version } = await fetchLatestBaileysVersion();
    const logger = pino({ level: "silent" });

    // 1. TAMPILKAN MENU PILIHAN LOGIN
    console.clear();
    console.log(`
╭────────────────────────────────╮
│     WINTUNELING VPN BOT        │
╰────────────────────────────────╯
1. 📷 Login dengan QR Code
2. 🔢 Login dengan Pairing Code
──────────────────────────────────`);
    
    // Cek apakah sudah ada sesi login sebelumnya?
    // Jika belum ada (state.creds.me kosong) dan tidak terdaftar, baru tanya user.
    let usePairingCode = false;
    let phoneNumber = "";

    if (!state.creds.me && !state.creds.registered) {
        const choice = await question("👉 Pilih Metode Login (1/2): ");
        if (choice.trim() === "2") {
            usePairingCode = true;
            phoneNumber = await question("📱 Masukkan Nomor Bot (628xx): ");
            phoneNumber = phoneNumber.replace(/\D/g, ""); // Hapus karakter non-angka
        } else {
            console.log("📷 Silakan scan QR Code yang muncul...");
        }
    }

    // 2. SETUP SOCKET
    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: !usePairingCode, // QR muncul jika pairing code dimatikan
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        browser: ["Ubuntu", "Chrome", "20.0.04"], // Browser stabil
        generateHighQualityLinkPreview: true,
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 10000,
        markOnlineOnConnect: true,
    });

    // 3. LOGIC PAIRING CODE (Jika dipilih)
    if (usePairingCode && !sock.authState.creds.registered) {
        console.log(`⏳ Meminta Pairing Code untuk nomor: ${phoneNumber}...`);
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`\n🔑 KODE PAIRING ANDA: \x1b[32m${code}\x1b[0m\n`);
            } catch (e) {
                console.log("❌ Gagal meminta pairing code. Pastikan nomor benar.");
            }
        }, 3000);
    }

    // -- EVENT LISTENERS --

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "close") {
            const reason = lastDisconnect?.error?.output?.statusCode;
            console.log("⚠️ Koneksi Terputus. Reason:", reason);
            
            if (reason === DisconnectReason.loggedOut) {
                console.log("❌ Sesi dihapus/logout. Hapus folder sessions dan scan ulang.");
            } else {
                console.log("🔄 Reconnecting...");
                start(); // Auto reconnect
            }
        } else if (connection === "open") {
            console.log("✅ BOT TERHUBUNG!");
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        try {
            const msg = messages[0];
            if (!msg.message) return;
            if (msg.key.fromMe) return;

            const type = Object.keys(msg.message)[0];
            const text = type === "conversation" ? msg.message.conversation :
                         type === "extendedTextMessage" ? msg.message.extendedTextMessage.text :
                         type === "imageMessage" ? msg.message.imageMessage.caption : "";
            
            if (!text) return;

            const chatId = msg.key.remoteJid;
            // Gunakan sender dari utils isOwner logic nanti
            const sender = msg.key.participant || msg.key.remoteJid; 

            // Console Log Pesan Masuk
            console.log(`📩 [${sender.split("@")[0]}] : ${text}`);

            // EKSEKUSI PLUGINS
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
                igdl(sock, chatId, text, msg.key, msg),
                owner(sock, chatId, text, msg.key, msg),
                autoreply(sock, chatId, text, msg.key, msg),
                jpmtag(sock, chatId, text, msg.key, msg)
            ]);

        } catch (e) {
            console.error("Error handling message:", e);
        }
    });
}

// Jalankan Bot
start();
